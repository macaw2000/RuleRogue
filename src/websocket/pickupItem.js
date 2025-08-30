const dynamodb = require('../lib/dynamodb');
const WebSocketService = require('../lib/websocket');

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const ws = new WebSocketService(event);
  

  
  try {
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
    
    // Find items at player's current position
    const itemsHere = levelData.items.filter(item => item.x === player.x && item.y === player.y);
    
    if (itemsHere.length === 0) {
      await ws.sendToConnection(connectionId, {
        type: 'message',
        data: {
          text: 'There is nothing here to pick up.',
          color: 'gray'
        }
      });
      return { statusCode: 200, body: 'No items to pick up' };
    }
    
    // Pick up all items at this location
    const inventory = player.inventory || [];
    let pickedUpItems = [];
    
    // Remove items from level and add to inventory (or gold to purse)
    let goldCollected = 0;
    
    for (const item of itemsHere) {
      const itemIndex = levelData.items.findIndex(i => i.id === item.id);
      if (itemIndex !== -1) {
        levelData.items.splice(itemIndex, 1);
        
        if (item.type === 'gold') {
          // Add gold to player's purse instead of inventory
          goldCollected += item.amount;
        } else {
          // Add regular items to inventory
          inventory.push(item);
        }
        pickedUpItems.push(item);
      }
    }
    
    if (pickedUpItems.length === 0) {
      await ws.sendToConnection(connectionId, {
        type: 'message',
        data: {
          text: 'Failed to pick up items.',
          color: 'red'
        }
      });
      return { statusCode: 500, body: 'Failed to pick up items' };
    }
    
    // Update player inventory and gold
    const updates = { inventory };
    if (goldCollected > 0) {
      updates.gold = (player.gold || 0) + goldCollected;
    }
    await dynamodb.updatePlayer(connectionId, updates);
    
    // Update game state immediately
    try {
      await dynamodb.updateGame(player.gameId, {
        [`levels.${currentLevel}.items`]: levelData.items
      });
      // Force a full game state broadcast to ensure all clients get the update
      const updatedGame = await dynamodb.getGame(player.gameId);
      await broadcastGameState(ws, updatedGame, player.gameId, currentLevel);
    } catch (dbError) {
      console.error('Failed to save item pickup to database:', dbError);
    }
    
    // Send pickup messages
    const regularItems = pickedUpItems.filter(item => item.type !== 'gold');
    
    if (goldCollected > 0) {
      await ws.sendToConnection(connectionId, {
        type: 'message',
        data: {
          text: `You pick up ${goldCollected} gold pieces.`,
          color: 'yellow'
        }
      });
    }
    
    if (regularItems.length === 1) {
      await ws.sendToConnection(connectionId, {
        type: 'message',
        data: {
          text: `You pick up ${regularItems[0].name}.`,
          color: 'green'
        }
      });
    } else if (regularItems.length > 1) {
      const itemNames = regularItems.map(item => item.name).join(', ');
      await ws.sendToConnection(connectionId, {
        type: 'message',
        data: {
          text: `You pick up: ${itemNames}.`,
          color: 'green'
        }
      });
    }
    
    return {
      statusCode: 200,
      body: 'Items picked up'
    };
  } catch (error) {
    console.error('Pickup error:', error);
    
    await ws.sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to pick up items'
    });
    
    return {
      statusCode: 500,
      body: 'Failed to pick up items'
    };
  }
};

// Helper function to broadcast game state (copied from playerMove.js)
async function broadcastGameState(ws, game, gameId, levelNum) {
  const dynamodb = require('../lib/dynamodb');
  const players = await dynamodb.getPlayersByGame(gameId);
  const gameConnections = players.map(p => p.playerId);
  const levelData = game.levels[levelNum] || game.levels[levelNum.toString()];
  
  const gameState = {
    roomCode: game.roomCode,
    currentLevel: levelNum,
    dungeon: levelData.dungeon,
    monsters: levelData.monsters.filter(m => m.hp > 0), // Only show living monsters
    items: levelData.items,
    features: levelData.features,
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
      armor: p.armor || 0,
      equippedWeapon: p.equippedWeapon,
      equippedArmor: p.equippedArmor
    })).filter(p => (p.level || 1) === levelNum) // Only show players on current level
  };
  
  await ws.broadcastToGame(gameConnections, {
    type: 'gameState',
    data: gameState
  });
}