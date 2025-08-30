const dynamodb = require('../lib/dynamodb');
const WebSocketService = require('../lib/websocket');

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const ws = new WebSocketService(event);
  
  try {
    const body = JSON.parse(event.body);
    const { direction, useStairs, sequence } = body;
    
    console.log(`PlayerMove received: direction=${direction}, useStairs=${useStairs}, sequence=${sequence}`);
    
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
    
    // Calculate new position
    const newPos = dynamodb.getNewPosition(player.x, player.y, direction);
    
    // Check for monsters at new position
    let monster = levelData.monsters.find(m => m.x === newPos.x && m.y === newPos.y && m.hp > 0);
    
    console.log(`Player ${connectionId} moving from (${player.x}, ${player.y}) to (${newPos.x}, ${newPos.y})`);
    console.log(`Monster found:`, monster ? `${monster.name} at (${monster.x}, ${monster.y})` : 'None');
    
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
      }
      
      // Update game state
      await dynamodb.updateGame(player.gameId, {
        [`levels.${currentLevel}.monsters`]: levelData.monsters
      });
      
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