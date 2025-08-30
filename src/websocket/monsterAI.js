const dynamodb = require('../lib/dynamodb');
const WebSocketService = require('../lib/websocket');

// Independent Monster AI System - runs every few seconds
exports.handler = async (event, context) => {
  // For scheduled events, create a WebSocket service with the correct endpoint
  const mockEvent = {
    requestContext: {
      domainName: 'm7usyjkjgd.execute-api.us-east-1.amazonaws.com',
      stage: 'prod'
    }
  };
  const ws = new WebSocketService(mockEvent);
  
  try {
    // Get all active games
    const games = await dynamodb.getAllActiveGames();
    
    for (const game of games) {
      await processGameMonsters(ws, game);
    }
    
    return { statusCode: 200, body: 'Monster AI processed' };
  } catch (error) {
    console.error('Monster AI error:', error);
    return { statusCode: 500, body: 'Monster AI failed' };
  }
};

// Process monsters for a single game
async function processGameMonsters(ws, game) {
  if (!game.levels) return;
  
  let gameChanged = false;
  
  // Process each level
  for (const [levelNum, levelData] of Object.entries(game.levels)) {
    if (!levelData.monsters || levelData.monsters.length === 0) continue;
    
    // Get players on this level
    const playersOnLevel = game.players.filter(p => p.level === parseInt(levelNum));
    if (playersOnLevel.length === 0) continue; // No players, monsters don't act
    
    let levelChanged = false;
    
    // Process each monster
    for (const monster of levelData.monsters) {
      if (monster.hp <= 0) continue; // Skip dead monsters
      
      // Find nearest player
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
      
      // Monster behavior - make more aggressive
      const monsterStats = getMonsterStats(monster.symbol);
      const detectionRange = monsterStats.detectionRange;
      
      // Check if monster can see the player (more generous detection)
      const canSeePlayer = nearestDistance <= detectionRange;
      
      // Monster AI logic - more aggressive
      if (canSeePlayer || monster.isChasing || nearestDistance <= 2) {
        monster.isChasing = true;
        
        // Check if adjacent - ATTACK!
        const dx = nearestPlayer.x - monster.x;
        const dy = nearestPlayer.y - monster.y;
        const isAdjacent = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0);
        
        if (isAdjacent) {
          // Monster attacks player
          const damage = Math.floor(Math.random() * monster.damage) + 1;
          const newHp = Math.max(0, nearestPlayer.hp - damage);
          
          // Update player HP in game state
          nearestPlayer.hp = newHp;
          gameChanged = true;
          
          // Send attack message
          await ws.sendToConnection(nearestPlayer.id, {
            type: 'message',
            data: {
              text: `The ${monster.name} attacks you for ${damage} damage!`,
              color: 'red'
            }
          });
          
          // Update player stats
          await ws.sendToConnection(nearestPlayer.id, {
            type: 'playerUpdate',
            data: {
              id: nearestPlayer.id,
              hp: newHp
            }
          });
          
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
          
          // Notify other players
          for (const otherPlayer of playersOnLevel) {
            if (otherPlayer.id !== nearestPlayer.id) {
              await ws.sendToConnection(otherPlayer.id, {
                type: 'message',
                data: {
                  text: `The ${monster.name} attacks ${nearestPlayer.name}!`,
                  color: 'orange'
                }
              });
            }
          }
          
        } else {
          // Try to move toward player
          let newX = monster.x;
          let newY = monster.y;
          
          // Simple pathfinding - move toward player
          if (Math.abs(dx) > Math.abs(dy)) {
            newX += dx > 0 ? 1 : -1;
          } else if (dy !== 0) {
            newY += dy > 0 ? 1 : -1;
          }
          
          // Check if move is valid
          if (dynamodb.isValidMove(newX, newY, levelData.dungeon)) {
            // Check for player collision
            const playerAtTarget = playersOnLevel.find(p => p.x === newX && p.y === newY);
            if (!playerAtTarget) {
              // Check for monster collision
              const monsterAtTarget = levelData.monsters.find(m => 
                m.id !== monster.id && m.x === newX && m.y === newY && m.hp > 0
              );
              
              if (!monsterAtTarget) {
                // Valid move
                monster.x = newX;
                monster.y = newY;
                levelChanged = true;
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
    
    if (levelChanged) {
      gameChanged = true;
      
      // Send monster updates to all players on this level
      for (const player of playersOnLevel) {
        await ws.sendToConnection(player.id, {
          type: 'gameState',
          data: {
            ...game,
            currentLevel: parseInt(levelNum)
          }
        });
      }
    }
  }
  
  // Update database if game changed
  if (gameChanged) {
    await dynamodb.updateGame(game.gameId, game);
  }
}

// Monster stats and behavior - more aggressive
function getMonsterStats(symbol) {
  const stats = {
    'r': { detectionRange: 5, aggressive: true, name: 'rat' },
    'g': { detectionRange: 6, aggressive: true, name: 'goblin' },
    'o': { detectionRange: 7, aggressive: true, name: 'orc' },
    'k': { detectionRange: 5, aggressive: true, name: 'kobold' },
    's': { detectionRange: 6, aggressive: true, name: 'snake' },
    'z': { detectionRange: 8, aggressive: true, name: 'zombie' },
    'T': { detectionRange: 10, aggressive: true, name: 'troll' }
  };
  return stats[symbol] || { detectionRange: 6, aggressive: true, name: 'monster' };
}

// Line of sight calculation
function hasLineOfSight(x1, y1, x2, y2, dungeon) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  
  let x = x1;
  let y = y1;
  
  while (true) {
    if (x === x2 && y === y2) return true;
    
    if (y >= 0 && y < dungeon.length && x >= 0 && x < dungeon[0].length) {
      const cell = dungeon[y][x];
      if (cell === '-' || cell === '|') return false;
    }
    
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}