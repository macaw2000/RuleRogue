const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

// Simple in-memory storage for the clean test
let cleanPlayers = {};

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  
  // Create WebSocket client
  const client = new ApiGatewayManagementApiClient({
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
    region: process.env.AWS_REGION || 'us-west-2'
  });
  
  const sendMessage = async (connId, message) => {
    try {
      await client.send(new PostToConnectionCommand({
        ConnectionId: connId,
        Data: JSON.stringify(message)
      }));
    } catch (error) {
      console.error(`Failed to send message to ${connId}:`, error);
    }
  };
  
  try {
    const body = JSON.parse(event.body);
    const { direction, sequence } = body;
    
    console.log(`Clean PlayerMove: direction=${direction}, sequence=${sequence}`);
    
    // Initialize player if not exists
    if (!cleanPlayers[connectionId]) {
      cleanPlayers[connectionId] = {
        id: connectionId,
        name: 'Player',
        x: 8,
        y: 5,
        hp: 100,
        maxHp: 100
      };
    }
    
    const player = cleanPlayers[connectionId];
    
    // The clean dungeon layout
    const dungeon = [
      ['#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#'],
      ['#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#'],
      ['#', '.', '#', '#', '.', '.', '.', '#', '#', '#', '.', '.', '#', '.', '#'],
      ['#', '.', '#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#', '.', '#'],
      ['#', '.', '.', '.', '.', '#', '#', '.', '.', '.', '#', '.', '.', '.', '#'],
      ['#', '.', '.', '.', '.', '#', '.', '.', '.', '.', '#', '.', '.', '.', '#'],
      ['#', '.', '.', '.', '.', '#', '.', '.', '.', '.', '#', '.', '.', '.', '#'],
      ['#', '.', '#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#', '.', '#'],
      ['#', '.', '#', '#', '.', '.', '.', '#', '#', '#', '.', '.', '#', '.', '#'],
      ['#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#'],
      ['#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#']
    ];
    
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
    
    // Initialize monsters if not exists
    if (!cleanPlayers.monsters) {
      cleanPlayers.monsters = [
        { id: 'orc1', name: 'orc', symbol: 'o', x: 3, y: 3, hp: 15, maxHp: 15, damage: 4 },
        { id: 'goblin1', name: 'goblin', symbol: 'g', x: 11, y: 7, hp: 8, maxHp: 8, damage: 3 }
      ];
    }
    
    // Check if move is valid (not a wall and within bounds)
    if (newX >= 0 && newX < 15 && newY >= 0 && newY < 11 && dungeon[newY][newX] !== '#') {
      
      // Check for monsters at target position BEFORE moving
      let monster = cleanPlayers.monsters.find(m => m.x === newX && m.y === newY && m.hp > 0);
      
      if (monster) {
        // Combat! Player stays in current position during combat
        // Combat!
        const damage = Math.floor(Math.random() * 8) + 3;
        monster.hp -= damage;
        
        await sendMessage(connectionId, {
          type: 'message',
          data: {
            text: `You hit the ${monster.name} for ${damage} damage!`,
            color: 'red'
          }
        });
        
        if (monster.hp <= 0) {
          await sendMessage(connectionId, {
            type: 'message',
            data: {
              text: `You killed the ${monster.name}!`,
              color: 'green'
            }
          });
          // Remove dead monster from persistent storage
          cleanPlayers.monsters = cleanPlayers.monsters.filter(m => m.id !== monster.id);
          
          // Now player can move into the space
          player.x = newX;
          player.y = newY;
          console.log(`Player moved to (${newX}, ${newY}) after killing monster`);
        } else {
          // Monster attacks back - player stays in place
          const monsterDamage = Math.floor(Math.random() * monster.damage) + 1;
          player.hp = Math.max(0, player.hp - monsterDamage);
          
          await sendMessage(connectionId, {
            type: 'message',
            data: {
              text: `The ${monster.name} hits you for ${monsterDamage} damage!`,
              color: 'red'
            }
          });
          
          console.log(`Player stayed at (${player.x}, ${player.y}) during combat`);
        }
      } else {
        // No monster - normal movement
        player.x = newX;
        player.y = newY;
        console.log(`Player moved to (${newX}, ${newY})`);
      }
      }
      
      // Send updated game state
      const gameState = {
        type: 'gameState',
        data: {
          roomCode: 'CLEAN',
          currentLevel: 1,
          dungeon: dungeon,
          monsters: cleanPlayers.monsters,
          items: [
            { id: 'sword1', name: 'iron sword', symbol: ')', x: 2, y: 8, type: 'weapon', damage: 5 },
            { id: 'potion1', name: 'healing potion', symbol: '!', x: 12, y: 2, type: 'potion', healing: 20 }
          ],
          features: [
            { symbol: '<', x: 7, y: 1, type: 'stairs_up' },
            { symbol: '>', x: 7, y: 9, type: 'stairs_down' }
          ],
          players: [{
            id: connectionId,
            name: player.name,
            class: 'fighter',
            className: 'Fighter',
            x: player.x,
            y: player.y,
            hp: player.hp,
            maxHp: player.maxHp,
            level: 1,
            symbol: '@',
            inventory: [],
            gold: 0,
            experience: 0,
            armor: 0
          }]
        }
      };
      
      await sendMessage(connectionId, gameState);
      
      // Only send movement message if no combat occurred
      if (!monster) {
        await sendMessage(connectionId, {
          type: 'message',
          data: {
            text: `Moved ${direction} to (${player.x}, ${player.y})`,
            color: 'cyan'
          }
        });
      }
    } else {
      await sendMessage(connectionId, {
        type: 'message',
        data: {
          text: `Can't move ${direction} - blocked by wall!`,
          color: 'red'
        }
      });
    }
    
    return {
      statusCode: 200,
      body: 'Clean move processed'
    };
  } catch (error) {
    console.error('Clean player move error:', error);
    
    await sendMessage(connectionId, {
      type: 'error',
      message: 'Failed to process clean move'
    });
    
    return {
      statusCode: 500,
      body: 'Failed to process clean move'
    };
  }
};