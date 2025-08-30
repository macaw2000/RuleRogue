const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const docClient = DynamoDBDocumentClient.from(client);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'multiplayer-roguelike-connections-prod';
const GAMES_TABLE = process.env.GAMES_TABLE || 'multiplayer-roguelike-games-prod';
const PLAYERS_TABLE = process.env.PLAYERS_TABLE || 'multiplayer-roguelike-players-prod';

class CleanDynamoDBService {
  // Connection management
  async saveConnection(connectionId, gameId = null) {
    const ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
    
    await docClient.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        gameId,
        connectedAt: new Date().toISOString(),
        ttl
      }
    }));
  }

  async getConnection(connectionId) {
    const result = await docClient.send(new GetCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }));
    return result.Item;
  }

  async deleteConnection(connectionId) {
    await docClient.send(new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }));
  }

  // Game management
  async createGame(gameId, roomCode) {
    const ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
    
    // Generate a simple but proper dungeon
    const level1 = this.generateSimpleDungeon();
    
    const game = {
      gameId,
      roomCode,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ttl,
      levels: {
        "1": level1
      }
    };
    
    await docClient.send(new PutCommand({
      TableName: GAMES_TABLE,
      Item: game
    }));
    
    return game;
  }

  async getGame(gameId) {
    const result = await docClient.send(new GetCommand({
      TableName: GAMES_TABLE,
      Key: { gameId }
    }));
    return result.Item;
  }

  async findGameByRoomCode(roomCode) {
    const result = await docClient.send(new ScanCommand({
      TableName: GAMES_TABLE,
      FilterExpression: 'roomCode = :roomCode',
      ExpressionAttributeValues: {
        ':roomCode': roomCode
      }
    }));
    
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  }

  // Player management
  async savePlayer(connectionId, gameId, player) {
    const ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
    
    await docClient.send(new PutCommand({
      TableName: PLAYERS_TABLE,
      Item: {
        playerId: connectionId,
        gameId,
        name: player.name,
        characterClass: player.characterClass || 'fighter',
        className: player.className || 'Fighter',
        x: player.x,
        y: player.y,
        hp: player.hp,
        maxHp: player.maxHp,
        level: player.level || 1,
        inventory: player.inventory || [],
        gold: player.gold || 0,
        experience: player.experience || 0,
        armor: player.armor || 0,
        symbol: player.symbol || '@',
        createdAt: new Date().toISOString(),
        ttl
      }
    }));
  }

  async getPlayer(connectionId) {
    const result = await docClient.send(new GetCommand({
      TableName: PLAYERS_TABLE,
      Key: { playerId: connectionId }
    }));
    return result.Item;
  }

  async getPlayersByGame(gameId) {
    const result = await docClient.send(new QueryCommand({
      TableName: PLAYERS_TABLE,
      IndexName: 'GameIndex',
      KeyConditionExpression: 'gameId = :gameId',
      ExpressionAttributeValues: {
        ':gameId': gameId
      }
    }));
    
    return result.Items || [];
  }

  // Utility functions
  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  generateSimpleDungeon() {
    // Create a proper NetHack-style 25x25 dungeon (Level 1 - no doors)
    const width = 25;
    const height = 25;
    
    // Start with all solid rock (space character)
    const dungeon = Array(height).fill().map(() => Array(width).fill(' '));
    
    // Define rooms as rectangles (x, y, width, height)
    const rooms = [
      { x: 2, y: 2, w: 8, h: 5 },    // Top-left room
      { x: 14, y: 1, w: 9, h: 6 },   // Top-right room
      { x: 1, y: 10, w: 7, h: 6 },   // Bottom-left room
      { x: 15, y: 12, w: 8, h: 5 },  // Bottom-right room
      { x: 9, y: 8, w: 6, h: 4 }     // Center room
    ];
    
    // Create each room with proper walls
    rooms.forEach(room => {
      // Fill room interior with floor tiles
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            dungeon[y][x] = '.';
          }
        }
      }
      
      // Add room walls around the perimeter
      // Top and bottom walls (horizontal)
      for (let x = room.x; x < room.x + room.w; x++) {
        if (room.y - 1 >= 0) dungeon[room.y - 1][x] = '-';
        if (room.y + room.h < height) dungeon[room.y + room.h][x] = '-';
      }
      
      // Left and right walls (vertical)
      for (let y = room.y; y < room.y + room.h; y++) {
        if (room.x - 1 >= 0) dungeon[y][room.x - 1] = '|';
        if (room.x + room.w < width) dungeon[y][room.x + room.w] = '|';
      }
      
      // Add proper wall corners (not + symbols!)
      if (room.x - 1 >= 0 && room.y - 1 >= 0) dungeon[room.y - 1][room.x - 1] = '-'; // Top-left
      if (room.x + room.w < width && room.y - 1 >= 0) dungeon[room.y - 1][room.x + room.w] = '-'; // Top-right
      if (room.x - 1 >= 0 && room.y + room.h < height) dungeon[room.y + room.h][room.x - 1] = '-'; // Bottom-left
      if (room.x + room.w < width && room.y + room.h < height) dungeon[room.y + room.h][room.x + room.w] = '-'; // Bottom-right
    });
    
    // Add corridors (# symbols for corridor floors) - NEVER at corners
    // Horizontal corridor from room 1 to room 2 (middle of room walls)
    for (let x = 10; x < 14; x++) {
      dungeon[4][x] = '#';
    }
    
    // Vertical corridor from room 1 to center room (middle of room wall)
    for (let y = 7; y < 10; y++) {
      dungeon[y][5] = '#'; // Changed from 6 to 5 to avoid corner
    }
    
    // Horizontal corridor from center to room 4 (middle of room wall)
    for (let x = 15; x < 17; x++) {
      dungeon[10][x] = '#';
    }
    
    // Vertical corridor from room 3 to center (middle of room wall)
    for (let y = 12; y > 10; y--) { // Changed to connect properly
      dungeon[y][7] = '#'; // Changed from 8 to 7 to avoid corner
    }
    
    // Create openings where corridors meet rooms (middle of walls, not corners)
    dungeon[4][10] = '#'; // Room 1 to corridor (middle of top wall)
    dungeon[4][13] = '#'; // Corridor to room 2 (middle of top wall)
    dungeon[6][5] = '#';  // Room 1 to vertical corridor (middle of side wall)
    dungeon[9][5] = '#';  // Vertical corridor to center (middle of side wall)
    dungeon[10][15] = '#'; // Center to room 4 (middle of side wall)
    dungeon[12][7] = '#';  // Room 3 to center (middle of top wall)
    
    // Add monsters in rooms
    const monsters = [
      { id: 'orc1', name: 'orc', symbol: 'o', x: 4, y: 4, hp: 15, maxHp: 15, damage: 4 },
      { id: 'goblin1', name: 'goblin', symbol: 'g', x: 17, y: 3, hp: 8, maxHp: 8, damage: 3 },
      { id: 'kobold1', name: 'kobold', symbol: 'k', x: 3, y: 13, hp: 6, maxHp: 6, damage: 2 },
      { id: 'troll1', name: 'troll', symbol: 'T', x: 19, y: 14, hp: 25, maxHp: 25, damage: 6 }
    ];
    
    // Add items in rooms
    const items = [
      { id: 'sword1', name: 'iron sword', symbol: ')', x: 5, y: 3, type: 'weapon', damage: 5 },
      { id: 'potion1', name: 'healing potion', symbol: '!', x: 18, y: 4, type: 'potion', healing: 20 },
      { id: 'armor1', name: 'leather armor', symbol: '[', x: 4, y: 12, type: 'armor', defense: 2 },
      { id: 'gold1', name: 'gold coins', symbol: '$', x: 20, y: 15, type: 'gold', value: 50 }
    ];
    
    // Add stairs
    const features = [
      { symbol: '<', x: 11, y: 10, type: 'stairs_up' },
      { symbol: '>', x: 21, y: 5, type: 'stairs_down' }
    ];
    
    return {
      dungeon,
      monsters,
      items,
      features
    };
  }

  getStartingPosition(levelData) {
    // Find a safe starting position (empty floor tile)
    for (let y = 1; y < levelData.dungeon.length - 1; y++) {
      for (let x = 1; x < levelData.dungeon[0].length - 1; x++) {
        if (levelData.dungeon[y][x] === '.') {
          // Make sure no monster is here
          const hasMonster = levelData.monsters.some(m => m.x === x && m.y === y);
          if (!hasMonster) {
            return { x, y };
          }
        }
      }
    }
    // Fallback
    return { x: 3, y: 3 };
  }

  isValidMove(x, y, dungeon) {
    if (x < 0 || x >= dungeon[0].length || y < 0 || y >= dungeon.length) {
      return false;
    }
    
    const tile = dungeon[y][x];
    // Level 1: . (room floor), # (corridor floor) are walkable
    // Walls (-, |) and solid rock (space) are not walkable
    // + (doors) will be added on level 3+
    return tile === '.' || tile === '#' || tile === '+';
  }

  async updateGameActivity(gameId) {
    await docClient.send(new UpdateCommand({
      TableName: GAMES_TABLE,
      Key: { gameId },
      UpdateExpression: 'SET lastActivity = :now',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString()
      }
    }));
  }

  async updateGame(gameId, updates) {
    const updateExpressions = [];
    const attributeNames = {};
    const attributeValues = {};
    
    Object.keys(updates).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      
      // Handle nested keys like 'levels.1.monsters'
      const keyParts = key.split('.');
      if (keyParts.length > 1) {
        keyParts.forEach((part, partIndex) => {
          attributeNames[`#${part}${partIndex}`] = part;
        });
        const expression = keyParts.map((part, partIndex) => `#${part}${partIndex}`).join('.');
        updateExpressions.push(`${expression} = ${attrValue}`);
      } else {
        attributeNames[attrName] = key;
        updateExpressions.push(`${attrName} = ${attrValue}`);
      }
      
      attributeValues[attrValue] = updates[key];
    });

    if (updateExpressions.length === 0) return;

    await docClient.send(new UpdateCommand({
      TableName: GAMES_TABLE,
      Key: { gameId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues
    }));
  }
}

module.exports = new CleanDynamoDBService();