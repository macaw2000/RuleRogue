const dynamodb = require('../lib/dynamodb-clean');
const WebSocketService = require('../lib/websocket');

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const ws = new WebSocketService(event);
  
  try {
    console.log(`Pickup item request from: ${connectionId}`);
    
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
    const levelData = game.levels[currentLevel.toString()];
    
    // Find item at player's position
    const item = levelData.items.find(i => i.x === player.x && i.y === player.y);
    
    if (!item) {
      await ws.sendToConnection(connectionId, {
        type: 'message',
        data: {
          text: 'There is nothing here to pick up.',
          color: 'gray'
        }
      });
      return { statusCode: 200, body: 'No item to pick up' };
    }
    
    // Pick up the item
    const currentInventory = player.inventory || [];
    currentInventory.push(item);
    
    // Update player inventory
    const updatedPlayer = { ...player, inventory: currentInventory };
    await dynamodb.savePlayer(connectionId, player.gameId, updatedPlayer);
    
    // Remove item from level
    levelData.items = levelData.items.filter(i => i.id !== item.id);
    await dynamodb.updateGame(game.gameId, {
      [`levels.${currentLevel}.items`]: levelData.items
    });
    
    // Send pickup message
    await ws.sendToConnection(connectionId, {
      type: 'message',
      data: {
        text: `You picked up ${item.name}!`,
        color: 'green'
      }
    });
    
    // Send updated game state to all players
    const players = await dynamodb.getPlayersByGame(player.gameId);
    const gameConnections = players.map(p => p.playerId);
    
    const gameState = {
      roomCode: game.roomCode,
      currentLevel: currentLevel,
      dungeon: levelData.dungeon,
      monsters: levelData.monsters,
      items: levelData.items,
      features: levelData.features,
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
        inventory: p.playerId === connectionId ? currentInventory : (p.inventory || []),
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
        console.error(`Failed to send game state to ${connId}:`, error);
      }
    }
    
    console.log(`Player picked up ${item.name}`);
    
    return {
      statusCode: 200,
      body: 'Item picked up'
    };
  } catch (error) {
    console.error('Pickup item error:', error);
    
    await ws.sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to pick up item'
    });
    
    return {
      statusCode: 500,
      body: 'Failed to pick up item'
    };
  }
};