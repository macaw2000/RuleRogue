const dynamodb = require('../lib/dynamodb-clean');
const WebSocketService = require('../lib/websocket');

exports.handler = async (event) => {
  const ws = new WebSocketService(event);
  
  try {
    console.log('Monster AI tick starting...');
    
    // Get all active games (simplified - just get default game for now)
    const game = await dynamodb.getGame('default_game');
    if (!game) {
      console.log('No default game found');
      return { statusCode: 200, body: 'No game to process' };
    }
    
    const level1 = game.levels["1"];
    if (!level1 || !level1.monsters) {
      console.log('No monsters to process');
      return { statusCode: 200, body: 'No monsters' };
    }
    
    // Get all players in the game
    const players = await dynamodb.getPlayersByGame('default_game');
    if (players.length === 0) {
      console.log('No players in game');
      return { statusCode: 200, body: 'No players' };
    }
    
    let monstersUpdated = false;
    const updatedMonsters = [...level1.monsters];
    
    // Move each living monster toward nearest player
    updatedMonsters.forEach(monster => {
      if (monster.hp <= 0) return;
      
      // Find nearest player
      let nearestPlayer = null;
      let nearestDistance = Infinity;
      
      players.forEach(player => {
        const distance = Math.abs(player.x - monster.x) + Math.abs(player.y - monster.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPlayer = player;
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
      if (dynamodb.isValidMove(newX, newY, level1.dungeon)) {
        const blocked = players.some(p => p.x === newX && p.y === newY) ||
                       updatedMonsters.some(m => m.id !== monster.id && m.x === newX && m.y === newY && m.hp > 0);
        
        if (!blocked) {
          monster.x = newX;
          monster.y = newY;
          monstersUpdated = true;
          console.log(`Monster ${monster.name} moved to (${newX}, ${newY})`);
        }
      }
    });
    
    // Update game if monsters moved
    if (monstersUpdated) {
      await dynamodb.updateGame('default_game', {
        'levels.1.monsters': updatedMonsters
      });
      
      // Send updated game state to all players
      const gameConnections = players.map(p => p.playerId);
      
      const gameState = {
        roomCode: game.roomCode,
        currentLevel: 1,
        dungeon: level1.dungeon,
        monsters: updatedMonsters,
        items: level1.items,
        features: level1.features,
        players: players.map(p => ({
          id: p.playerId,
          name: p.name,
          class: p.characterClass || 'fighter',
          className: p.className || 'Fighter',
          x: p.x,
          y: p.y,
          hp: p.hp,
          maxHp: p.maxHp,
          level: p.level || 1,
          symbol: p.symbol || '@',
          inventory: p.inventory || [],
          gold: p.gold || 0,
          experience: p.experience || 0,
          armor: p.armor || 0
        }))
      };
      
      // Send to all connected players
      for (const connId of gameConnections) {
        try {
          await ws.sendToConnection(connId, {
            type: 'gameState',
            data: gameState
          });
        } catch (error) {
          console.error(`Failed to send to ${connId}:`, error);
        }
      }
      
      console.log(`Monster AI updated ${updatedMonsters.filter(m => m.hp > 0).length} monsters`);
    }
    
    return {
      statusCode: 200,
      body: 'Monster AI processed'
    };
  } catch (error) {
    console.error('Monster AI error:', error);
    return {
      statusCode: 500,
      body: 'Monster AI failed'
    };
  }
};