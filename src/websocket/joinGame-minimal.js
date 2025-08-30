const dynamodb = require('../lib/dynamodb');
const WebSocketService = require('../lib/websocket');

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const ws = new WebSocketService(event);
  
  console.log('Minimal joinGame handler called for:', connectionId);
  
  try {
    const body = JSON.parse(event.body);
    const { name, roomCode = 'DEFAULT' } = body;
    const characterClass = body.class || 'fighter';
    
    // Use a simple gameId
    const gameId = `game_${roomCode.toUpperCase()}`;
    
    // Try to get existing game, create if doesn't exist
    let game;
    try {
      game = await dynamodb.getGame(gameId);
      if (!game) {
        console.log('Creating new game:', gameId);
        game = await dynamodb.createGame(gameId, roomCode.toUpperCase());
      }
    } catch (error) {
      console.log('Error with game, creating simple test game:', error);
      // Fallback to test game if database fails
      const testGameState = {
        type: 'gameState',
        data: {
          roomCode: roomCode.toUpperCase(),
          currentLevel: 1,
          dungeon: [
            ['#', '#', '#', '#', '#', '#', '#'],
            ['#', '.', '.', '.', '.', '.', '#'],
            ['#', '.', '@', '.', '.', '.', '#'],
            ['#', '.', '.', '.', '.', '.', '#'],
            ['#', '.', '.', '.', '.', '.', '#'],
            ['#', '.', '.', '.', '.', '.', '#'],
            ['#', '#', '#', '#', '#', '#', '#']
          ],
          monsters: [],
          items: [],
          features: [],
          players: [{
            id: connectionId,
            name: name || 'Player',
            class: characterClass,
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
        data: { text: `Welcome ${name}! (Fallback mode)`, color: 'yellow' }
      });
      
      return { statusCode: 200, body: 'Fallback game created' };
    }
    
    // Save connection
    await dynamodb.saveConnection(connectionId, gameId);
    
    // Create player
    const player = {
      id: connectionId,
      name: name || 'Player',
      class: characterClass,
      className: 'Fighter',
      x: 10, // Starting position in real dungeon
      y: 10,
      hp: 100,
      maxHp: 100,
      level: 1,
      inventory: [],
      gold: 0,
      experience: 0,
      armor: 0,
      symbol: '@',
      gameId: gameId
    };
    
    // Save player
    await dynamodb.savePlayer(connectionId, gameId, player);
    
    // Get all players
    const players = await dynamodb.getPlayersByGame(gameId);
    const gameConnections = players.map(p => p.playerId);
    
    // Send real game state
    const level1 = game.levels[1] || game.levels["1"];
    const gameState = {
      roomCode: game.roomCode,
      currentLevel: 1,
      dungeon: level1.dungeon,
      monsters: level1.monsters,
      items: level1.items,
      features: level1.features,
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
        experience: p.experience || 0,
        armor: p.armor || 0
      }))
    };
    
    // Broadcast to all players
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
    
    // Send connection ID and welcome
    await ws.sendToConnection(connectionId, {
      type: 'connectionId',
      data: { connectionId: connectionId }
    });
    
    await ws.sendToConnection(connectionId, {
      type: 'message',
      data: {
        text: `Welcome to the dungeon, ${name}!`,
        color: 'yellow'
      }
    });
    
    console.log(`${name} joined room "${game.roomCode}"`);
    
    return {
      statusCode: 200,
      body: 'Joined game'
    };
  } catch (error) {
    console.error('Minimal join game error:', error);
    
    await ws.sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to join game'
    });
    
    return {
      statusCode: 500,
      body: 'Failed to join game'
    };
  }
};