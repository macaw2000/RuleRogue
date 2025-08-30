const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const oneHourAgo = now - (60 * 60); // 1 hour ago
    
    console.log('Starting cleanup of inactive games and connections...');
    
    // Clean up old connections (fallback for TTL)
    const connectionsResult = await docClient.send(new ScanCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      FilterExpression: 'attribute_exists(connectedAt) AND connectedAt < :oneHourAgo',
      ExpressionAttributeValues: {
        ':oneHourAgo': new Date(oneHourAgo * 1000).toISOString()
      }
    }));
    
    if (connectionsResult.Items && connectionsResult.Items.length > 0) {
      console.log(`Cleaning up ${connectionsResult.Items.length} old connections`);
      
      for (const connection of connectionsResult.Items) {
        await docClient.send(new DeleteCommand({
          TableName: process.env.CONNECTIONS_TABLE,
          Key: { connectionId: connection.connectionId }
        }));
      }
    }
    
    // Clean up old games (fallback for TTL)
    const gamesResult = await docClient.send(new ScanCommand({
      TableName: process.env.GAMES_TABLE,
      FilterExpression: 'attribute_exists(lastActivity) AND lastActivity < :oneHourAgo',
      ExpressionAttributeValues: {
        ':oneHourAgo': new Date(oneHourAgo * 1000).toISOString()
      }
    }));
    
    if (gamesResult.Items && gamesResult.Items.length > 0) {
      console.log(`Cleaning up ${gamesResult.Items.length} inactive games`);
      
      for (const game of gamesResult.Items) {
        await docClient.send(new DeleteCommand({
          TableName: process.env.GAMES_TABLE,
          Key: { gameId: game.gameId }
        }));
      }
    }
    
    // Clean up old players (fallback for TTL)
    const playersResult = await docClient.send(new ScanCommand({
      TableName: process.env.PLAYERS_TABLE,
      FilterExpression: 'attribute_exists(lastSeen) AND lastSeen < :oneHourAgo',
      ExpressionAttributeValues: {
        ':oneHourAgo': new Date(oneHourAgo * 1000).toISOString()
      }
    }));
    
    if (playersResult.Items && playersResult.Items.length > 0) {
      console.log(`Cleaning up ${playersResult.Items.length} inactive players`);
      
      for (const player of playersResult.Items) {
        await docClient.send(new DeleteCommand({
          TableName: process.env.PLAYERS_TABLE,
          Key: { playerId: player.playerId }
        }));
      }
    }
    
    console.log('Cleanup completed successfully');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Cleanup completed',
        connectionsRemoved: connectionsResult.Items?.length || 0,
        gamesRemoved: gamesResult.Items?.length || 0,
        playersRemoved: playersResult.Items?.length || 0
      })
    };
  } catch (error) {
    console.error('Cleanup error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Cleanup failed',
        message: error.message
      })
    };
  }
};