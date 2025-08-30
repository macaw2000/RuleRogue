const dynamodb = require('../lib/dynamodb');
const WebSocketService = require('../lib/websocket');

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const ws = new WebSocketService(event);
  
  console.log('JoinGame handler called for:', connectionId);
  console.log('Request body:', event.body);
  
  try {
    const body = JSON.parse(event.body);
    const { 
      name, 
      roomCode,
      createRoom = false,
      class: characterClass = 'fighter',
      className = 'Fighter',
      hp = 100,
      maxHp = 100,
      symbol = '@'
    } = body;
    
    let game;
    let gameId;
    
    if (createRoom) {
      // Create new game with generated room code
      const newRoomCode = dynamodb.generateRoomCode();
      gameId = `game_${newRoomCode}_${Date.now()}`;
      game = await dynamodb.createGame(gameId, newRoomCode);
      
      console.log(`Created new game with room code: ${newRoomCode}`);
    } else if (roomCode) {
      // Join existing game by room code, or create new one if it doesn't exist
      game = await dynamodb.findGameByRoomCode(roomCode.toUpperCase());
      if (!game) {
        // Create new game with the specified room code
        gameId = `game_${roomCode.toUpperCase()}_${Date.now()}`;
        game = await dynamodb.createGame(gameId, roomCode.toUpperCase());
        console.log(`Created new game with room code: ${roomCode.toUpperCase()}`);
      } else {
        gameId = game.gameId;
        console.log(`Joined existing game with room code: ${roomCode.toUpperCase()}`);
      }
    } else {
      // Default room for testing - allow empty room code
      gameId = 'default';
      game = await dynamodb.getGame(gameId);
      if (!game) {
        game = await dynamodb.createGame(gameId, 'DEFAULT');
      }
    }
    
    // Update connection with game ID
    await dynamodb.saveConnection(connectionId, gameId);
    
    // Get starting position on level 1
    const level1 = game.levels[1] || game.levels["1"];
    const startingPos = dynamodb.getStartingPosition(level1);
    
    // Check for existing players to avoid overlap
    const existingPlayers = await dynamodb.getPlayersByGame(gameId);
    const occupiedPositions = existingPlayers.map(p => `${p.x},${p.y},${p.level || 1}`);
    
    // Find alternative position if starting position is occupied
    let finalPos = startingPos;
    if (occupiedPositions.includes(`${startingPos.x},${startingPos.y},1`)) {
      // Try nearby positions
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const testX = startingPos.x + dx;
          const testY = startingPos.y + dy;
          if (!occupiedPositions.includes(`${testX},${testY},1`) && 
              dynamodb.isValidMove(testX, testY, level1.dungeon)) {
            finalPos = { x: testX, y: testY };
            break;
          }
        }
        if (finalPos !== startingPos) break;
      }
    }
    
    // Create player with NetHack-style attributes
    const player = {
      id: connectionId,
      name: name || `Player${Date.now()}`,
      class: characterClass,
      className: className,
      x: finalPos.x,
      y: finalPos.y,
      hp: hp,
      maxHp: maxHp,
      level: 1, // Start on dungeon level 1
      inventory: [],
      gold: 0,
      experience: 0,
      armor: 0,
      symbol: symbol,
      gameId: gameId
    };
    
    // Save player to database
    await dynamodb.savePlayer(connectionId, gameId, player);
    
    // Update game activity
    await dynamodb.updateGameActivity(gameId);
    
    // Get all players in the game
    const players = await dynamodb.getPlayersByGame(gameId);
    
    // Get all connections for this game
    const gameConnections = players.map(p => p.playerId);
    
    // Send game state to all players
    const currentLevel = game.levels[1] || game.levels["1"];
    const gameState = {
      roomCode: game.roomCode,
      currentLevel: 1,
      dungeon: currentLevel.dungeon,
      monsters: currentLevel.monsters,
      items: currentLevel.items,
      features: currentLevel.features,
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
    
    await ws.broadcastToGame(gameConnections, {
      type: 'gameState',
      data: gameState
    });
    
    // Send connection ID to the new player so they can identify themselves
    await ws.sendToConnection(connectionId, {
      type: 'connectionId',
      data: { connectionId: connectionId }
    });
    
    // Send welcome message to new player
    await ws.sendToConnection(connectionId, {
      type: 'message',
      data: {
        text: `Welcome to the dungeon, ${name} the ${className}!`,
        color: 'yellow'
      }
    });
    
    // Send gameplay instructions
    await ws.sendToConnection(connectionId, {
      type: 'message',
      data: {
        text: `Use WASD or arrow keys to move. Walk onto stairs (< >) to travel between levels!`,
        color: 'cyan'
      }
    });
    
    if (createRoom) {
      await ws.sendToConnection(connectionId, {
        type: 'message',
        data: {
          text: `Room code: ${game.roomCode} - Share this with friends to play together!`,
          color: 'cyan'
        }
      });
    }
    
    console.log(`${name} the ${className} joined room "${game.roomCode}" (${gameId})`);
    
    return {
      statusCode: 200,
      body: 'Joined game'
    };
  } catch (error) {
    console.error('Join game error:', error);
    
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