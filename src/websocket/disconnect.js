const dynamodb = require('../lib/dynamodb');

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  
  try {
    // Get connection info
    const connection = await dynamodb.getConnection(connectionId);
    
    if (connection && connection.gameId) {
      // Remove player from game
      await dynamodb.deletePlayer(connectionId);
      
      // Get remaining players in the game
      const players = await dynamodb.getPlayersByGame(connection.gameId);
      
      // If this was the last player, the game will auto-expire via TTL
      console.log(`Player ${connectionId} left game ${connection.gameId}. ${players.length} players remaining.`);
    }
    
    // Remove connection
    await dynamodb.deleteConnection(connectionId);
    
    console.log('Player disconnected:', connectionId);
    
    return {
      statusCode: 200,
      body: 'Disconnected'
    };
  } catch (error) {
    console.error('Disconnect error:', error);
    return {
      statusCode: 500,
      body: 'Failed to disconnect'
    };
  }
};