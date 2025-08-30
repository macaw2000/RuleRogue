const dynamodb = require('../lib/dynamodb-clean');
const WebSocketService = require('../lib/websocket');

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const ws = new WebSocketService(event);
  
  console.log('Final joinGame handler called for:', connectionId);
  
  try {
    const body = JSON.parse(event.body);
    const { name, roomCode = 'DEFAULT', createRoom = false } = body;
    const characterClass = body.class || 'fighter';
    
    let gameId;
    let game;
    
    if (createRoom) {
      // Create new game with generated room code
      const newRoomCode = dynamodb.generateRoomCode();
      gameId = `game_${newRoomCode}_${Date.now()}`;
      game = await dynamodb.createGame(gameId, newRoomCode);
      console.log(`Created new game with room code: ${newRoomCode}`);
    } else if (roomCode && roomCode !== 'DEFAULT') {
      // Try to find existing game by room code
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
      // Default game
      gameId = 'default_game';
      game = await dynamodb.getGame(gameId);
      if (!game) {
        game = await dynamodb.createGame(gameId, 'DEFAULT');
        console.log('Created default game');
      }
    }
    
    // Save connection
    await dynamodb.saveConnection(connectionId, gameId);
    
    // Get starting position on level 1
    const level1 = game.levels["1"];
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
    
    // Create player
    const player = {
      id: connectionId,
      name: name || `Player${Date.now()}`,
      characterClass: characterClass,
      className: characterClass === 'fighter' ? 'Fighter' : 
                 characterClass === 'wizard' ? 'Wizard' :
                 characterClass === 'rogue' ? 'Rogue' : 'Cleric',
      x: finalPos.x,
      y: finalPos.y,
      hp: characterClass === 'fighter' ? 120 : characterClass === 'wizard' ? 80 : 100,
      maxHp: characterClass === 'fighter' ? 120 : characterClass === 'wizard' ? 80 : 100,
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
    
    // Update game activity
    await dynamodb.updateGameActivity(gameId);
    
    // Get all players in the game
    const players = await dynamodb.getPlayersByGame(gameId);
    const gameConnections = players.map(p => p.playerId);
    
    // Send game state to all players
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
    
    // Send gameState to the new player first
    await ws.sendToConnection(connectionId, {
      type: 'gameState',
      data: gameState
    });
    
    // Broadcast to other players (excluding the current one)
    for (const connId of gameConnections) {
      if (connId !== connectionId) {
        try {
          await ws.sendToConnection(connId, {
            type: 'gameState',
            data: gameState
          });
        } catch (error) {
          console.error(`Failed to send to ${connId}:`, error);
        }
      }
    }
    
    // Send connection ID and welcome messages
    await ws.sendToConnection(connectionId, {
      type: 'connectionId',
      data: { connectionId: connectionId }
    });
    
    await ws.sendToConnection(connectionId, {
      type: 'message',
      data: {
        text: `Welcome to the dungeon, ${name} the ${player.className}!`,
        color: 'yellow'
      }
    });
    
    await ws.sendToConnection(connectionId, {
      type: 'message',
      data: {
        text: `Use WASD or arrow keys to move. Fight monsters and collect treasure!`,
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
    
    console.log(`${name} the ${player.className} joined room "${game.roomCode}" (${gameId})`);
    
    return {
      statusCode: 200,
      body: 'Joined final game'
    };
  } catch (error) {
    console.error('Final join game error:', error);
    
    await ws.sendToConnection(connectionId, {
      type: 'error',
      message: `Failed to join game: ${error.message}`
    });
    
    return {
      statusCode: 500,
      body: 'Failed to join final game'
    };
  }
};