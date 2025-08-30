const dynamodb = require('../lib/dynamodb');
const WebSocketService = require('../lib/websocket');

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const ws = new WebSocketService(event);
  
  try {
    const body = JSON.parse(event.body);
    const { direction, useStairs, sequence } = body;
    

    
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
    const levelData = game.levels[currentLevel] || game.levels[currentLevel.toString()];
    
    if (!levelData) {
      console.error(`No level data found for level ${currentLevel}`);
      await ws.sendToConnection(connectionId, {
        type: 'error',
        message: 'Level data not found'
      });
      return { statusCode: 500, body: 'Level data not found' };
    }
    
    // Handle stairs usage
    if (useStairs) {
      const currentCellContent = levelData.dungeon[player.y]?.[player.x];
      
      // Check if player is on stairs
      if ((useStairs === 'down' && currentCellContent === '>') || 
          (useStairs === 'up' && currentCellContent === '<')) {
        

        
        // Handle level transition
        const result = await dynamodb.handleLevelTransition(player.gameId, connectionId, useStairs);
        
        if (result) {
          const message = useStairs === 'up' 
            ? `You climb up to level ${result.newLevel}`
            : `You descend to level ${result.newLevel}! The dungeon grows more dangerous...`;
          
          await ws.sendToConnection(connectionId, {
            type: 'message',
            data: {
              text: message,
              color: 'cyan'
            }
          });
          
          // Send updated game state for new level
          const updatedGame = await dynamodb.getGame(player.gameId);
          const newLevelData = updatedGame.levels[result.newLevel] || updatedGame.levels[result.newLevel.toString()];
          const players = await dynamodb.getPlayersByGame(player.gameId);
          const gameConnections = players.map(p => p.playerId);
          
          const gameState = {
            roomCode: updatedGame.roomCode,
            currentLevel: result.newLevel,
            dungeon: newLevelData.dungeon,
            monsters: newLevelData.monsters.filter(m => m.hp > 0),
            items: newLevelData.items,
            features: newLevelData.features,
            players: players.map(p => ({
              id: p.playerId,
              name: p.name,
              class: p.class || 'fighter',
              className: p.className || 'Fighter',
              x: p.x,
              y: p.y,
              hp: p.hp,
              maxHp: p.maxHp,
              level: p.level || 1,
              symbol: p.symbol || '@',
              inventory: p.inventory || [],
              gold: p.gold || 0,
              experience: p.experience || 0
            })).filter(p => (p.level || 1) === result.newLevel)
          };
          
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
          
          return { statusCode: 200, body: 'Level transition successful' };
        } else {
          await ws.sendToConnection(connectionId, {
            type: 'message',
            data: {
              text: 'Unable to use stairs at this time.',
              color: 'red'
            }
          });
          return { statusCode: 500, body: 'Level transition failed' };
        }
      } else {
        await ws.sendToConnection(connectionId, {
          type: 'message',
          data: {
            text: `No ${useStairs}stairs here. Stand on the stairs first.`,
            color: 'gray'
          }
        });
        return { statusCode: 200, body: 'No stairs at current position' };
      }
    }
    
    // Calculate new position
    const newPos = dynamodb.getNewPosition(player.x, player.y, direction);
    
    // Check for monsters at new position
    let monster = levelData.monsters.find(m => m.x === newPos.x && m.y === newPos.y && m.hp > 0);
    

    
    let actualPosition = { x: player.x, y: player.y };
    let playerUpdates = {};
    
    if (monster) {
      // Combat!
      const damage = Math.floor(Math.random() * 6) + 3;
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
        
        // Remove dead monster
        const monsterIndex = levelData.monsters.findIndex(m => m.id === monster.id);
        if (monsterIndex !== -1) {
          levelData.monsters.splice(monsterIndex, 1);
        }
        
        // Player can move into its space
        if (dynamodb.isValidMove(newPos.x, newPos.y, levelData.dungeon)) {
          actualPosition = newPos;
          playerUpdates.x = newPos.x;
          playerUpdates.y = newPos.y;
        }
        
        // Update game state immediately for dead monster
        await dynamodb.updateGame(player.gameId, {
          [`levels.${currentLevel}.monsters`]: levelData.monsters
        });
        
        // Broadcast updated game state to all players to remove dead monster
        const updatedGame = await dynamodb.getGame(player.gameId);
        const players = await dynamodb.getPlayersByGame(player.gameId);
        const gameConnections = players.map(p => p.playerId);
        const newLevelData = updatedGame.levels[currentLevel] || updatedGame.levels[currentLevel.toString()];
        
        const gameState = {
          roomCode: updatedGame.roomCode,
          currentLevel: currentLevel,
          dungeon: newLevelData.dungeon,
          monsters: newLevelData.monsters.filter(m => m.hp > 0), // Only living monsters
          items: newLevelData.items,
          features: newLevelData.features,
          players: players.map(p => ({
            id: p.playerId,
            name: p.name,
            class: p.class || 'fighter',
            className: p.className || 'Fighter',
            x: p.x,
            y: p.y,
            hp: p.hp,
            maxHp: p.maxHp,
            level: p.level || 1,
            symbol: p.symbol || '@',
            inventory: p.inventory || [],
            gold: p.gold || 0,
            experience: p.experience || 0
          })).filter(p => (p.level || 1) === currentLevel)
        };
        
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
        
      } else {
        // Monster attacks back
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
        
        // Update game state for living monster (HP changed)
        await dynamodb.updateGame(player.gameId, {
          [`levels.${currentLevel}.monsters`]: levelData.monsters
        });
      }
      
    } else if (dynamodb.isValidMove(newPos.x, newPos.y, levelData.dungeon)) {
      // Normal movement
      actualPosition = newPos;
      playerUpdates.x = newPos.x;
      playerUpdates.y = newPos.y;
    }
    
    // Update player position if changed
    if (Object.keys(playerUpdates).length > 0) {
      await dynamodb.updatePlayer(connectionId, playerUpdates);
      
      // Send player update
      const players = await dynamodb.getPlayersByGame(player.gameId);
      const gameConnections = players.map(p => p.playerId);
      
      for (const connId of gameConnections) {
        try {
          await ws.sendToConnection(connId, {
            type: 'playerUpdate',
            data: {
              id: connectionId,
              x: actualPosition.x,
              y: actualPosition.y,
              hp: playerUpdates.hp !== undefined ? playerUpdates.hp : player.hp,
              sequence: sequence
            }
          });
        } catch (error) {
          console.error(`Failed to send player update to ${connId}:`, error);
        }
      }
    }
    
    // Run monster AI after player move (NetHack style - monsters move after each player action)
    await processMonsterTurns(ws, game, currentLevel, connectionId);
    
    return {
      statusCode: 200,
      body: 'Move processed'
    };
  } catch (error) {
    console.error('Player move error:', error);
    
    await ws.sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to process move'
    });
    
    return {
      statusCode: 500,
      body: 'Failed to process move'
    };
  }
};

// Monster AI - runs after each player move (NetHack style)
async function processMonsterTurns(ws, game, currentLevel, triggeringPlayerId) {
  try {
    const levelData = game.levels[currentLevel];
    if (!levelData || !levelData.monsters || levelData.monsters.length === 0) {
      return; // No monsters to move
    }

    const players = await dynamodb.getPlayersByGame(game.gameId);
    const playersOnLevel = players.filter(p => (p.level || 1) === currentLevel);
    if (playersOnLevel.length === 0) {
      return; // No players on this level
    }

    let monstersChanged = false;

    // Process each monster's turn
    for (const monster of levelData.monsters) {
      if (monster.hp <= 0) continue; // Skip dead monsters

      // Find nearest player for this monster to hunt
      let nearestPlayer = null;
      let nearestDistance = Infinity;

      for (const player of playersOnLevel) {
        const distance = Math.abs(monster.x - player.x) + Math.abs(monster.y - player.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPlayer = player;
        }
      }

      if (!nearestPlayer) continue;

      // Monster behavior - kobolds are aggressive within 5 tiles
      const detectionRange = 5;
      const canSeePlayer = nearestDistance <= detectionRange;

      // Only act if monster can see player or is already chasing
      if (canSeePlayer || monster.isChasing) {
        monster.isChasing = true; // Once they see you, they keep chasing

        // Check if monster is adjacent to player - ATTACK!
        const dx = nearestPlayer.x - monster.x;
        const dy = nearestPlayer.y - monster.y;
        const isAdjacent = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0);
        
        if (isAdjacent) {
          // Monster attacks adjacent player
          const damage = Math.floor(Math.random() * (monster.damage || 2)) + 1;
          const newHp = Math.max(0, nearestPlayer.hp - damage);
            
          // Update player HP
          await dynamodb.updatePlayer(nearestPlayer.id, { hp: newHp });
          
          // Send attack message to the attacked player
          await ws.sendToConnection(nearestPlayer.id, {
            type: 'message',
            data: {
              text: `The ${monster.name} attacks you for ${damage} damage!`,
              color: 'red'
            }
          });

          // Update player stats for all clients
          const gameConnections = playersOnLevel.map(p => p.playerId);
          for (const connId of gameConnections) {
            try {
              await ws.sendToConnection(connId, {
                type: 'playerUpdate',
                data: {
                  id: nearestPlayer.id,
                  hp: newHp
                }
              });
            } catch (error) {
              console.error(`Failed to send player update to ${connId}:`, error);
            }
          }

          // Check if player died
          if (newHp <= 0) {
            await ws.sendToConnection(nearestPlayer.id, {
              type: 'message',
              data: {
                text: `You have been slain by the ${monster.name}!`,
                color: 'red'
              }
            });
          }
        } else {
          // Not adjacent, try to move toward player
          let newX = monster.x;
          let newY = monster.y;

          // Simple pathfinding - move toward player
          if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal movement
            newX += dx > 0 ? 1 : -1;
          } else if (dy !== 0) {
            // Vertical movement
            newY += dy > 0 ? 1 : -1;
          }

          // Check if the move is valid
          if (dynamodb.isValidMove(newX, newY, levelData.dungeon)) {
            // Check if there's a player at the target position
            const playerAtTarget = playersOnLevel.find(p => p.x === newX && p.y === newY);
            
            if (!playerAtTarget) {
              // Check if there's another monster at the target position
              const monsterAtTarget = levelData.monsters.find(m => 
                m.id !== monster.id && m.x === newX && m.y === newY && m.hp > 0
              );

              if (!monsterAtTarget) {
                // Valid move, no collision
                monster.x = newX;
                monster.y = newY;
                monstersChanged = true;
              }
            }
          }
        }
      } else {
        // Monster can't see player - stop chasing after a while
        if (monster.isChasing && Math.random() < 0.1) { // 10% chance to stop chasing each turn
          monster.isChasing = false;
        }
      }
    }

    // Update database and broadcast if monsters moved
    if (monstersChanged) {
      await dynamodb.updateGame(game.gameId, {
        [`levels.${currentLevel}.monsters`]: levelData.monsters
      });

      // Broadcast updated game state to all players on this level
      const updatedGame = await dynamodb.getGame(game.gameId);
      const gameConnections = playersOnLevel.map(p => p.playerId);
      const newLevelData = updatedGame.levels[currentLevel] || updatedGame.levels[currentLevel.toString()];
      
      const gameState = {
        roomCode: updatedGame.roomCode,
        currentLevel: currentLevel,
        dungeon: newLevelData.dungeon,
        monsters: newLevelData.monsters.filter(m => m.hp > 0),
        items: newLevelData.items,
        features: newLevelData.features,
        players: playersOnLevel.map(p => ({
          id: p.playerId,
          name: p.name,
          class: p.class || 'fighter',
          className: p.className || 'Fighter',
          x: p.x,
          y: p.y,
          hp: p.hp,
          maxHp: p.maxHp,
          level: p.level || 1,
          symbol: p.symbol || '@',
          inventory: p.inventory || [],
          gold: p.gold || 0,
          experience: p.experience || 0
        }))
      };
      
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
    }

  } catch (error) {
    console.error('Error processing monster turns:', error);
  }
}