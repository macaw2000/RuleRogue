// Ultra-responsive multiplayer roguelike with client-side prediction
// Built for 60fps smooth gameplay with instant feedback

class ResponsiveGame {
    constructor() {
        // Network state
        this.ws = null;
        this.connectionId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Game state
        this.gameState = null;
        this.localPlayer = null;
        this.players = new Map();
        
        // Client-side prediction
        this.clientTick = 0;
        this.serverTick = 0;
        this.inputBuffer = [];
        this.stateBuffer = [];
        this.reconciliationBuffer = [];
        
        // Movement state
        this.keys = new Set();
        this.lastInputTime = 0;
        this.inputRate = 1000 / 20; // 20 inputs per second max
        
        // Rendering
        this.lastRenderTime = 0;
        this.targetFPS = 60;
        this.frameTime = 1000 / this.targetFPS;
        
        // DOM elements
        this.dungeonDisplay = document.getElementById('dungeon');
        this.playerList = document.getElementById('playerList');
        this.playerStats = document.getElementById('playerStats');
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.startGameLoop();
        this.initWebSocket();
    }
    
    initWebSocket() {
        const wsUrl = 'wss://m7usyjkjgd.execute-api.us-east-1.amazonaws.com/prod';
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected - responsive mode');
            this.reconnectAttempts = 0;
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleServerMessage(message);
        };
        
        this.ws.onclose = () => {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                setTimeout(() => {
                    this.reconnectAttempts++;
                    this.initWebSocket();
                }, 1000 * this.reconnectAttempts);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    setupEventListeners() {
        // Continuous input handling for smooth movement
        document.addEventListener('keydown', (e) => {
            if (this.isGameActive()) {
                this.keys.add(e.code);
                this.handleSpecialKeys(e);
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
        });
        
        // Prevent context menu and other interruptions
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('selectstart', e => e.preventDefault());
    }
    
    handleSpecialKeys(e) {
        const key = e.key.toLowerCase();
        
        // Non-movement keys
        if (key === ',' || e.code === 'Comma') {
            e.preventDefault();
            this.sendAction('pickup');
        } else if (key === 'i') {
            e.preventDefault();
            this.showInventory();
        } else if (key === 'h') {
            e.preventDefault();
            this.showHelp();
        } else if (key === '<' || (e.code === 'Comma' && e.shiftKey)) {
            e.preventDefault();
            this.sendAction('stairs', { direction: 'up' });
        } else if (key === '>' || (e.code === 'Period' && e.shiftKey)) {
            e.preventDefault();
            this.sendAction('stairs', { direction: 'down' });
        }
    }
    
    startGameLoop() {
        const gameLoop = (currentTime) => {
            const deltaTime = currentTime - this.lastRenderTime;
            
            if (deltaTime >= this.frameTime) {
                this.update(deltaTime);
                this.render();
                this.lastRenderTime = currentTime;
            }
            
            requestAnimationFrame(gameLoop);
        };
        
        requestAnimationFrame(gameLoop);
    }
    
    update(deltaTime) {
        if (!this.gameState || !this.localPlayer) return;
        
        // Process input at high frequency
        this.processInput();
        
        // Interpolate other players for smooth movement
        this.interpolatePlayers(deltaTime);
        
        // Clean old buffers
        this.cleanBuffers();
        
        this.clientTick++;
    }
    
    processInput() {
        const now = Date.now();
        
        // Rate limit input sending (but not local prediction)
        const shouldSendInput = now - this.lastInputTime >= this.inputRate;
        
        let direction = null;
        
        // Check movement keys
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
            direction = 'up';
        } else if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
            direction = 'down';
        } else if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
            direction = 'left';
        } else if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
            direction = 'right';
        }
        
        if (direction) {
            // Always predict locally for instant feedback
            this.predictMovement(direction);
            
            // Send to server at controlled rate
            if (shouldSendInput) {
                this.sendMovement(direction);
                this.lastInputTime = now;
            }
        }
    }
    
    predictMovement(direction) {
        if (!this.localPlayer || !this.gameState) return;
        
        const newPos = this.calculateNewPosition(
            this.localPlayer.x, 
            this.localPlayer.y, 
            direction
        );
        
        // Validate move locally
        if (this.isValidMove(newPos.x, newPos.y)) {
            // Store input for reconciliation
            this.inputBuffer.push({
                tick: this.clientTick,
                direction: direction,
                position: { x: this.localPlayer.x, y: this.localPlayer.y },
                newPosition: newPos,
                timestamp: Date.now()
            });
            
            // Apply prediction immediately
            this.localPlayer.x = newPos.x;
            this.localPlayer.y = newPos.y;
            
            // Update player in game state
            if (this.gameState.players) {
                const playerInState = this.gameState.players.find(p => p.id === this.connectionId);
                if (playerInState) {
                    playerInState.x = newPos.x;
                    playerInState.y = newPos.y;
                }
            }
        }
    }
    
    sendMovement(direction) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'playerMove',
                direction: direction,
                tick: this.clientTick,
                timestamp: Date.now()
            }));
        }
    }
    
    sendAction(action, data = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: action,
                ...data,
                tick: this.clientTick,
                timestamp: Date.now()
            }));
        }
    }
    
    handleServerMessage(message) {
        switch (message.type) {
            case 'connectionId':
                this.connectionId = message.data.connectionId;
                break;
                
            case 'gameState':
                this.handleGameState(message.data);
                break;
                
            case 'playerUpdate':
                this.handlePlayerUpdate(message.data);
                break;
                
            case 'serverTick':
                this.handleServerReconciliation(message.data);
                break;
                
            case 'message':
                this.displayMessage(message.data.text, message.data.color);
                break;
                
            case 'error':
                console.error('Server error:', message.message);
                break;
        }
    }
    
    handleGameState(gameState) {
        this.gameState = gameState;
        
        // Find local player
        if (this.connectionId && gameState.players) {
            this.localPlayer = gameState.players.find(p => p.id === this.connectionId);
        }
        
        // Update other players with interpolation data
        if (gameState.players) {
            gameState.players.forEach(player => {
                if (player.id !== this.connectionId) {
                    this.updatePlayerInterpolation(player);
                }
            });
        }
        
        this.updateUI();
    }
    
    handlePlayerUpdate(data) {
        if (data.id === this.connectionId) {
            // Server reconciliation for local player
            this.reconcileLocalPlayer(data);
        } else {
            // Update other player with interpolation
            this.updatePlayerInterpolation(data);
        }
    }
    
    reconcileLocalPlayer(serverData) {
        if (!this.localPlayer) return;
        
        const serverPos = { x: serverData.x, y: serverData.y };
        const serverTick = serverData.tick || 0;
        
        // Find the input that corresponds to this server update
        const inputIndex = this.inputBuffer.findIndex(input => input.tick <= serverTick);
        
        if (inputIndex !== -1) {
            // Remove acknowledged inputs
            this.inputBuffer.splice(0, inputIndex + 1);
            
            // Check if we need to reconcile
            const positionError = Math.abs(this.localPlayer.x - serverPos.x) + 
                                Math.abs(this.localPlayer.y - serverPos.y);
            
            if (positionError > 0) {
                console.log('Reconciling position:', this.localPlayer.x, this.localPlayer.y, '->', serverPos.x, serverPos.y);
                
                // Snap to server position
                this.localPlayer.x = serverPos.x;
                this.localPlayer.y = serverPos.y;
                
                // Re-apply unacknowledged inputs
                this.inputBuffer.forEach(input => {
                    const newPos = this.calculateNewPosition(
                        this.localPlayer.x, 
                        this.localPlayer.y, 
                        input.direction
                    );
                    
                    if (this.isValidMove(newPos.x, newPos.y)) {
                        this.localPlayer.x = newPos.x;
                        this.localPlayer.y = newPos.y;
                    }
                });
            }
        }
        
        // Update other stats
        if (serverData.hp !== undefined) this.localPlayer.hp = serverData.hp;
        if (serverData.experience !== undefined) this.localPlayer.experience = serverData.experience;
    }
    
    updatePlayerInterpolation(playerData) {
        if (!this.players.has(playerData.id)) {
            this.players.set(playerData.id, {
                ...playerData,
                renderX: playerData.x,
                renderY: playerData.y,
                targetX: playerData.x,
                targetY: playerData.y,
                lastUpdate: Date.now()
            });
        } else {
            const player = this.players.get(playerData.id);
            
            // Set new target position
            player.targetX = playerData.x;
            player.targetY = playerData.y;
            player.lastUpdate = Date.now();
            
            // Update other properties immediately
            Object.assign(player, playerData);
        }
    }
    
    interpolatePlayers(deltaTime) {
        const interpolationSpeed = 0.2; // Adjust for smoothness vs responsiveness
        
        this.players.forEach(player => {
            // Interpolate position for smooth movement
            const dx = player.targetX - player.renderX;
            const dy = player.targetY - player.renderY;
            
            if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
                player.renderX += dx * interpolationSpeed;
                player.renderY += dy * interpolationSpeed;
            } else {
                player.renderX = player.targetX;
                player.renderY = player.targetY;
            }
        });
    }
    
    calculateNewPosition(x, y, direction) {
        switch (direction) {
            case 'up': return { x, y: y - 1 };
            case 'down': return { x, y: y + 1 };
            case 'left': return { x: x - 1, y };
            case 'right': return { x: x + 1, y };
            default: return { x, y };
        }
    }
    
    isValidMove(x, y) {
        if (!this.gameState || !this.gameState.dungeon) return false;
        
        const dungeon = this.gameState.dungeon;
        if (y < 0 || y >= dungeon.length || x < 0 || x >= dungeon[0].length) {
            return false;
        }
        
        const cell = dungeon[y][x];
        return cell === '.' || cell === '<' || cell === '>';
    }
    
    render() {
        if (!this.gameState || !this.dungeonDisplay) return;
        
        const dungeon = this.gameState.dungeon;
        const monsters = this.gameState.monsters || [];
        const items = this.gameState.items || [];
        
        // Create display grid
        const displayGrid = dungeon.map(row => [...row]);
        
        // Add items
        items.forEach(item => {
            if (item.y >= 0 && item.y < displayGrid.length && 
                item.x >= 0 && item.x < displayGrid[0].length) {
                displayGrid[item.y][item.x] = item.symbol;
            }
        });
        
        // Add monsters
        monsters.filter(m => m.hp > 0).forEach(monster => {
            if (monster.y >= 0 && monster.y < displayGrid.length && 
                monster.x >= 0 && monster.x < displayGrid[0].length) {
                displayGrid[monster.y][monster.x] = monster.symbol;
            }
        });
        
        // Add local player (always at exact position)
        if (this.localPlayer) {
            const x = Math.round(this.localPlayer.x);
            const y = Math.round(this.localPlayer.y);
            if (y >= 0 && y < displayGrid.length && x >= 0 && x < displayGrid[0].length) {
                displayGrid[y][x] = this.localPlayer.symbol || '@';
            }
        }
        
        // Add other players (with interpolation)
        this.players.forEach(player => {
            const x = Math.round(player.renderX);
            const y = Math.round(player.renderY);
            if (y >= 0 && y < displayGrid.length && x >= 0 && x < displayGrid[0].length) {
                displayGrid[y][x] = player.symbol || '@';
            }
        });
        
        // Render to DOM
        this.renderGrid(displayGrid);
    }
    
    renderGrid(grid) {
        let html = '';
        
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                const char = grid[y][x];
                const className = this.getCharacterClass(char);
                html += `<span class="${className}">${char}</span>`;
            }
            html += '\n';
        }
        
        this.dungeonDisplay.innerHTML = html;
    }
    
    getCharacterClass(char) {
        if (char === '@' || char === '*' || char === '&' || char === '+') {
            return 'player';
        } else if ('rgokszT'.includes(char)) {
            return 'monster';
        } else if ('!?/)[='.includes(char)) {
            return 'item';
        } else if (char === '<' || char === '>') {
            return 'stairs';
        } else if (char === '#') {
            return 'wall';
        } else if (char === '.') {
            return 'floor';
        }
        return '';
    }
    
    updateUI() {
        if (this.localPlayer) {
            // Update stats display
            const stats = document.getElementById('playerStats');
            if (stats) {
                document.getElementById('hp').textContent = this.localPlayer.hp || 100;
                document.getElementById('maxHp').textContent = this.localPlayer.maxHp || 100;
                document.getElementById('experience').textContent = this.localPlayer.experience || 0;
                document.getElementById('gold').textContent = this.localPlayer.gold || 0;
                document.getElementById('posX').textContent = this.localPlayer.x;
                document.getElementById('posY').textContent = this.localPlayer.y;
            }
        }
        
        // Update player list
        if (this.gameState && this.gameState.players && this.playerList) {
            this.playerList.innerHTML = '';
            this.gameState.players.forEach(player => {
                const div = document.createElement('div');
                div.className = 'player-info';
                div.innerHTML = `
                    <strong>${player.name}</strong><br>
                    ${player.className || 'Fighter'} (${player.symbol})<br>
                    HP: ${player.hp}/${player.maxHp}<br>
                    Pos: (${player.x}, ${player.y})
                `;
                if (player.id === this.connectionId) {
                    div.style.borderColor = '#0f0';
                    div.style.backgroundColor = '#002200';
                }
                this.playerList.appendChild(div);
            });
        }
    }
    
    cleanBuffers() {
        const now = Date.now();
        const maxAge = 5000; // 5 seconds
        
        // Clean input buffer
        this.inputBuffer = this.inputBuffer.filter(input => 
            now - input.timestamp < maxAge
        );
        
        // Clean state buffer
        this.stateBuffer = this.stateBuffer.filter(state => 
            now - state.timestamp < maxAge
        );
    }
    
    displayMessage(text, color = 'white') {
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
        
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    isGameActive() {
        const loginScreen = document.getElementById('loginScreen');
        return loginScreen && loginScreen.style.display === 'none';
    }
    
    // Placeholder methods for UI functions
    showInventory() {
        console.log('Inventory (to be implemented)');
    }
    
    showHelp() {
        const helpModal = document.getElementById('helpModal');
        if (helpModal) {
            helpModal.style.display = 'block';
        }
    }
    
    // Join game method
    joinGame(character) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'joinGame',
                ...character
            }));
        }
    }
}

// Global game instance
let responsiveGame = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    responsiveGame = new ResponsiveGame();
});

// Export for character creation
function createCharacterResponsive() {
    const playerName = document.getElementById('playerName').value.trim();
    const characterClass = document.getElementById('characterClass').value;
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    const createRoom = document.getElementById('createRoom').checked;
    
    if (!playerName) {
        alert('Please enter a character name!');
        return;
    }
    
    const characterClasses = {
        fighter: { name: 'Fighter', hp: 120, maxHp: 120, symbol: '@' },
        wizard: { name: 'Wizard', hp: 80, maxHp: 80, symbol: '*' },
        rogue: { name: 'Rogue', hp: 100, maxHp: 100, symbol: '&' },
        cleric: { name: 'Cleric', hp: 110, maxHp: 110, symbol: '+' }
    };
    
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
    
    if (responsiveGame) {
        responsiveGame.joinGame(character);
        
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'flex';
        document.getElementById('gameContainer').focus();
    }
}

// Helper functions for UI
function closeHelp() {
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
        helpModal.style.display = 'none';
    }
}

// Update character preview (existing function)
function updateCharacterPreview() {
    // Keep existing implementation
}

// Load player preferences (existing function)  
function loadPlayerPreferences() {
    // Keep existing implementation
}

// Clear saved data (existing function)
function clearSavedData() {
    // Keep existing implementation
}