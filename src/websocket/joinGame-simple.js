const WebSocketService = require('../lib/websocket');

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const ws = new WebSocketService(event);
  
  console.log('Simple joinGame handler called for:', connectionId);
  
  try {
    // Send a simple test game state
    const testGameState = {
      type: 'gameState',
      data: {
        roomCode: 'TEST',
        currentLevel: 1,
        dungeon: [
          ['#', '#', '#', '#', '#'],
          ['#', '.', '.', '.', '#'],
          ['#', '.', '@', '.', '#'],
          ['#', '.', '.', '.', '#'],
          ['#', '#', '#', '#', '#']
        ],
        monsters: [],
        items: [],
        features: [],
        players: [{
          id: connectionId,
          name: 'TestPlayer',
          class: 'fighter',
          className: 'Fighter',
          x: 2,
          y: 2,
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
    
    await ws.sendToConnection(connectionId, testGameState);
    
    await ws.sendToConnection(connectionId, {
      type: 'connectionId',
      data: { connectionId: connectionId }
    });
    
    await ws.sendToConnection(connectionId, {
      type: 'message',
      data: {
        text: 'Simple test game loaded!',
        color: 'green'
      }
    });
    
    console.log('Simple test game sent successfully');
    
    return {
      statusCode: 200,
      body: 'Simple test game created'
    };
  } catch (error) {
    console.error('Simple join game error:', error);
    
    await ws.sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to create simple test game'
    });
    
    return {
      statusCode: 500,
      body: 'Failed to create simple test game'
    };
  }
};