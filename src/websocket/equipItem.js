const dynamodb = require('../lib/dynamodb');
const WebSocketService = require('../lib/websocket');

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const ws = new WebSocketService(event);
  
  try {
    const body = JSON.parse(event.body);
    const { itemIndex, itemType } = body;
    
    // Get player
    const player = await dynamodb.getPlayer(connectionId);
    if (!player) {
      await ws.sendToConnection(connectionId, {
        type: 'error',
        message: 'Player not found'
      });
      return { statusCode: 404, body: 'Player not found' };
    }
    
    // Validate item index
    const inventory = player.inventory || [];
    if (itemIndex < 0 || itemIndex >= inventory.length) {
      await ws.sendToConnection(connectionId, {
        type: 'error',
        message: 'Invalid item'
      });
      return { statusCode: 400, body: 'Invalid item' };
    }
    
    const item = inventory[itemIndex];
    
    // Validate item type
    if (item.type !== itemType || (itemType !== 'weapon' && itemType !== 'armor' && itemType !== 'lantern' && itemType !== 'lamp')) {
      await ws.sendToConnection(connectionId, {
        type: 'error',
        message: 'Cannot equip this item'
      });
      return { statusCode: 400, body: 'Cannot equip this item' };
    }
    
    // Update player equipment
    const updates = {};
    if (itemType === 'weapon') {
      updates.equippedWeapon = item;
    } else if (itemType === 'armor') {
      updates.equippedArmor = item;
    } else if (itemType === 'lantern' || itemType === 'lamp') {
      updates.equippedLight = item;
    }
    
    await dynamodb.updatePlayer(connectionId, updates);
    
    // Send confirmation
    await ws.sendToConnection(connectionId, {
      type: 'message',
      data: {
        text: `You ${itemType === 'weapon' ? 'wield' : 'wear'} the ${item.name}.`,
        color: 'green'
      }
    });
    
    // Send updated player stats to all players
    const players = await dynamodb.getPlayersByGame(player.gameId);
    const gameConnections = players.map(p => p.playerId);
    
    const updatedPlayer = await dynamodb.getPlayer(connectionId);
    const playerUpdateMessage = {
      type: 'playerUpdate',
      data: {
        id: connectionId,
        equippedWeapon: updatedPlayer.equippedWeapon,
        equippedArmor: updatedPlayer.equippedArmor
      }
    };
    
    for (const connId of gameConnections) {
      try {
        await ws.sendToConnection(connId, playerUpdateMessage);
      } catch (error) {
        console.error(`Failed to send equipment update to ${connId}:`, error);
      }
    }
    
    return {
      statusCode: 200,
      body: 'Item equipped'
    };
  } catch (error) {
    console.error('Equipment error:', error);
    
    await ws.sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to equip item'
    });
    
    return {
      statusCode: 500,
      body: 'Failed to equip item'
    };
  }
};