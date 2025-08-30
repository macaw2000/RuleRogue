const dynamodb = require('../lib/dynamodb');
const WebSocketService = require('../lib/websocket');

// Loot generation system
function generateLoot(monster, x, y) {
  const loot = [];
  const lootTables = {
    // Weapons (15% chance)
    weapons: [
      { name: 'Iron Sword', symbol: '/', damage: 8, type: 'weapon', rarity: 'common' },
      { name: 'Steel Dagger', symbol: '/', damage: 6, type: 'weapon', rarity: 'common' },
      { name: 'Battle Axe', symbol: '/', damage: 12, type: 'weapon', rarity: 'uncommon' },
      { name: 'Magic Sword', symbol: '/', damage: 15, type: 'weapon', rarity: 'rare' },
      { name: 'Enchanted Bow', symbol: ')', damage: 10, type: 'weapon', rarity: 'uncommon' }
    ],
    // Armor (20% chance)
    armor: [
      { name: 'Leather Armor', symbol: '[', defense: 3, type: 'armor', rarity: 'common' },
      { name: 'Chain Mail', symbol: '[', defense: 5, type: 'armor', rarity: 'common' },
      { name: 'Plate Armor', symbol: '[', defense: 8, type: 'armor', rarity: 'uncommon' },
      { name: 'Magic Robes', symbol: '[', defense: 4, type: 'armor', rarity: 'uncommon' },
      { name: 'Dragon Scale', symbol: '[', defense: 12, type: 'armor', rarity: 'rare' }
    ],
    // Potions (25% chance)
    potions: [
      { name: 'Health Potion', symbol: '!', healing: 25, type: 'potion', rarity: 'common' },
      { name: 'Mana Potion', symbol: '!', mana: 20, type: 'potion', rarity: 'common' },
      { name: 'Greater Health Potion', symbol: '!', healing: 50, type: 'potion', rarity: 'uncommon' },
      { name: 'Strength Potion', symbol: '!', strength: 5, type: 'potion', rarity: 'uncommon' }
    ],
    // Accessories (10% chance)
    accessories: [
      { name: 'Ring of Protection', symbol: '=', defense: 2, type: 'ring', rarity: 'uncommon' },
      { name: 'Amulet of Power', symbol: '"', damage: 3, type: 'amulet', rarity: 'uncommon' },
      { name: 'Boots of Speed', symbol: ']', speed: 1, type: 'boots', rarity: 'rare' }
    ],
    // Light sources (15% chance)
    lights: [
      { name: 'Torch', symbol: '(', lightRadius: 6, type: 'lantern', rarity: 'common', duration: 100 },
      { name: 'Lantern', symbol: '(', lightRadius: 8, type: 'lantern', rarity: 'uncommon', duration: 200 },
      { name: 'Magic Lamp', symbol: '(', lightRadius: 10, type: 'lamp', rarity: 'rare', duration: 500 }
    ]
  };
  
  // Determine monster difficulty for loot quality
  const difficulty = monster.maxHp / 10; // Rough difficulty estimate
  
  // Roll for each loot type
  if (Math.random() < 0.15) { // 15% weapon chance
    const weapons = lootTables.weapons.filter(w => 
      (difficulty >= 3 && w.rarity === 'rare') ||
      (difficulty >= 2 && w.rarity === 'uncommon') ||
      w.rarity === 'common'
    );
    if (weapons.length > 0) {
      const weapon = weapons[Math.floor(Math.random() * weapons.length)];
      loot.push({ ...weapon, x, y, id: `item_${Date.now()}_${Math.random()}` });
    }
  }
  
  if (Math.random() < 0.20) { // 20% armor chance
    const armors = lootTables.armor.filter(a => 
      (difficulty >= 3 && a.rarity === 'rare') ||
      (difficulty >= 2 && a.rarity === 'uncommon') ||
      a.rarity === 'common'
    );
    if (armors.length > 0) {
      const armor = armors[Math.floor(Math.random() * armors.length)];
      loot.push({ ...armor, x, y, id: `item_${Date.now()}_${Math.random()}` });
    }
  }
  
  if (Math.random() < 0.25) { // 25% potion chance
    const potions = lootTables.potions.filter(p => 
      (difficulty >= 2 && p.rarity === 'uncommon') ||
      p.rarity === 'common'
    );
    if (potions.length > 0) {
      const potion = potions[Math.floor(Math.random() * potions.length)];
      loot.push({ ...potion, x, y, id: `item_${Date.now()}_${Math.random()}` });
    }
  }
  
  if (Math.random() < 0.10) { // 10% accessory chance
    const accessories = lootTables.accessories.filter(a => 
      (difficulty >= 3 && a.rarity === 'rare') ||
      (difficulty >= 2 && a.rarity === 'uncommon') ||
      a.rarity === 'common'
    );
    if (accessories.length > 0) {
      const accessory = accessories[Math.floor(Math.random() * accessories.length)];
      loot.push({ ...accessory, x, y, id: `item_${Date.now()}_${Math.random()}` });
    }
  }
  
  if (Math.random() < 0.15) { // 15% light source chance
    const lights = lootTables.lights.filter(l => 
      (difficulty >= 3 && l.rarity === 'rare') ||
      (difficulty >= 2 && l.rarity === 'uncommon') ||
      l.rarity === 'common'
    );
    if (lights.length > 0) {
      const light = lights[Math.floor(Math.random() * lights.length)];
      loot.push({ ...light, x, y, id: `item_${Date.now()}_${Math.random()}` });
    }
  }
  
  return loot;
}

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const ws = new WebSocketService(event);
  
  try {
    const body = JSON.parse(event.body);
    const { direction, useStairs, sequence } = body;
    
    console.log(`PlayerMove received: direction=${direction}, useStairs=${useStairs}, sequence=${sequence}`);
    
    // PlayerMove handler
    
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
    
    // Handle explicit stair usage (when player presses > or <)
    if (useStairs) {
      const currentCellContent = levelData.dungeon[player.y]?.[player.x];
      
      // Check for stairs
      
      // Check if there are stairs nearby (within 1 tile) and auto-correct position
      let foundStairs = false;
      let stairsPos = null;
      const searchRadius = 1;
      
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
          const checkX = player.x + dx;
          const checkY = player.y + dy;
          const checkCell = levelData.dungeon[checkY]?.[checkX];
          
          if ((useStairs === 'down' && checkCell === '>') || (useStairs === 'up' && checkCell === '<')) {
            foundStairs = true;
            stairsPos = { x: checkX, y: checkY };
            
            // Found stairs, correct position
            
            // Update player position to the stairs
            await dynamodb.updatePlayer(connectionId, { x: checkX, y: checkY });
            player.x = checkX;
            player.y = checkY;
            break;
          }
        }
        if (foundStairs) break;
      }
      
      if (!foundStairs) {
        await ws.sendToConnection(connectionId, {
          type: 'message',
          data: {
            text: `No ${useStairs}stairs found nearby. Walk closer to the stairs first.`,
            color: 'gray'
          }
        });
        return { statusCode: 200, body: 'No stairs nearby' };
      }
      

      
      // Use the stairs
      const result = await dynamodb.handleLevelTransition(player.gameId, connectionId, useStairs);
      
      if (result) {
        const message = useStairs === 'up' 
          ? `You climb up to level ${result.newLevel}`
          : `You descend to level ${result.newLevel}! The dungeon grows more dangerous...`;
        
        await ws.sendToConnection(connectionId, {
          type: 'message',
          data: {
            text: message,
            color: 'cyan'
          }
        });
        
        const updatedGame = await dynamodb.getGame(player.gameId);
        await broadcastGameState(ws, updatedGame, player.gameId, result.newLevel);
        
        return { statusCode: 200, body: 'Level transition successful' };
      } else {
        await ws.sendToConnection(connectionId, {
          type: 'message',
          data: {
            text: 'Unable to use stairs at this time.',
            color: 'red'
          }
        });
        return { statusCode: 500, body: 'Level transition failed' };
      }
    }
    
    // Calculate new position
    const newPos = dynamodb.getNewPosition(player.x, player.y, direction);
    
    // Check for monsters at new position FIRST (NetHack rules)
    // Only find monsters that are alive and actually exist in the array
    let monster = levelData.monsters.find(m => m.x === newPos.x && m.y === newPos.y && m.hp > 0);
    
    // Debug logging
    console.log(`Player ${connectionId} moving from (${player.x}, ${player.y}) to (${newPos.x}, ${newPos.y})`);
    console.log(`Level ${currentLevel} has ${levelData.monsters.length} monsters:`);
    levelData.monsters.forEach((m, i) => {
      console.log(`  Monster ${i}: ${m.name} (${m.symbol}) at (${m.x}, ${m.y}) HP: ${m.hp}/${m.maxHp}`);
    });
    console.log(`Looking for monster at (${newPos.x}, ${newPos.y})`);
    console.log(`Monster found at target position:`, monster ? `${monster.name} at (${monster.x}, ${monster.y}) HP: ${monster.hp}` : 'None');
    
    // Double-check that the monster still exists (prevent race conditions)
    if (monster && monster.hp <= 0) {
      monster = null;
    }
    
    let gameStateChanged = false;
    let playerUpdates = {};
    let actualPosition = { x: player.x, y: player.y }; // Start with current position
    
    if (monster) {
      // Combat! Player stays in current position during combat (NetHack rules)
      const damage = Math.floor(Math.random() * 6) + 3;
      monster.hp -= damage;
      gameStateChanged = true;
      
      await ws.sendToConnection(connectionId, {
        type: 'message',
        data: {
          text: `You hit the ${monster.name} for ${damage} damage!`,
          color: 'red'
        }
      });
      
      if (monster.hp <= 0) {
        await ws.sendToConnection(connectionId, {
          type: 'message',
          data: {
            text: `You killed the ${monster.name}!`,
            color: 'green'
          }
        });
        
        const exp = monster.maxHp * 2;
        playerUpdates.experience = (player.experience || 0) + exp;
        
        await ws.sendToConnection(connectionId, {
          type: 'message',
          data: {
            text: `You gain ${exp} experience points.`,
            color: 'yellow'
          }
        });
        
        // Generate loot at monster's position
        if (Math.random() < 0.7) {
          const loot = generateLoot(monster, monster.x, monster.y); // Use monster's actual position
          if (loot.length > 0) {
            levelData.items.push(...loot);
            const lootNames = loot.map(item => item.name).join(', ');
            await ws.sendToConnection(connectionId, {
              type: 'message',
              data: {
                text: `The ${monster.name} dropped: ${lootNames}`,
                color: 'cyan'
              }
            });
            
            // Save items to database immediately (like we do for monsters)
            try {
              await dynamodb.updateGame(player.gameId, {
                [`levels.${currentLevel}.items`]: levelData.items
              });
            } catch (dbError) {
              console.error('Failed to save loot drop to database:', dbError);
            }
          }
        }
        
        // Gold drop (NetHack style - drop as item, don't auto-pickup)
        if (Math.random() < 0.8) {
          const goldAmount = Math.floor(Math.random() * (monster.maxHp * 3)) + monster.maxHp;
          const goldItem = {
            name: `${goldAmount} gold pieces`,
            symbol: '$',
            type: 'gold',
            amount: goldAmount,
            x: monster.x,
            y: monster.y,
            id: `gold_${Date.now()}_${Math.random()}`
          };
          
          levelData.items.push(goldItem);
          
          await ws.sendToConnection(connectionId, {
            type: 'message',
            data: {
              text: `The ${monster.name} dropped ${goldAmount} gold pieces.`,
              color: 'yellow'
            }
          });
        }
        
        // Monster is dead - remove it from the monsters array IMMEDIATELY
        const monsterIndex = levelData.monsters.findIndex(m => m.id === monster.id);
        
        if (monsterIndex !== -1) {
          levelData.monsters.splice(monsterIndex, 1);
          
          // Update the database immediately to prevent race conditions
          try {
            await dynamodb.updateGame(player.gameId, {
              [`levels.${currentLevel}.monsters`]: levelData.monsters
            });
            
            // Force a full game state broadcast to ensure all clients get the update
            const updatedGame = await dynamodb.getGame(player.gameId);
            await broadcastGameState(ws, updatedGame, player.gameId, currentLevel);
          } catch (dbError) {
            console.error('Failed to save monster removal to database:', dbError);
          }
        } else {
          console.error(`Could not find monster ${monster.name} (${monster.id}) in monsters array for removal`);
        }
        
        // Player can now move into its space
        if (dynamodb.isValidMove(newPos.x, newPos.y, levelData.dungeon)) {
          actualPosition = newPos;
          playerUpdates.x = newPos.x;
          playerUpdates.y = newPos.y;
        }
      } else {
        // Monster is still alive, attacks back
        const monsterDamage = Math.floor(Math.random() * monster.damage) + 1;
        const newHp = Math.max(0, player.hp - monsterDamage);
        playerUpdates.hp = newHp;
        
        await ws.sendToConnection(connectionId, {
          type: 'message',
          data: {
            text: `The ${monster.name} hits you for ${monsterDamage} damage!`,
            color: 'red'
          }
        });
        
        if (newHp <= 0) {
          await ws.sendToConnection(connectionId, {
            type: 'message',
            data: {
              text: 'You have died! Game over.',
              color: 'red'
            }
          });
        }
        // Player stays in current position (actualPosition already set to current pos)
      }
    } else if (dynamodb.isValidMove(newPos.x, newPos.y, levelData.dungeon)) {
      // No monster, normal movement
      actualPosition = newPos;
      playerUpdates.x = newPos.x;
      playerUpdates.y = newPos.y;
      
      // Check for items at new position (NetHack style - show message, don't auto-pickup)
      const itemsHere = levelData.items.filter(item => item.x === newPos.x && item.y === newPos.y);
      if (itemsHere.length > 0) {
        if (itemsHere.length === 1) {
          await ws.sendToConnection(connectionId, {
            type: 'message',
            data: {
              text: `You see here ${itemsHere[0].name}. Press ',' to pick up.`,
              color: 'cyan'
            }
          });
        } else {
          await ws.sendToConnection(connectionId, {
            type: 'message',
            data: {
              text: `You see here several items. Press ',' to pick up.`,
              color: 'cyan'
            }
          });
        }
      }
    }
    
    // Skip database update for simple movement to improve performance
    // Only update database for important changes (HP, level, equipment)
    const importantUpdates = {};
    if (playerUpdates.hp !== undefined) importantUpdates.hp = playerUpdates.hp;
    if (playerUpdates.level !== undefined) importantUpdates.level = playerUpdates.level;
    if (playerUpdates.equipment !== undefined) importantUpdates.equipment = playerUpdates.equipment;
    
    if (Object.keys(importantUpdates).length > 0) {
      await dynamodb.updatePlayer(connectionId, importantUpdates);
    }

    // Monster AI now runs independently via scheduled Lambda function
    // But also run immediately when player moves for responsive gameplay
    await processMonsterTurns(ws, game, currentLevel, connectionId);
    
    // Send player update to all players in the game (only if something significant changed)
    if (Object.keys(playerUpdates).length > 0 || monster) {
      const players = await dynamodb.getPlayersByGame(player.gameId);
      const gameConnections = players.map(p => p.playerId);
      
      const playerUpdateMessage = {
        type: 'playerUpdate',
        data: {
          id: connectionId,
          x: actualPosition.x,
          y: actualPosition.y,
          hp: playerUpdates.hp !== undefined ? playerUpdates.hp : player.hp,
          experience: playerUpdates.experience !== undefined ? playerUpdates.experience : (player.experience || 0),
          sequence: sequence // Include sequence number for client reconciliation
        }
      };
      
      for (const connId of gameConnections) {
        try {
          await ws.sendToConnection(connId, playerUpdateMessage);
        } catch (error) {
          console.error(`Failed to send player update to ${connId}:`, error);
        }
      }
    }
    
    // Update game state if needed (only for significant changes like combat/items)
    if (gameStateChanged) {
      try {
        const updates = {};
        updates[`levels.${currentLevel}.items`] = levelData.items;
        // Always update monsters array if there was combat (dead or alive)
        updates[`levels.${currentLevel}.monsters`] = levelData.monsters;
        
        await dynamodb.updateGame(player.gameId, updates);
        
        // Only broadcast full game state for significant changes (combat, monster death, items)
        // Regular movement uses lightweight playerUpdate messages
        if (monster && monster.hp <= 0) {
          // Monster died - need full state update for monster removal
          const updatedGame = await dynamodb.getGame(player.gameId);
          await broadcastGameState(ws, updatedGame, player.gameId, currentLevel);
        } else if (levelData.items.length > 0 && Math.random() < 0.1) {
          // Occasionally sync full state for items (10% chance to prevent drift)
          const updatedGame = await dynamodb.getGame(player.gameId);
          await broadcastGameState(ws, updatedGame, player.gameId, currentLevel);
        }
        // For regular combat (monster still alive), playerUpdate is sufficient
      } catch (error) {
        console.error('Game update error:', error);
      }
    }
    
    return {
      statusCode: 200,
      body: 'Move processed'
    };
  } catch (error) {
    console.error('Player move error:', error);
    
    await ws.sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to process move'
    });
    
    return {
      statusCode: 500,
      body: 'Failed to process move'
    };
  }
};

// Monster AI moved to separate Lambda function (monsterAI.js)

// Line of sight and monster AI moved to separate Lambda function

// NetHack-style Monster AI: Monsters actively hunt players
async function processMonsterTurns(ws, game, currentLevel, triggeringPlayerId) {
  try {
    const levelData = game.levels[currentLevel];
    if (!levelData || !levelData.monsters || levelData.monsters.length === 0) {
      return; // No monsters to move
    }

    const players = game.players.filter(p => p.level === currentLevel);
    if (players.length === 0) {
      return; // No players on this level
    }

    let monstersChanged = false;
    const monsterUpdates = [];

    // Process each monster's turn
    for (const monster of levelData.monsters) {
      if (monster.hp <= 0) continue; // Skip dead monsters

      // Find nearest player for this monster to hunt
      let nearestPlayer = null;
      let nearestDistance = Infinity;

      for (const player of players) {
        const distance = Math.abs(monster.x - player.x) + Math.abs(monster.y - player.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPlayer = player;
        }
      }

      if (!nearestPlayer) continue;

      // Monster behavior based on type and line of sight
      const monsterStats = getMonsterStats(monster.symbol);
      const detectionRange = monsterStats.detectionRange;
      const isAggressive = monsterStats.aggressive;

      // Check if monster can see the player (line of sight)
      const canSeePlayer = nearestDistance <= detectionRange && 
                          hasLineOfSight(monster.x, monster.y, nearestPlayer.x, nearestPlayer.y, levelData.dungeon);

      // Only act if monster can see player or is already chasing
      if (canSeePlayer || monster.isChasing) {
        monster.isChasing = true; // Once they see you, they keep chasing

        // Check if monster is already adjacent to player - ATTACK!
        const dx = nearestPlayer.x - monster.x;
        const dy = nearestPlayer.y - monster.y;
        const isAdjacent = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0);
        
        if (isAdjacent) {
          // Monster attacks adjacent player immediately
          const damage = Math.floor(Math.random() * monster.damage) + 1;
          const newHp = Math.max(0, nearestPlayer.hp - damage);
            
          // Update player HP
          await dynamodb.updatePlayer(nearestPlayer.id, { hp: newHp });
          
          // Send attack message to the attacked player
          await ws.sendToConnection(nearestPlayer.id, {
              type: 'message',
              data: {
                text: `The ${monster.name} attacks you for ${damage} damage!`,
                color: 'red'
              }
            });

          // Send attack message to other players on the level
          for (const otherPlayer of players) {
            if (otherPlayer.id !== nearestPlayer.id) {
              await ws.sendToConnection(otherPlayer.id, {
                type: 'message',
                data: {
                  text: `The ${monster.name} attacks ${nearestPlayer.name}!`,
                  color: 'orange'
                }
              });
            }
          }

          // Check if player died
          if (newHp <= 0) {
            await ws.sendToConnection(nearestPlayer.id, {
              type: 'message',
              data: {
                text: `You have been slain by the ${monster.name}!`,
                color: 'red'
              }
            });
          }

          // Update player stats for all clients
          await ws.sendToConnection(nearestPlayer.id, {
            type: 'playerUpdate',
            data: {
              id: nearestPlayer.id,
              hp: newHp
            }
          });
        } else {
          // Not adjacent, try to move toward player
          let newX = monster.x;
          let newY = monster.y;

          // Move diagonally when possible (more efficient pathfinding)
          if (dx !== 0 && dy !== 0) {
            // Diagonal movement
            newX += dx > 0 ? 1 : -1;
            newY += dy > 0 ? 1 : -1;
          } else if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal movement
            newX += dx > 0 ? 1 : -1;
          } else if (dy !== 0) {
            // Vertical movement
            newY += dy > 0 ? 1 : -1;
          }

          // Check if the move is valid
          if (dynamodb.isValidMove(newX, newY, levelData.dungeon)) {
            // Check if there's a player at the target position (attack!)
            const playerAtTarget = players.find(p => p.x === newX && p.y === newY);
            
            if (playerAtTarget) {
              // This shouldn't happen since we checked adjacency above, but just in case
              const damage = Math.floor(Math.random() * monster.damage) + 1;
              const newHp = Math.max(0, playerAtTarget.hp - damage);
              
              await dynamodb.updatePlayer(playerAtTarget.id, { hp: newHp });
              
              await ws.sendToConnection(playerAtTarget.id, {
                type: 'message',
                data: {
                  text: `The ${monster.name} attacks you for ${damage} damage!`,
                  color: 'red'
                }
              });

              await ws.sendToConnection(playerAtTarget.id, {
                type: 'playerUpdate',
                data: {
                  id: playerAtTarget.id,
                  hp: newHp
                }
              });
            } else {
            // Check if there's another monster at the target position
            const monsterAtTarget = levelData.monsters.find(m => 
              m.id !== monster.id && m.x === newX && m.y === newY && m.hp > 0
            );

            if (!monsterAtTarget) {
              // Valid move, no collision
              monster.x = newX;
              monster.y = newY;
              monstersChanged = true;
              
              monsterUpdates.push({
                id: monster.id,
                x: newX,
                y: newY
              });
            }
            // If there's a monster collision, stay in place (monsters don't fight each other)
          }
        }
        // If move is invalid (wall, etc.), monster stays in place
      }
    }

    // Update database if monsters moved
    if (monstersChanged) {
      await dynamodb.updateGame(game.gameId, {
        [`levels.${currentLevel}.monsters`]: levelData.monsters
      });

      // Broadcast updated game state to all players on this level
      const updatedGame = await dynamodb.getGame(game.gameId);
      await broadcastGameState(ws, updatedGame, game.gameId, currentLevel);
    }

  } catch (error) {
    console.error('Error processing monster turns:', error);
  }
}

// Monster stats and behavior
function getMonsterStats(symbol) {
  const stats = {
    'r': { detectionRange: 5, aggressive: true, name: 'rat' },
    'g': { detectionRange: 6, aggressive: true, name: 'goblin' },
    'o': { detectionRange: 7, aggressive: true, name: 'orc' },
    'k': { detectionRange: 5, aggressive: true, name: 'kobold' },
    's': { detectionRange: 6, aggressive: true, name: 'snake' },
    'z': { detectionRange: 8, aggressive: true, name: 'zombie' },
    'T': { detectionRange: 10, aggressive: true, name: 'troll' }
  };
  return stats[symbol] || { detectionRange: 6, aggressive: true, name: 'monster' };
}

// Line of sight calculation
function hasLineOfSight(x1, y1, x2, y2, dungeon) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  
  let x = x1;
  let y = y1;
  
  while (true) {
    if (x === x2 && y === y2) return true;
    
    if (y >= 0 && y < dungeon.length && x >= 0 && x < dungeon[0].length) {
      const cell = dungeon[y][x];
      if (cell === '-' || cell === '|' || cell === ' ') return false;
    }
    
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

// Helper function to broadcast game state (optimized)
async function broadcastGameState(ws, game, gameId, levelNum, skipPlayerQuery = false, cachedPlayers = null) {
  let players;
  if (skipPlayerQuery && cachedPlayers) {
    players = cachedPlayers;
  } else {
    players = await dynamodb.getPlayersByGame(gameId);
  }
  
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
      armor: p.armor || 0
    })).filter(p => (p.level || 1) === levelNum) // Only show players on current level
  };
  
  await ws.broadcastToGame(gameConnections, {
    type: 'gameState',
    data: gameState
  });
}
  
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
      armor: p.armor || 0
    })).filter(p => (p.level || 1) === levelNum) // Only show players on current level
  };
  
  await ws.broadcastToGame(gameConnections, {
    type: 'gameState',
    data: gameState
  });
}