const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

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
  
  console.log('Clean joinGame handler called for:', connectionId);
  
  try {
    const body = JSON.parse(event.body);
    const { name } = body;
    const characterClass = body.class || 'fighter';
    
    // Create a larger test dungeon
    const testDungeon = [
      ['#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#'],
      ['#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#'],
      ['#', '.', '#', '#', '.', '.', '.', '#', '#', '#', '.', '.', '#', '.', '#'],
      ['#', '.', '#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#', '.', '#'],
      ['#', '.', '.', '.', '.', '#', '#', '.', '.', '.', '#', '.', '.', '.', '#'],
      ['#', '.', '.', '.', '.', '#', '.', '.', '@', '.', '#', '.', '.', '.', '#'],
      ['#', '.', '.', '.', '.', '#', '.', '.', '.', '.', '#', '.', '.', '.', '#'],
      ['#', '.', '#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#', '.', '#'],
      ['#', '.', '#', '#', '.', '.', '.', '#', '#', '#', '.', '.', '#', '.', '#'],
      ['#', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '#'],
      ['#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#']
    ];
    
    const gameState = {
      type: 'gameState',
      data: {
        roomCode: 'CLEAN',
        currentLevel: 1,
        dungeon: testDungeon,
        monsters: [
          { id: 'orc1', name: 'orc', symbol: 'o', x: 3, y: 3, hp: 15, maxHp: 15, damage: 4 },
          { id: 'goblin1', name: 'goblin', symbol: 'g', x: 11, y: 7, hp: 8, maxHp: 8, damage: 3 }
        ],
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
          name: name || 'Player',
          class: characterClass,
          className: 'Fighter',
          x: 8,
          y: 5,
          hp: 100,
          maxHp: 100,
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
    
    await sendMessage(connectionId, {
      type: 'connectionId',
      data: { connectionId: connectionId }
    });
    
    await sendMessage(connectionId, {
      type: 'message',
      data: {
        text: `Welcome to the clean test dungeon, ${name}!`,
        color: 'yellow'
      }
    });
    
    await sendMessage(connectionId, {
      type: 'message',
      data: {
        text: 'Use WASD to move. Walk into monsters to fight them!',
        color: 'cyan'
      }
    });
    
    console.log(`${name} joined clean test game`);
    
    return {
      statusCode: 200,
      body: 'Clean test game created'
    };
  } catch (error) {
    console.error('Clean join game error:', error);
    
    await sendMessage(connectionId, {
      type: 'error',
      message: 'Failed to join clean test game'
    });
    
    return {
      statusCode: 500,
      body: 'Failed to join clean test game'
    };
  }
};