const dynamodb = require('../lib/dynamodb-clean');
const WebSocketService = require('../lib/websocket');

// Monster AI helper function
async function triggerMonsterAI(gameId, levelData, playerPosition) {
  let monstersUpdated = false;
  const updatedMonsters = [...levelData.monsters];
  
  // Move monsters that are close to the player
  updatedMonsters.forEach(monster => {
    if (monster.hp <= 0) return;
    
    // Calculate distance to player
    const distance = Math.abs(playerPosition.x - monster.x) + Math.abs(playerPosition.y - monster.y);
    
    // Only move if player is within 8 tiles (immediate reaction range)
    if (distance <= 8 && distance > 1) {
      // Calculate movement toward player
      const dx = playerPosition.x - monster.x;
      const dy = playerPosition.y - monster.y;
      
      let newX = monster.x;
      let newY = monster.y;
      
      // Simple AI - move toward player
      if (Math.abs(dx) > Math.abs(dy)) {
        newX += dx > 0 ? 1 : -1;
      } else if (dy !== 0) {
        newY += dy > 0 ? 1 : -1;
      }
      
      // Check if move is valid and no other monster is there
      if (dynamodb.isValidMove(newX, newY, levelData.dungeon)) {
        const blocked = updatedMonsters.some(m => m.id !== monster.id && m.x === newX && m.y === newY && m.hp > 0);
        
        if (!blocked && !(newX === playerPosition.x && newY === playerPosition.y)) {
          monster.x = newX;
          monster.y = newY;
          monstersUpdated = true;
          console.log(`Monster ${monster.name} moved to (${newX}, ${newY}) toward player`);
        }
      }
    }
  });
  
  // Update monsters in the level data if any moved
  if (monstersUpdated) {
    levelData.monsters = updatedMonsters;
    await dynamodb.updateGame(gameId, {
      [`levels.1.monsters`]: updatedMonsters
    });
  }
  
  return monstersUpdated;
}

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const ws = new WebSocketService(event);
  
  try {
    const body = JSON.parse(event.body);
    const { direction, useStairs, sequence } = body;
    
    console.log(`Final PlayerMove: direction=${direction}, useStairs=${useStairs}, sequence=${sequence}`);
    
    // Get player
    const player = await dynamodb.getPlayer(connectionId);
    if (!player) {
      await ws.sendToConnection(connectionId, {
        type: 'error',
        message: 'Player not found'
      });
      return { statusCode: 404, body: 'Player not found' };
    }
    
    // Get game
    const game = await dynamodb.getGame(player.gameId);
    if (!game) {
      await ws.sendToConnection(connectionId, {
        type: 'error',
        message: 'Game not found'
      });
      return { statusCode: 404, body: 'Game not found' };
    }
    
    const currentLevel = player.level || 1;
    const levelData = game.levels[currentLevel.toString()];
    
    if (!levelData) {
      console.error(`No level data found for level ${currentLevel}`);
      await ws.sendToConnection(connectionId, {
        type: 'error',
        message: 'Level data not found'
      });
      return { statusCode: 500, body: 'Level data not found' };
    }
    
    // Calculate new position
    let newX = player.x;
    let newY = player.y;
    
    switch (direction) {
      case 'up':
      case 'w':
        newY = player.y - 1;
        break;
      case 'down':
      case 's':
        newY = player.y + 1;
        break;
      case 'left':
      case 'a':
        newX = player.x - 1;
        break;
      case 'right':
      case 'd':
        newX = player.x + 1;
        break;
    }
    
    console.log(`Player ${connectionId} trying to move from (${player.x}, ${player.y}) to (${newX}, ${newY})`);
    
    // Check if move is valid (not a wall and within bounds)
    if (!dynamodb.isValidMove(newX, newY, levelData.dungeon)) {
      await ws.sendToConnection(connectionId, {
        type: 'message',
        data: {
          text: `Can't move ${direction} - blocked by wall!`,
          color: 'red'
        }
      });
      return { statusCode: 200, body: 'Move blocked by wall' };
    }
    
    let actualPosition = { x: player.x, y: player.y };
    let playerUpdates = {};
    let gameUpdates = {};
    
    // Check for monsters at target position FIRST (combat takes priority)
    let monster = levelData.monsters.find(m => m.x === newX && m.y === newY && m.hp > 0);
    
    if (monster) {
      // Combat! Player stays in current position during combat
      const damage = Math.floor(Math.random() * 8) + 3;
      monster.hp -= damage;
      
      await ws.sendToConnection(connectionId, {
        type: 'message',
        data: {
          text: `You hit the ${monster.name} for ${damage} damage!`,
          color: 'red'
        }
      });
      
      if (monster.hp <= 0) {
        await ws.sendToConnection(connectionId, {
          type: 'message',
          data: {
            text: `You killed the ${monster.name}!`,
            color: 'green'
          }
        });
        
        // Monster loot drops (60% chance)
        if (Math.random() < 0.6) {
          const lootTable = [
            { name: 'gold coins', symbol: '$', type: 'gold', value: Math.floor(Math.random() * 20) + 5 },
            { name: 'healing potion', symbol: '!', type: 'potion', healing: 15 },
            { name: 'dagger', symbol: ')', type: 'weapon', damage: 3 },
            { name: 'leather boots', symbol: '[', type: 'armor', defense: 1 },
            { name: 'ration', symbol: '%', type: 'food', nutrition: 800 }
          ];
          
          const loot = lootTable[Math.floor(Math.random() * lootTable.length)];
          loot.id = `loot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          loot.x = monster.x;
          loot.y = monster.y;
          
          levelData.items.push(loot);
          gameUpdates[`levels.${currentLevel}.items`] = levelData.items;
          
          await ws.sendToConnection(connectionId, {
            type: 'message',
            data: {
              text: `The ${monster.name} dropped ${loot.name}!`,
              color: 'yellow'
            }
          });
        }
        
        // Remove dead monster
        levelData.monsters = levelData.monsters.filter(m => m.id !== monster.id);
        gameUpdates[`levels.${currentLevel}.monsters`] = levelData.monsters;
        
        // Player can move into the space
        actualPosition = { x: newX, y: newY };
        playerUpdates.x = newX;
        playerUpdates.y = newY;
        
        console.log(`Player moved to (${newX}, ${newY}) after killing monster`);
      } else {
        // Monster attacks back - player stays in place
        const monsterDamage = Math.floor(Math.random() * monster.damage) + 1;
        const newHp = Math.max(0, player.hp - monsterDamage);
        playerUpdates.hp = newHp;
        
        await ws.sendToConnection(connectionId, {
          type: 'message',
          data: {
            text: `The ${monster.name} hits you for ${monsterDamage} damage!`,
            color: 'red'
          }
        });
        
        // Update monster in game
        gameUpdates[`levels.${currentLevel}.monsters`] = levelData.monsters;
        
        console.log(`Player stayed at (${player.x}, ${player.y}) during combat`);
      }
    } else {
      // No monster - player can move to the new position
      actualPosition = { x: newX, y: newY };
      playerUpdates.x = newX;
      playerUpdates.y = newY;
      
      // Check for items at the new position AFTER moving (no auto-pickup)
      let item = levelData.items.find(i => i.x === newX && i.y === newY);
      
      if (item) {
        // Just notify player about the item - no auto-pickup
        await ws.sendToConnection(connectionId, {
          type: 'message',
          data: {
            text: `You see ${item.name} here. Press ',' to pick it up.`,
            color: 'cyan'
          }
        });
        
        await ws.sendToConnection(connectionId, {
          type: 'message',
          data: {
            text: `You picked up ${item.name}!`,
            color: 'green'
          }
        });
        
        console.log(`Player picked up ${item.name} at (${newX}, ${newY})`);
      }
      
      console.log(`Player moved to (${newX}, ${newY})`);
    }
    
    // Update player in database if changed
    if (Object.keys(playerUpdates).length > 0) {
      // Update player
      const updatedPlayer = { ...player, ...playerUpdates };
      await dynamodb.savePlayer(connectionId, player.gameId, updatedPlayer);
    }
    
    // Update game in database if changed
    if (Object.keys(gameUpdates).length > 0) {
      await dynamodb.updateGame(game.gameId, gameUpdates);
    }
    
    // Trigger immediate monster AI response when player moves
    await triggerMonsterAI(player.gameId, levelData, actualPosition);
    
    // MONSTER AI: Move monsters after player moves (proper turn-based gameplay)
    let monstersUpdated = false;
    const updatedMonsters = [...levelData.monsters];
    
    // Get all players for monster AI
    const allPlayers = await dynamodb.getPlayersByGame(player.gameId);
    
    // Move each living monster toward nearest player
    updatedMonsters.forEach(monster => {
      if (monster.hp <= 0) return;
      
      // Find nearest player
      let nearestPlayer = null;
      let nearestDistance = Infinity;
      
      allPlayers.forEach(p => {
        const distance = Math.abs(p.x - monster.x) + Math.abs(p.y - monster.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPlayer = p;
        }
      });
      
      if (!nearestPlayer || nearestDistance > 10) return; // Only move if player is within 10 tiles
      
      // Calculate movement toward player
      const dx = nearestPlayer.x - monster.x;
      const dy = nearestPlayer.y - monster.y;
      
      let newX = monster.x;
      let newY = monster.y;
      
      // Simple AI - move toward player
      if (Math.abs(dx) > Math.abs(dy)) {
        newX += dx > 0 ? 1 : -1;
      } else if (dy !== 0) {
        newY += dy > 0 ? 1 : -1;
      }
      
      // Check if move is valid and no other monster/player is there
      if (dynamodb.isValidMove(newX, newY, levelData.dungeon)) {
        const blocked = allPlayers.some(p => p.x === newX && p.y === newY) ||
                       updatedMonsters.some(m => m.id !== monster.id && m.x === newX && m.y === newY && m.hp > 0);
        
        if (!blocked) {
          monster.x = newX;
          monster.y = newY;
          monstersUpdated = true;
          console.log(`Monster ${monster.name} moved to (${newX}, ${newY})`);
        }
      }
    });
    
    // Update monsters in game if they moved
    if (monstersUpdated) {
      gameUpdates[`levels.${currentLevel}.monsters`] = updatedMonsters;
      levelData.monsters = updatedMonsters;
    }
    
    // Get all players and send updated game state
    const players = await dynamodb.getPlayersByGame(player.gameId);
    const gameConnections = players.map(p => p.playerId);
    
    const gameState = {
      roomCode: game.roomCode,
      currentLevel: currentLevel,
      dungeon: levelData.dungeon,
      monsters: levelData.monsters,
      items: levelData.items,
      features: levelData.features,
      players: players.map(p => ({
        id: p.playerId,
        name: p.name,
        class: p.characterClass || 'fighter',
        className: p.className || 'Fighter',
        x: p.playerId === connectionId ? actualPosition.x : p.x,
        y: p.playerId === connectionId ? actualPosition.y : p.y,
        hp: p.playerId === connectionId ? (playerUpdates.hp !== undefined ? playerUpdates.hp : player.hp) : p.hp,
        maxHp: p.maxHp,
        level: p.level || 1,
        symbol: p.symbol || '@',
        inventory: p.playerId === connectionId ? (playerUpdates.inventory || player.inventory || []) : (p.inventory || []),
        gold: p.gold || 0,
        experience: p.experience || 0,
        armor: p.armor || 0
      }))
    };
    
    // Send updated game state to all players
    for (const connId of gameConnections) {
      try {
        await ws.sendToConnection(connId, {
          type: 'gameState',
          data: gameState
        });
      } catch (error) {
        console.error(`Failed to send game state to ${connId}:`, error);
      }
    }
    
    return {
      statusCode: 200,
      body: 'Final move processed'
    };
  } catch (error) {
    console.error('Final player move error:', error);
    
    await ws.sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to process final move'
    });
    
    return {
      statusCode: 500,
      body: 'Failed to process final move'
    };
  }
};