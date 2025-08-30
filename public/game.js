// WebSocket connection for serverless AWS - Updated 2025-08-28 v2
let ws = null;
let gameState = null;
let currentPlayer = null;
let myConnectionId = null; // Store our connection ID
let reconnectAttempts = 0;
let playerTooltip = null; // For player tooltips
const maxReconnectAttempts = 5;

// Cookie utilities
function setCookie(name, value, days = 30) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// Movement optimization - ultra responsive with prediction
let lastMoveTime = 0;
const moveDelay = 25; // 25ms between moves for maximum responsiveness
let pendingMoves = []; // Queue of moves sent to server but not yet confirmed
let moveSequence = 0; // Sequence number for moves to handle out-of-order responses
let serverPosition = { x: 0, y: 0 }; // Last confirmed server position
let clientPosition = { x: 0, y: 0 }; // Current client position (with predictions)

// Cleanup old pending moves to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    pendingMoves = pendingMoves.filter(move => now - move.timestamp < 5000); // Keep moves for max 5 seconds
}, 1000);

// DOM elements
const loginScreen = document.getElementById('loginScreen');
const gameContainer = document.getElementById('gameContainer');
const dungeonDisplay = document.getElementById('dungeon');
const playerList = document.getElementById('playerList');
const playerStats = document.getElementById('playerStats');

// Initialize WebSocket connection
function initWebSocket() {
    // WebSocket URL for AWS deployment
    const wsUrl = 'wss://m7usyjkjgd.execute-api.us-east-1.amazonaws.com/prod';
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket connected successfully!');
        reconnectAttempts = 0;
    };
    
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleMessage(message);
    };
    
    ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        if (reconnectAttempts < maxReconnectAttempts) {
            setTimeout(() => {
                reconnectAttempts++;
                console.log(`Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                initWebSocket();
            }, 2000 * reconnectAttempts);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        console.error('WebSocket readyState:', ws.readyState);
        console.error('WebSocket URL:', wsUrl);
    };
}

// Handle incoming messages
function handleMessage(message) {
    switch (message.type) {
        case 'connectionId':
            // Store our connection ID for player identification
            myConnectionId = message.data.connectionId;
            // If we already have game state, try to find our player now
            if (gameState && gameState.players) {
                currentPlayer = gameState.players.find(p => p.id === myConnectionId);
                if (currentPlayer) {
                    updatePlayerStats();
                }
            }
            break;
        case 'gameState':
            gameState = message.data;
            

            
            // Try to find current player - be more aggressive about finding it
            if (myConnectionId) {
                currentPlayer = gameState.players.find(p => p.id === myConnectionId);
                if (currentPlayer) {
                    console.log(`Client: Player position updated to (${currentPlayer.x}, ${currentPlayer.y}), level ${gameState.currentLevel}`);
                }
            } else {
                // If we don't have connection ID yet, try to find it from the players
                // This is a fallback for timing issues
                if (gameState.players.length === 1) {
                    currentPlayer = gameState.players[0];
                    myConnectionId = currentPlayer.id;
                }
            }
            

            renderGame();
            updatePlayerList();
            updatePlayerStats();
            updateRoomInfo();
            break;
        case 'playerUpdate':
            // Handle player updates from server
            if (gameState && gameState.players) {
                const player = gameState.players.find(p => p.id === message.data.id);
                if (player) {
                    // For other players, always update position
                    if (message.data.id !== myConnectionId) {
                        if (message.data.x !== undefined) player.x = message.data.x;
                        if (message.data.y !== undefined) player.y = message.data.y;
                    } else {
                        // For current player, use server reconciliation with client-side prediction
                        if (message.data.x !== undefined && message.data.y !== undefined) {
                            const serverPos = { x: message.data.x, y: message.data.y };
                            const sequence = message.data.sequence;
                            
                            // Update authoritative server position
                            serverPosition = { x: serverPos.x, y: serverPos.y };
                            
                            // Remove confirmed moves from pending queue
                            if (sequence !== undefined) {
                                pendingMoves = pendingMoves.filter(move => move.sequence > sequence);
                            }
                            
                            // Reconcile: start from server position and replay unconfirmed moves
                            let reconciledPos = { x: serverPos.x, y: serverPos.y };
                            
                            for (const pendingMove of pendingMoves) {
                                const newPos = calculateNewPosition(reconciledPos.x, reconciledPos.y, pendingMove.direction);
                                if (isValidClientMove(newPos.x, newPos.y)) {
                                    reconciledPos = newPos;
                                }
                            }
                            
                            // Only update if there's a significant difference (reduces jitter)
                            const distance = Math.abs(reconciledPos.x - currentPlayer.x) + Math.abs(reconciledPos.y - currentPlayer.y);
                            if (distance > 0) {
                                player.x = reconciledPos.x;
                                player.y = reconciledPos.y;
                                currentPlayer.x = reconciledPos.x;
                                currentPlayer.y = reconciledPos.y;
                                clientPosition = { x: reconciledPos.x, y: reconciledPos.y };
                                
                                // Only log significant corrections to reduce console spam
                                if (distance > 1) {
                                    console.log(`Position reconciled: server (${serverPos.x}, ${serverPos.y}) -> client (${reconciledPos.x}, ${reconciledPos.y})`);
                                }
                            }
                        }
                    }
                    
                    // Always update non-position stats
                    if (message.data.hp !== undefined) player.hp = message.data.hp;
                    if (message.data.experience !== undefined) player.experience = message.data.experience;
                    if (message.data.equippedWeapon !== undefined) player.equippedWeapon = message.data.equippedWeapon;
                    if (message.data.equippedArmor !== undefined) player.equippedArmor = message.data.equippedArmor;
                    
                    // If this is the current player, update their reference for stats
                    if (message.data.id === myConnectionId && currentPlayer) {
                        if (message.data.hp !== undefined) currentPlayer.hp = message.data.hp;
                        if (message.data.experience !== undefined) currentPlayer.experience = message.data.experience;
                        if (message.data.equippedWeapon !== undefined) currentPlayer.equippedWeapon = message.data.equippedWeapon;
                        if (message.data.equippedArmor !== undefined) currentPlayer.equippedArmor = message.data.equippedArmor;
                        updatePlayerStats();
                    }
                    
                    renderGame();
                }
            }
            break;

        case 'message':
            displayMessage(message.data.text, message.data.color);

            break;
        case 'error':
            alert('Error: ' + message.message);
            // Show login screen again on error
            loginScreen.style.display = 'block';
            gameContainer.style.display = 'none';
            break;
    }
}

// Display game messages
function displayMessage(text, color = 'white') {
    const messagesDiv = document.getElementById('gameMessages');
    if (!messagesDiv) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.style.color = color;
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);
    
    // Keep only last 10 messages
    while (messagesDiv.children.length > 10) {
        messagesDiv.removeChild(messagesDiv.firstChild);
    }
    
    // Scroll to bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Send message to server
function sendMessage(type, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        const message = { action: type, ...data };
        console.log('Sending WebSocket message:', JSON.stringify(message));
        ws.send(JSON.stringify(message));
    } else {
        console.error('WebSocket not ready, state:', ws ? ws.readyState : 'null');
    }
}

// Helper functions for optimistic movement
function calculateNewPosition(x, y, direction) {
    switch (direction) {
        case 'up': return { x, y: y - 1 };
        case 'down': return { x, y: y + 1 };
        case 'left': return { x: x - 1, y };
        case 'right': return { x: x + 1, y };
        default: return { x, y };
    }
}

function isValidClientMove(x, y) {
    if (!gameState || !gameState.dungeon) return false;
    if (y < 0 || y >= gameState.dungeon.length || x < 0 || x >= gameState.dungeon[0].length) return false;
    
    const cell = gameState.dungeon[y][x];
    // Allow optimistic movement on walkable tiles (floors, stairs)
    // Server will handle combat and item pickup
    return cell === '.' || cell === '<' || cell === '>';
}

// Character class definitions
const characterClasses = {
    fighter: {
        name: 'Fighter',
        hp: 120,
        maxHp: 120,
        symbol: '@',
        color: 'class-fighter',
        description: 'Strong warrior with high health and melee combat skills'
    },
    wizard: {
        name: 'Wizard',
        hp: 80,
        maxHp: 80,
        symbol: '*',
        color: 'class-wizard',
        description: 'Magical spellcaster with powerful abilities but low health'
    },
    rogue: {
        name: 'Rogue',
        hp: 100,
        maxHp: 100,
        symbol: '&',
        color: 'class-rogue',
        description: 'Stealthy and agile, excels at avoiding danger'
    },
    cleric: {
        name: 'Cleric',
        hp: 110,
        maxHp: 110,
        symbol: '+',
        color: 'class-cleric',
        description: 'Holy warrior with healing abilities and balanced stats'
    }
};

// Update character preview when class changes
function updateCharacterPreview() {
    const selectedClass = document.getElementById('characterClass').value;
    const playerName = document.getElementById('playerName').value.trim();
    const classData = characterClasses[selectedClass];
    
    const previewDiv = document.getElementById('previewStats');
    previewDiv.innerHTML = `
        <div class="${classData.color}">
            <strong>${playerName || 'Your Character'} the ${classData.name}</strong><br>
            Symbol: ${classData.symbol}<br>
            Health: ${classData.hp} HP<br>
            ${classData.description}
        </div>
    `;
}

// Create character and join game
function createCharacter() {
    const playerName = document.getElementById('playerName').value.trim();
    const characterClass = document.getElementById('characterClass').value;
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    const createRoom = document.getElementById('createRoom').checked;
    
    if (!playerName) {
        alert('Please enter a character name!');
        return;
    }
    
    if (!createRoom && !roomCode) {
        // Allow empty room code to join default room
    }
    
    // Save player preferences to cookies
    setCookie('playerName', playerName);
    setCookie('characterClass', characterClass);
    setCookie('lastRoomCode', roomCode);
    
    const classData = characterClasses[characterClass];
    const character = {
        name: playerName,
        class: characterClass,
        className: classData.name,
        hp: classData.hp,
        maxHp: classData.maxHp,
        symbol: classData.symbol,
        roomCode: roomCode,
        createRoom: createRoom
    };
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        initWebSocket();
        // Wait for connection then join
        setTimeout(() => {
            sendMessage('joinGame', character);
        }, 1000);
    } else {
        sendMessage('joinGame', character);
    }
    
    loginScreen.style.display = 'none';
    gameContainer.style.display = 'flex';
    
    // Ensure the game container can receive keyboard events
    gameContainer.focus();
}

// Load saved player preferences
function loadPlayerPreferences() {
    const savedName = getCookie('playerName');
    const savedClass = getCookie('characterClass');
    const savedRoom = getCookie('lastRoomCode');
    
    if (savedName) {
        document.getElementById('playerName').value = savedName;
    }
    if (savedClass) {
        document.getElementById('characterClass').value = savedClass;
    }
    if (savedRoom) {
        document.getElementById('roomCode').value = savedRoom;
    }
    
    // Update preview with loaded values
    updateCharacterPreview();
}

// Clear saved player data
function clearSavedData() {
    deleteCookie('playerName');
    deleteCookie('characterClass');
    deleteCookie('lastRoomCode');
    
    // Clear form fields
    document.getElementById('playerName').value = '';
    document.getElementById('characterClass').value = 'fighter';
    document.getElementById('roomCode').value = '';
    document.getElementById('createRoom').checked = false;
    
    // Update preview
    updateCharacterPreview();
    
    alert('Saved data cleared!');
}



// Render the game
function renderGame() {
    if (!gameState || !gameState.dungeon) return;
    
    const dungeon = gameState.dungeon;
    const players = gameState.players;
    const monsters = gameState.monsters || [];
    const items = gameState.items || [];
    
    // Create a copy of the dungeon to add entities
    const displayDungeon = dungeon.map(row => [...row]);
    
    // Add items to the display
    items.forEach(item => {
        if (item.y >= 0 && item.y < displayDungeon.length && 
            item.x >= 0 && item.x < displayDungeon[0].length) {
            displayDungeon[item.y][item.x] = item.symbol;
        }
    });
    
    // Add living monsters to the display
    monsters.filter(m => m.hp > 0).forEach(monster => {
        if (monster.y >= 0 && monster.y < displayDungeon.length && 
            monster.x >= 0 && monster.x < displayDungeon[0].length) {
            displayDungeon[monster.y][monster.x] = monster.symbol;
        }
    });
    
    // Add players to the display (players on top)
    players.forEach((player, index) => {
        if (player.y >= 0 && player.y < displayDungeon.length && 
            player.x >= 0 && player.x < displayDungeon[0].length) {
            displayDungeon[player.y][player.x] = player.symbol;
            // Store player index for unique coloring
            displayDungeon[player.y][player.x + '_playerIndex'] = index;
            displayDungeon[player.y][player.x + '_playerData'] = player;
        }
    });
    
    // Convert to string and display with colors
    let dungeonHTML = '';
    for (let y = 0; y < displayDungeon.length; y++) {
        for (let x = 0; x < displayDungeon[y].length; x++) {
            const char = displayDungeon[y][x];
            let className = '';
            let playerIndex = displayDungeon[y][x + '_playerIndex'];
            let playerData = displayDungeon[y][x + '_playerData'];
            
            // Determine color class based on character
            if (char === '@' || char === '*' || char === '&' || char === '+') {
                // Player characters
                const player = players.find(p => p.x === x && p.y === y);
                if (player) {
                    className = characterClasses[player.class]?.color || 'class-fighter';
                    // Add unique player color variation
                    if (playerIndex !== undefined) {
                        className += ` player-${playerIndex % 8}`;
                    }
                }
            } else if (char === 'r' || char === 'g' || char === 'o' || char === 'k' || char === 's' || char === 'z' || char === 'T') {
                className = 'monster';
            } else if (char === '!' || char === '?' || char === '/' || char === ')' || char === '[' || char === '$') {
                className = 'item';
            } else if (char === '<' || char === '>') {
                className = 'stairs';
            } else if (char === '#') {
                className = 'wall';
            } else if (char === '.') {
                className = 'floor';
            } else if (char === ' ') {
                className = 'empty';
            } else {
                className = 'unknown';
            }
            
            // Add tooltip data for players
            if (playerData) {
                const isCurrentPlayer = playerData.id === myConnectionId;
                const tooltipText = `${playerData.name} the ${playerData.className}${isCurrentPlayer ? ' (You)' : ''} - HP: ${playerData.hp}/${playerData.maxHp}`;
                dungeonHTML += `<span class="${className}" data-tooltip="${tooltipText}" data-x="${x}" data-y="${y}">${char}</span>`;
            } else {
                dungeonHTML += `<span class="${className}">${char}</span>`;
            }
        }
        dungeonHTML += '\n';
    }
    
    dungeonDisplay.innerHTML = dungeonHTML;
    
    // Add tooltip event listeners to player characters
    const playerSpans = dungeonDisplay.querySelectorAll('span[data-tooltip]');
    playerSpans.forEach(span => {
        span.addEventListener('mouseenter', showPlayerTooltip);
        span.addEventListener('mouseleave', hidePlayerTooltip);
        span.addEventListener('mousemove', movePlayerTooltip);
    });
}

// Update player list
function updatePlayerList() {
    if (!gameState) return;
    
    playerList.innerHTML = '';
    gameState.players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-info';
        const classData = characterClasses[player.class] || characterClasses.fighter;
        playerDiv.innerHTML = `
            <strong class="${classData.color}">${player.name}</strong><br>
            <span class="${classData.color}">${player.className || 'Fighter'} (${player.symbol})</span><br>
            HP: ${player.hp}/${player.maxHp}<br>
            Level: ${player.level}<br>
            Pos: (${player.x}, ${player.y})
        `;
        if (player.id === myConnectionId) {
            playerDiv.style.borderColor = '#0f0';
            playerDiv.style.backgroundColor = '#002200';
        }
        playerList.appendChild(playerDiv);
    });
}

// Update room info
function updateRoomInfo() {
    if (!gameState) return;
    
    document.getElementById('currentRoom').textContent = gameState.roomCode || 'DEFAULT';
    document.getElementById('currentLevel').textContent = gameState.currentLevel || 1;
    document.getElementById('playerCount').textContent = gameState.players.length;
}

// Update current player stats
function updatePlayerStats() {
    if (!currentPlayer) return;
    
    document.getElementById('playerClass').textContent = currentPlayer.className || 'Fighter';
    document.getElementById('hp').textContent = currentPlayer.hp;
    document.getElementById('maxHp').textContent = currentPlayer.maxHp;
    document.getElementById('dungeonLevel').textContent = currentPlayer.level || 1;
    document.getElementById('experience').textContent = currentPlayer.experience || 0;
    document.getElementById('gold').textContent = currentPlayer.gold || 0;
    document.getElementById('posX').textContent = currentPlayer.x;
    document.getElementById('posY').textContent = currentPlayer.y;
    
    // Update inventory display
    const inventoryDiv = document.getElementById('inventory');
    if (inventoryDiv && currentPlayer.inventory) {
        inventoryDiv.innerHTML = '';
        if (currentPlayer.inventory.length === 0) {
            inventoryDiv.innerHTML = '<div style="color: #888;">No items</div>';
        } else {
            currentPlayer.inventory.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                let itemText = `${String.fromCharCode(97 + index)}) ${item.name}`;
                
                // Add item stats
                if (item.damage) itemText += ` (+${item.damage} dmg)`;
                if (item.defense) itemText += ` (+${item.defense} def)`;
                if (item.healing) itemText += ` (+${item.healing} hp)`;
                
                // Color by rarity
                let color = '#0f0'; // common = green
                if (item.rarity === 'uncommon') color = '#66f';
                if (item.rarity === 'rare') color = '#f6f';
                
                itemDiv.innerHTML = `<span style="color: ${color}">${itemText}</span>`;
                itemDiv.className = 'inventory-item';
                
                // Add click handler for equippable items
                if (item.type === 'weapon' || item.type === 'armor') {
                    itemDiv.style.cursor = 'pointer';
                    itemDiv.title = `Click to ${item.type === 'weapon' ? 'wield' : 'wear'} this ${item.type}`;
                    itemDiv.addEventListener('click', () => equipItem(index, item.type));
                }
                
                inventoryDiv.appendChild(itemDiv);
            });
        }
    }
}

// Simple keyboard controls - back to working version with better repeat protection
document.addEventListener('keydown', (event) => {
    if (loginScreen && loginScreen.style.display !== 'none') return;
    
    // Prevent key repeat events
    if (event.repeat) {
        event.preventDefault();
        return;
    }
    
    let direction = null;
    const key = event.key.toLowerCase();

    
    // Special handling for comma key (pickup items)
    if ((event.key === ',' || event.code === 'Comma') && !event.shiftKey) {
        event.preventDefault();
        sendMessage('pickupItem', {});
        return;
    }
    
    // Special handling for < key (shift + comma = upstairs)
    if ((event.key === '<' || (event.code === 'Comma' && event.shiftKey))) {
        event.preventDefault();
        console.log('Client: Attempting to go up stairs');
        const upMessage = { useStairs: 'up' };
        sendMessage('playerMove', upMessage);
        return;
    }
    
    // Special handling for > key (shift + period = downstairs)
    if ((event.key === '>' || (event.code === 'Period' && event.shiftKey))) {
        event.preventDefault();
        console.log('Client: Attempting to go down stairs');
        const downMessage = { useStairs: 'down' };
        sendMessage('playerMove', downMessage);
        return;
    }
    
    switch (key) {
        case 'w':
        case 'arrowup':
            direction = 'up';

            break;
        case 's':
        case 'arrowdown':
            direction = 'down';
            break;
        case 'a':
        case 'arrowleft':
            direction = 'left';
            break;
        case 'd':
        case 'arrowright':
            direction = 'right';
            break;
        case 'i':
            // Show inventory modal (NetHack style)
            showInventory();
            break;
        case 'e':
            // Equipment menu (NetHack style)
            showEquipMenu();
            break;

        case 'h':
            // Show help modal
            showHelp();
            break;


        case 'escape':
            // Close help, inventory, or equipment menu
            closeHelp();
            closeInventory();
            closeEquipMenu();
            break;
    }
    
    if (direction) {
        event.preventDefault();
        
        // Throttling for network efficiency
        const now = Date.now();
        if (now - lastMoveTime < moveDelay) {
            return;
        }
        lastMoveTime = now;
        
        // Client-side prediction with server reconciliation
        if (currentPlayer && gameState) {
            const currentSequence = ++moveSequence;
            const newPos = calculateNewPosition(currentPlayer.x, currentPlayer.y, direction);
            
            // Check if it's a valid move (no walls)
            if (isValidClientMove(newPos.x, newPos.y)) {
                // Check if there's a monster at the target position
                const monster = gameState.monsters?.find(m => m.x === newPos.x && m.y === newPos.y && m.hp > 0);
                
                if (!monster) {
                    // Store the predicted move
                    const predictedMove = {
                        sequence: currentSequence,
                        from: { x: currentPlayer.x, y: currentPlayer.y },
                        to: newPos,
                        timestamp: now,
                        direction: direction
                    };
                    pendingMoves.push(predictedMove);
                    
                    // Apply prediction immediately for smooth movement
                    currentPlayer.x = newPos.x;
                    currentPlayer.y = newPos.y;
                    clientPosition = { x: newPos.x, y: newPos.y };
                    
                    // Update the player in gameState too
                    const playerInState = gameState.players.find(p => p.id === myConnectionId);
                    if (playerInState) {
                        playerInState.x = newPos.x;
                        playerInState.y = newPos.y;
                    }
                    
                    // Render immediately for instant feedback
                    renderGame();
                    updatePlayerStats();
                    
                    // Send move to server with sequence number
                    sendMessage('playerMove', { direction, sequence: currentSequence });
                } else {
                    // Combat - don't predict, let server handle
                    sendMessage('playerMove', { direction, sequence: currentSequence });
                }
            } else {
                // Invalid move - don't send to server, just ignore
                return;
            }
        }
    }
});

// No need for keyup handling with simplified approach

// Event listeners for character creation
document.getElementById('characterClass').addEventListener('change', updateCharacterPreview);
document.getElementById('playerName').addEventListener('input', updateCharacterPreview);

// Handle Enter key in name input
document.getElementById('playerName').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        createCharacter();
    }
});

// Handle Enter key in room code input
document.getElementById('roomCode').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        createCharacter();
    }
});

// Handle create room checkbox
document.getElementById('createRoom').addEventListener('change', (event) => {
    const roomCodeInput = document.getElementById('roomCode');
    if (event.target.checked) {
        roomCodeInput.disabled = true;
        roomCodeInput.placeholder = 'Will be generated automatically';
    } else {
        roomCodeInput.disabled = false;
        roomCodeInput.placeholder = 'Enter 6-character room code';
    }
});

// Player tooltip functions
function showPlayerTooltip(event) {
    const tooltipText = event.target.getAttribute('data-tooltip');
    if (!tooltipText) return;
    
    // Create tooltip if it doesn't exist
    if (!playerTooltip) {
        playerTooltip = document.createElement('div');
        playerTooltip.className = 'player-tooltip';
        document.body.appendChild(playerTooltip);
    }
    
    playerTooltip.textContent = tooltipText;
    playerTooltip.style.display = 'block';
    movePlayerTooltip(event);
}

function hidePlayerTooltip() {
    if (playerTooltip) {
        playerTooltip.style.display = 'none';
    }
}

function movePlayerTooltip(event) {
    if (!playerTooltip) return;
    
    const x = event.pageX + 10;
    const y = event.pageY - 30;
    
    playerTooltip.style.left = x + 'px';
    playerTooltip.style.top = y + 'px';
}

// Inventory system functions (NetHack style)
function showInventory() {
    if (!currentPlayer || !currentPlayer.inventory) {
        displayMessage("You are not carrying anything.", "white");
        return;
    }
    
    const inventory = currentPlayer.inventory;
    if (inventory.length === 0) {
        displayMessage("You are not carrying anything.", "white");
        return;
    }
    
    // Create inventory modal
    let inventoryModal = document.getElementById('inventoryModal');
    if (!inventoryModal) {
        inventoryModal = document.createElement('div');
        inventoryModal.id = 'inventoryModal';
        inventoryModal.className = 'help-modal';
        inventoryModal.innerHTML = `
            <div class="help-content">
                <span class="help-close" onclick="closeInventory()">&times;</span>
                <h2>📦 Inventory</h2>
                <div id="inventoryContent"></div>
                <p style="margin-top: 15px; color: #888; font-size: 12px;">Press ESC or click X to close</p>
            </div>
        `;
        document.body.appendChild(inventoryModal);
    }
    
    // Populate inventory content
    const inventoryContent = document.getElementById('inventoryContent');
    let inventoryHTML = '';
    
    if (inventory.length === 0) {
        inventoryHTML = '<p>You are not carrying anything.</p>';
    } else {
        inventoryHTML = '<div style="margin-bottom: 15px;"><strong>Equipment:</strong><br>';
        inventoryHTML += `Weapon: ${currentPlayer.equippedWeapon ? currentPlayer.equippedWeapon.name : 'none'}<br>`;
        inventoryHTML += `Armor: ${currentPlayer.equippedArmor ? currentPlayer.equippedArmor.name : 'none'}</div>`;
        
        inventoryHTML += '<div><strong>Inventory:</strong></div>';
        inventoryHTML += '<ul style="list-style: none; padding: 0;">';
        inventory.forEach((item, index) => {
            const letter = String.fromCharCode(97 + index); // a, b, c, etc.
            let itemText = `${letter}) ${item.name}`;
            
            // Show if equipped
            const isEquipped = (currentPlayer.equippedWeapon && currentPlayer.equippedWeapon.id === item.id) ||
                              (currentPlayer.equippedArmor && currentPlayer.equippedArmor.id === item.id);
            if (isEquipped) {
                itemText += ' (equipped)';
            }
            
            // Add item stats
            const stats = [];
            if (item.damage) stats.push(`+${item.damage} dmg`);
            if (item.defense) stats.push(`+${item.defense} def`);
            if (item.healing) stats.push(`+${item.healing} hp`);
            if (item.mana) stats.push(`+${item.mana} mp`);
            if (stats.length > 0) {
                itemText += ` (${stats.join(', ')})`;
            }
            
            // Color by rarity
            let color = '#0f0'; // common = green
            if (item.rarity === 'uncommon') color = '#66f';
            if (item.rarity === 'rare') color = '#f6f';
            if (item.rarity === 'legendary') color = '#ff6';
            if (isEquipped) color = '#ff0'; // equipped items are yellow
            
            // Make items clickable for equipping
            const canEquip = (item.type === 'weapon' || item.type === 'armor') && !isEquipped;
            const clickHandler = canEquip ? `onclick="equipItem(${index})"` : '';
            const cursor = canEquip ? 'cursor: pointer; text-decoration: underline;' : '';
            
            inventoryHTML += `<li style="color: ${color}; margin: 5px 0; font-family: monospace; ${cursor}" ${clickHandler}>${itemText}</li>`;
        });
        inventoryHTML += '</ul>';
        inventoryHTML += '<p style="color: #888; font-size: 12px; margin-top: 10px;">Click on weapons/armor to equip them</p>';
    }
    
    inventoryContent.innerHTML = inventoryHTML;
    inventoryModal.style.display = 'block';
}

function closeInventory() {
    const inventoryModal = document.getElementById('inventoryModal');
    if (inventoryModal) {
        inventoryModal.style.display = 'none';
    }
}

// Equipment system
function equipItem(itemIndex) {
    if (!currentPlayer || !currentPlayer.inventory || itemIndex >= currentPlayer.inventory.length) {
        return;
    }
    
    const item = currentPlayer.inventory[itemIndex];
    
    if (item.type === 'weapon') {
        currentPlayer.equippedWeapon = item;
        displayMessage(`You wield the ${item.name}.`, 'green');
    } else if (item.type === 'armor') {
        currentPlayer.equippedArmor = item;
        displayMessage(`You wear the ${item.name}.`, 'green');
    } else {
        displayMessage(`You cannot equip the ${item.name}.`, 'red');
        return;
    }
    
    // Send equipment update to server
    sendMessage('equipItem', { 
        itemIndex: itemIndex,
        itemType: item.type 
    });
    
    // Refresh inventory display
    showInventory();
}

// Help system functions
function showHelp() {
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
        helpModal.style.display = 'block';
    }
}

function closeHelp() {
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
        helpModal.style.display = 'none';
    }
}

// Close modals when clicking outside them
window.addEventListener('click', (event) => {
    const helpModal = document.getElementById('helpModal');
    const inventoryModal = document.getElementById('inventoryModal');
    
    if (event.target === helpModal) {
        closeHelp();
    }
    if (event.target === inventoryModal) {
        closeInventory();
    }
});

// Initialize character preview on page load
window.addEventListener('load', () => {
    initWebSocket();
    loadPlayerPreferences(); // Load saved preferences first
    updateCharacterPreview();
});

// Equipment functions
function equipItem(itemIndex, itemType) {
    if (!currentPlayer || !currentPlayer.inventory) return;
    
    sendMessage('equipItem', { itemIndex, itemType });
}

function showEquipMenu() {
    if (!currentPlayer || !currentPlayer.inventory) {
        displayMessage("You have no items to equip.", "gray");
        return;
    }
    
    const equippableItems = currentPlayer.inventory.filter(item => 
        item.type === 'weapon' || item.type === 'armor'
    );
    
    if (equippableItems.length === 0) {
        displayMessage("You have no equippable items.", "gray");
        return;
    }
    
    // Create equipment modal
    let equipModal = document.getElementById('equipModal');
    if (!equipModal) {
        equipModal = document.createElement('div');
        equipModal.id = 'equipModal';
        equipModal.className = 'help-modal';
        equipModal.innerHTML = `
            <div class="help-content">
                <span class="help-close" onclick="closeEquipMenu()">&times;</span>
                <h2>⚔️ Equipment</h2>
                <div id="equipContent"></div>
                <p style="margin-top: 15px; color: #888; font-size: 12px;">Press the letter key (a, b, c...) to equip items, or ESC to close</p>
            </div>
        `;
        document.body.appendChild(equipModal);
    }
    
    // Populate equipment content
    const equipContent = document.getElementById('equipContent');
    let equipHTML = '<div style="margin-bottom: 15px;"><strong>Current Equipment:</strong><br>';
    equipHTML += `Weapon: ${currentPlayer.equippedWeapon ? currentPlayer.equippedWeapon.name : 'none'}<br>`;
    equipHTML += `Armor: ${currentPlayer.equippedArmor ? currentPlayer.equippedArmor.name : 'none'}</div>`;
    
    equipHTML += '<div><strong>Available Equipment:</strong></div>';
    equipHTML += '<ul style="list-style: none; padding: 0;">';
    
    equippableItems.forEach((item, index) => {
        const actualIndex = currentPlayer.inventory.findIndex(invItem => invItem.id === item.id);
        const letter = String.fromCharCode(97 + actualIndex);
        let itemText = `${letter}) ${item.name}`;
        
        if (item.damage) itemText += ` (+${item.damage} dmg)`;
        if (item.defense) itemText += ` (+${item.defense} def)`;
        
        let color = '#0f0';
        if (item.rarity === 'uncommon') color = '#66f';
        if (item.rarity === 'rare') color = '#f6f';
        
        const isEquipped = (currentPlayer.equippedWeapon && currentPlayer.equippedWeapon.id === item.id) ||
                          (currentPlayer.equippedArmor && currentPlayer.equippedArmor.id === item.id);
        
        if (isEquipped) {
            itemText += ' (equipped)';
            color = '#888';
        }
        
        equipHTML += `<li style="margin: 5px 0; cursor: ${isEquipped ? 'default' : 'pointer'}; color: ${color};" 
                          ${isEquipped ? '' : `onclick="equipItem(${actualIndex}, '${item.type}'); closeEquipMenu();"`}>
                          ${itemText}
                      </li>`;
    });
    
    equipHTML += '</ul>';
    equipContent.innerHTML = equipHTML;
    equipModal.style.display = 'block';
    
    // Add keyboard event listener for equipment menu
    equipModal.equipKeyHandler = (event) => {
        const key = event.key.toLowerCase();
        
        if (key === 'escape') {
            closeEquipMenu();
            return;
        }
        
        // Check if it's a letter key (a-z)
        if (key.length === 1 && key >= 'a' && key <= 'z') {
            const letterIndex = key.charCodeAt(0) - 97; // Convert 'a' to 0, 'b' to 1, etc.
            
            // Find the item at this inventory position
            if (letterIndex < currentPlayer.inventory.length) {
                const item = currentPlayer.inventory[letterIndex];
                if (item && (item.type === 'weapon' || item.type === 'armor')) {
                    // Check if already equipped
                    const isEquipped = (currentPlayer.equippedWeapon && currentPlayer.equippedWeapon.id === item.id) ||
                                      (currentPlayer.equippedArmor && currentPlayer.equippedArmor.id === item.id);
                    
                    if (!isEquipped) {
                        equipItem(letterIndex, item.type);
                        closeEquipMenu();
                    }
                }
            }
        }
    };
    
    document.addEventListener('keydown', equipModal.equipKeyHandler);
}

function closeEquipMenu() {
    const equipModal = document.getElementById('equipModal');
    if (equipModal) {
        equipModal.style.display = 'none';
        // Remove keyboard event listener
        if (equipModal.equipKeyHandler) {
            document.removeEventListener('keydown', equipModal.equipKeyHandler);
            equipModal.equipKeyHandler = null;
        }
    }
}

// Ensure game container gets focus when clicked
document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.getElementById('gameContainer');
    if (gameContainer) {
        gameContainer.addEventListener('click', () => {
            gameContainer.focus();
        });
    }
    
    loadPlayerPreferences();
    initWebSocket();
});