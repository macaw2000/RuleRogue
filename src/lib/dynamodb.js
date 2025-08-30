const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'multiplayer-roguelike-connections-prod';
const GAMES_TABLE = process.env.GAMES_TABLE || 'multiplayer-roguelike-games-prod';
const PLAYERS_TABLE = process.env.PLAYERS_TABLE || 'multiplayer-roguelike-players-prod';

class DynamoDBService {
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
    
    // Generate the first level
    const level1 = this.generateLevel(1);
    
    const game = {
      gameId,
      roomCode,
      levels: {
        1: level1
      },
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      playerCount: 0,
      maxLevel: 1,
      ttl
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
    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};
    
    Object.keys(updates).forEach(key => {
      if (key.includes('.')) {
        // Handle nested attributes like 'levels.1.monsters'
        const parts = key.split('.');
        let attrName = '';
        parts.forEach((part, index) => {
          const attrKey = `#attr${index}`;
          expressionAttributeNames[attrKey] = part;
          attrName += (index === 0 ? '' : '.') + attrKey;
        });
        updateExpression.push(`${attrName} = :${key.replace(/\./g, '_')}`);
        expressionAttributeValues[`:${key.replace(/\./g, '_')}`] = updates[key];
      } else {
        updateExpression.push(`${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = updates[key];
      }
    });

    expressionAttributeValues[':lastActivity'] = new Date().toISOString();
    updateExpression.push('lastActivity = :lastActivity');

    const params = {
      TableName: GAMES_TABLE,
      Key: { gameId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues
    };

    if (Object.keys(expressionAttributeNames).length > 0) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    await docClient.send(new UpdateCommand(params));
  }

  // Player management
  async savePlayer(playerId, gameId, playerData) {
    const ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
    
    await docClient.send(new PutCommand({
      TableName: PLAYERS_TABLE,
      Item: {
        playerId,
        gameId,
        ...playerData,
        lastSeen: new Date().toISOString(),
        ttl
      }
    }));
  }

  async getPlayer(playerId) {
    const result = await docClient.send(new GetCommand({
      TableName: PLAYERS_TABLE,
      Key: { playerId }
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

  async updatePlayer(playerId, updates) {
    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};
    
    // Reserved keywords in DynamoDB
    const reservedKeywords = ['level', 'name', 'class', 'type', 'status', 'data'];
    
    Object.keys(updates).forEach(key => {
      if (reservedKeywords.includes(key.toLowerCase())) {
        // Use attribute name placeholder for reserved keywords
        const attrName = `#${key}`;
        expressionAttributeNames[attrName] = key;
        updateExpression.push(`${attrName} = :${key}`);
      } else {
        updateExpression.push(`${key} = :${key}`);
      }
      expressionAttributeValues[`:${key}`] = updates[key];
    });

    expressionAttributeValues[':lastSeen'] = new Date().toISOString();
    updateExpression.push('lastSeen = :lastSeen');

    const params = {
      TableName: PLAYERS_TABLE,
      Key: { playerId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues
    };

    if (Object.keys(expressionAttributeNames).length > 0) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    await docClient.send(new UpdateCommand(params));
  }

  async deletePlayer(playerId) {
    await docClient.send(new DeleteCommand({
      TableName: PLAYERS_TABLE,
      Key: { playerId }
    }));
  }

  // Generate room code
  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Find game by room code
  async findGameByRoomCode(roomCode) {
    // This is a simplified approach - in production you'd want a GSI on roomCode
    const result = await docClient.send(new ScanCommand({
      TableName: GAMES_TABLE,
      FilterExpression: 'roomCode = :roomCode',
      ExpressionAttributeValues: {
        ':roomCode': roomCode
      }
    }));
    return result.Items?.[0];
  }

  // Generate a complete level with NetHack-style features
  generateLevel(levelNum) {
    const { dungeon, rooms, features } = this.generateDungeon(levelNum);
    const monsters = this.generateMonsters(levelNum, rooms);
    const items = this.generateItems(levelNum, rooms);
    
    return {
      levelNum,
      dungeon,
      rooms,
      features,
      monsters,
      items,
      generatedAt: new Date().toISOString()
    };
  }

  // NetHack-style dungeon generation
  generateDungeon(level = 1) {
    const width = 80;
    const height = 24;
    const dungeon = [];
    
    // Initialize with solid rock
    for (let y = 0; y < height; y++) {
      dungeon[y] = [];
      for (let x = 0; x < width; x++) {
        dungeon[y][x] = ' '; // Solid rock (undiggable)
      }
    }
    
    // Create rooms
    const rooms = [];
    const numRooms = Math.floor(Math.random() * 4) + 6; // 6-9 rooms
    
    for (let attempts = 0; attempts < 50 && rooms.length < numRooms; attempts++) {
      let roomWidth = Math.floor(Math.random() * 8) + 4;
      let roomHeight = Math.floor(Math.random() * 6) + 3;
      let roomX = Math.floor(Math.random() * (width - roomWidth - 4)) + 2;
      let roomY = Math.floor(Math.random() * (height - roomHeight - 4)) + 2;
      
      // Check for overlap
      let overlap = false;
      for (let room of rooms) {
        if (roomX < room.x + room.width + 3 && roomX + roomWidth + 3 > room.x &&
            roomY < room.y + room.height + 3 && roomY + roomHeight + 3 > room.y) {
          overlap = true;
          break;
        }
      }
      
      if (!overlap) {
        // Create room walls and floor
        for (let y = roomY - 1; y <= roomY + roomHeight; y++) {
          for (let x = roomX - 1; x <= roomX + roomWidth; x++) {
            if (y === roomY - 1 || y === roomY + roomHeight || 
                x === roomX - 1 || x === roomX + roomWidth) {
              dungeon[y][x] = '#'; // Wall
            } else {
              dungeon[y][x] = '.'; // Floor
            }
          }
        }
        
        rooms.push({ x: roomX, y: roomY, width: roomWidth, height: roomHeight });
      }
    }
    
    // Helper function to create corridor with walls
    const createCorridor = (x1, y1, x2, y2, isHorizontal) => {
      if (isHorizontal) {
        const startX = Math.min(x1, x2);
        const endX = Math.max(x1, x2);
        const y = y1;
        
        // Create corridor floor
        for (let x = startX; x <= endX; x++) {
          dungeon[y][x] = '.';
        }
        
        // Add walls above and below corridor
        for (let x = startX; x <= endX; x++) {
          if (y > 0 && dungeon[y - 1][x] === ' ') dungeon[y - 1][x] = '#';
          if (y < height - 1 && dungeon[y + 1][x] === ' ') dungeon[y + 1][x] = '#';
        }
      } else {
        const startY = Math.min(y1, y2);
        const endY = Math.max(y1, y2);
        const x = x1;
        
        // Create corridor floor
        for (let y = startY; y <= endY; y++) {
          dungeon[y][x] = '.';
        }
        
        // Add walls left and right of corridor
        for (let y = startY; y <= endY; y++) {
          if (x > 0 && dungeon[y][x - 1] === ' ') dungeon[y][x - 1] = '#';
          if (x < width - 1 && dungeon[y][x + 1] === ' ') dungeon[y][x + 1] = '#';
        }
      }
    };

    // Connect rooms with corridors
    for (let i = 1; i < rooms.length; i++) {
      const prevRoom = rooms[i - 1];
      const currRoom = rooms[i];
      
      const prevCenterX = Math.floor(prevRoom.x + prevRoom.width / 2);
      const prevCenterY = Math.floor(prevRoom.y + prevRoom.height / 2);
      const currCenterX = Math.floor(currRoom.x + currRoom.width / 2);
      const currCenterY = Math.floor(currRoom.y + currRoom.height / 2);
      
      // Create L-shaped corridor with walls
      if (Math.random() < 0.5) {
        // Horizontal first, then vertical
        createCorridor(prevCenterX, prevCenterY, currCenterX, prevCenterY, true);
        createCorridor(currCenterX, prevCenterY, currCenterX, currCenterY, false);
      } else {
        // Vertical first, then horizontal
        createCorridor(prevCenterX, prevCenterY, prevCenterX, currCenterY, false);
        createCorridor(prevCenterX, currCenterY, currCenterX, currCenterY, true);
      }
    }
    
    // Add stairs
    const features = [];
    if (rooms.length > 0) {
      // Upstairs (except on level 1)
      if (level > 1) {
        const upRoom = rooms[0];
        const upX = upRoom.x + Math.floor(upRoom.width / 2);
        const upY = upRoom.y + Math.floor(upRoom.height / 2);
        dungeon[upY][upX] = '<';
        features.push({ type: 'upstairs', x: upX, y: upY });
        console.log(`Generated upstairs on level ${level} at (${upX}, ${upY})`);
      }
      
      // Downstairs
      const downRoom = rooms[rooms.length - 1];
      const downX = downRoom.x + Math.floor(downRoom.width / 2);
      const downY = downRoom.y + Math.floor(downRoom.height / 2);
      dungeon[downY][downX] = '>';
      features.push({ type: 'downstairs', x: downX, y: downY });
      console.log(`Generated downstairs on level ${level} at (${downX}, ${downY})`);
    }
    
    return { dungeon, rooms, features, level };
  }

  // Generate monsters for a level
  generateMonsters(level, rooms) {
    const monsters = [];
    const monsterTypes = [
      { symbol: 'r', name: 'rat', hp: 5, damage: 2, color: 'brown' },
      { symbol: 'g', name: 'goblin', hp: 8, damage: 3, color: 'green' },
      { symbol: 'o', name: 'orc', hp: 12, damage: 4, color: 'gray' },
      { symbol: 'k', name: 'kobold', hp: 6, damage: 2, color: 'brown' },
      { symbol: 's', name: 'snake', hp: 10, damage: 3, color: 'green' },
      { symbol: 'z', name: 'zombie', hp: 15, damage: 5, color: 'gray' },
      { symbol: 'T', name: 'troll', hp: 25, damage: 8, color: 'green' }
    ];
    
    const numMonsters = Math.floor(Math.random() * 3) + level + 2;
    
    for (let i = 0; i < numMonsters && i < rooms.length * 2; i++) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const x = room.x + Math.floor(Math.random() * room.width);
      const y = room.y + Math.floor(Math.random() * room.height);
      
      // Choose monster based on level
      const availableMonsters = monsterTypes.filter(m => 
        (m.name === 'rat' || m.name === 'kobold') ||
        (level >= 2 && (m.name === 'goblin' || m.name === 'snake')) ||
        (level >= 3 && m.name === 'orc') ||
        (level >= 4 && m.name === 'zombie') ||
        (level >= 5 && m.name === 'troll')
      );
      
      const monsterType = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
      
      monsters.push({
        id: `monster_${i}_${Date.now()}`,
        ...monsterType,
        x, y,
        maxHp: monsterType.hp,
        lastMove: Date.now()
      });
    }
    
    return monsters;
  }

  // Generate items for a level
  generateItems(level, rooms) {
    const items = [];
    const itemTypes = [
      { symbol: '!', name: 'potion of healing', type: 'potion', effect: 'heal', value: 20, color: 'red' },
      { symbol: '?', name: 'scroll of identify', type: 'scroll', effect: 'identify', color: 'white' },
      { symbol: '/', name: 'wand of magic missile', type: 'wand', charges: 5, damage: 8, color: 'blue' },
      { symbol: ')', name: 'dagger', type: 'weapon', damage: 4, color: 'gray' },
      { symbol: ')', name: 'sword', type: 'weapon', damage: 8, color: 'silver' },
      { symbol: '[', name: 'leather armor', type: 'armor', ac: 2, color: 'brown' },
      { symbol: '[', name: 'chain mail', type: 'armor', ac: 4, color: 'gray' },
      { symbol: '$', name: 'gold piece', type: 'gold', value: 1, color: 'yellow' }
    ];
    
    const numItems = Math.floor(Math.random() * 4) + level + 1;
    
    for (let i = 0; i < numItems && i < rooms.length * 3; i++) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const x = room.x + Math.floor(Math.random() * room.width);
      const y = room.y + Math.floor(Math.random() * room.height);
      
      const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
      
      items.push({
        id: `item_${i}_${Date.now()}`,
        ...itemType,
        x, y
      });
    }
    
    return items;
  }

  isValidMove(x, y, dungeon) {
    if (y < 0 || y >= dungeon.length || x < 0 || x >= dungeon[0].length) {
      return false;
    }
    return dungeon[y][x] !== '#' && dungeon[y][x] !== ' ';
  }

  // Get starting position for new player
  getStartingPosition(level) {
    const rooms = level.rooms;
    if (rooms.length === 0) return { x: 1, y: 1 };
    
    // Start in the first room
    const startRoom = rooms[0];
    return {
      x: startRoom.x + Math.floor(startRoom.width / 2),
      y: startRoom.y + Math.floor(startRoom.height / 2)
    };
  }

  // Handle level transitions
  async handleLevelTransition(gameId, playerId, direction) {
    console.log(`handleLevelTransition called: gameId=${gameId}, playerId=${playerId}, direction=${direction}`);
    try {
      const game = await this.getGame(gameId);
      const player = await this.getPlayer(playerId);
      
      if (!game || !player) {
        console.error('Game or player not found:', { gameId, playerId });
        return null;
      }
      
      const currentLevel = player.level || 1;
      let newLevel;
      
      if (direction === 'down') {
        newLevel = currentLevel + 1;
        console.log(`Player ${playerId} going down from level ${currentLevel} to ${newLevel}`);
        
        // Generate new level if it doesn't exist (check both string and number keys)
        if (!game.levels[newLevel] && !game.levels[newLevel.toString()]) {
          console.log(`Generating new level ${newLevel}`);
          game.levels[newLevel.toString()] = this.generateLevel(newLevel);
          game.maxLevel = Math.max(game.maxLevel || 1, newLevel);
          
          // Update game in database with the entire levels object
          try {
            await docClient.send(new UpdateCommand({
              TableName: GAMES_TABLE,
              Key: { gameId },
              UpdateExpression: 'SET levels = :levels, maxLevel = :maxLevel, lastActivity = :now',
              ExpressionAttributeValues: {
                ':levels': game.levels,
                ':maxLevel': game.maxLevel,
                ':now': new Date().toISOString()
              }
            }));
            console.log(`Level ${newLevel} generated and saved successfully`);
          } catch (updateError) {
            console.error(`Failed to update game with new level:`, updateError);
            throw updateError;
          }
        }
      } else if (direction === 'up' && currentLevel > 1) {
        newLevel = currentLevel - 1;
        console.log(`Player ${playerId} going up from level ${currentLevel} to ${newLevel}`);
      } else {
        console.log(`Invalid transition: ${direction} from level ${currentLevel}`);
        return null; // Invalid transition
      }
      
      // Get starting position on new level (try both number and string keys)
      const levelData = game.levels[newLevel] || game.levels[newLevel.toString()];
      if (!levelData) {
        console.error(`Level data not found for level ${newLevel}`);
        console.error(`Available levels:`, Object.keys(game.levels));
        console.error(`Trying keys: ${newLevel}, ${newLevel.toString()}`);
        return null;
      }
      
      // Fix stairs positioning logic
      console.log(`Looking for ${direction === 'down' ? 'up' : 'down'}stairs on level ${newLevel}`);
      console.log(`Level features:`, JSON.stringify(levelData.features));
      console.log(`Level dungeon sample:`, levelData.dungeon.slice(0, 5).map(row => row.slice(0, 20).join('')));
      
      const startPos = direction === 'down' 
        ? this.getStairsPosition(levelData, 'up') // When going down, start at upstairs on new level
        : this.getStairsPosition(levelData, 'down'); // When going up, start at downstairs on new level
      
      console.log(`New position for player ${playerId}: (${startPos.x}, ${startPos.y}) on level ${newLevel}`);
      
      // Update player level and position
      try {
        await this.updatePlayer(playerId, {
          level: newLevel,
          x: startPos.x,
          y: startPos.y
        });
        console.log(`Player ${playerId} updated to level ${newLevel} at position (${startPos.x}, ${startPos.y})`);
      } catch (playerUpdateError) {
        console.error(`Failed to update player:`, playerUpdateError);
        throw playerUpdateError;
      }
      
      return { newLevel, position: startPos };
    } catch (error) {
      console.error('Level transition error:', error);
      return null;
    }
  }

  // Get stairs position
  getStairsPosition(level, stairType) {
    console.log(`getStairsPosition called for ${stairType}stairs`);
    const feature = level.features.find(f => f.type === `${stairType}stairs`);
    if (feature) {
      console.log(`Found ${stairType}stairs feature at (${feature.x}, ${feature.y})`);
      return { x: feature.x, y: feature.y };
    }
    
    // Fallback: search for stairs in the dungeon
    const stairSymbol = stairType === 'up' ? '<' : '>';
    console.log(`Searching for ${stairSymbol} symbol in dungeon`);
    for (let y = 0; y < level.dungeon.length; y++) {
      for (let x = 0; x < level.dungeon[y].length; x++) {
        if (level.dungeon[y][x] === stairSymbol) {
          console.log(`Found ${stairSymbol} at (${x}, ${y})`);
          return { x, y };
        }
      }
    }
    
    console.log(`No ${stairType}stairs found, using starting position`);
    // Final fallback: starting position
    return this.getStartingPosition(level);
  }

  getNewPosition(x, y, direction) {
    switch (direction) {
      case 'up': return { x, y: y - 1 };
      case 'down': return { x, y: y + 1 };
      case 'left': return { x: x - 1, y };
      case 'right': return { x: x + 1, y };
      default: return { x, y };
    }
  }
}

module.exports = new DynamoDBService();