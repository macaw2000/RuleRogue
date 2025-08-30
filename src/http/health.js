const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    // Get active connections count
    const connectionsResult = await docClient.send(new ScanCommand({
      TableName: process.env.CONNECTIONS_TABLE || 'multiplayer-roguelike-connections-prod',
      Select: 'COUNT'
    }));
    
    // Get active games count
    const gamesResult = await docClient.send(new ScanCommand({
      TableName: process.env.GAMES_TABLE || 'multiplayer-roguelike-games-prod',
      Select: 'COUNT'
    }));
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      activeConnections: connectionsResult.Count || 0,
      activeGames: gamesResult.Count || 0,
      version: '1.0.0'
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(healthData)
    };
  } catch (error) {
    console.error('Health check error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};