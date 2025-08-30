const WebSocketService = require('../lib/websocket');

// Simple in-memory storage for testing
let testPlayers = {};

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const ws = new WebSocketService(event);
  
  try {
    const body = JSON.parse(event.body);
    const { direction, sequence } = body;
    
    console.log(`Test PlayerMove: direction=${direction}, sequence=${sequence}`);
    
    // Initialize player if not exists
    if (!testPlayers[connectionId]) {
      testPlayers[connectionId] = {
        id: connectionId,
        name: 'TestPlayer',
        x: 2,
        y: 2,
        hp: 100,
        maxHp: 100
      };
    }
    
    const player = testPlayers[connectionId];
    
    // Calculate new position
    let newX = player.x;
    let newY = player.y;
    
    switch (direction) {
      case 'up':
      case 'w':
        newY = Math.max(1, player.y - 1);
        break;
      case 'down':
      case 's':
        newY = Math.min(3, player.y + 1);
        break;
      case 'left':
      case 'a':
        newX = Math.max(1, player.x - 1);
        break;
      case 'right':
      case 'd':
        newX = Math.min(3, player.x + 1);
        break;
    }
    
    // Update player position
    player.x = newX;
    player.y = newY;
    
    console.log(`Player moved to (${newX}, ${newY})`);
    
    // Send updated game state
    const testGameState = {
      type: 'gameState',
      data: {
        roomCode: 'TEST',
        currentLevel: 1,
        dungeon: [
          ['#', '#', '#', '#', '#'],
          ['#', '.', '.', '.', '#'],
          ['#', '.', '.', '.', '#'],
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
          x: newX,
          y: newY,
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
      type: 'message',
      data: {
        text: `Moved ${direction} to (${newX}, ${newY})`,
        color: 'cyan'
      }
    });
    
    return {
      statusCode: 200,
      body: 'Test move processed'
    };
  } catch (error) {
    console.error('Test player move error:', error);
    
    await ws.sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to process test move'
    });
    
    return {
      statusCode: 500,
      body: 'Failed to process test move'
    };
  }
};