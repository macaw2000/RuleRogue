# NetHack Rules and Gameplay Requirements

## CRITICAL NETHACK RULES - ALWAYS FOLLOW

⚠️ **ALWAYS implement proper NetHack-style gameplay mechanics**
⚠️ **NEVER show the entire map at once - implement fog of war**
⚠️ **ALWAYS make monsters actively hunt and attack the player**
⚠️ **FOLLOW traditional roguelike conventions for authentic gameplay**

## NetHack Map Symbol Standards

### CRITICAL: Proper Wall and Floor Symbols
- **`.`** = Room floors (walkable)
- **`#`** = Corridor floors (walkable)
- **`-`** = Horizontal walls (not walkable)
- **`|`** = Vertical walls (not walkable)
- **` `** (space) = Solid rock/void (not walkable)

### Wall Corner Rules
- **NEVER use `+` for wall corners** - this is incorrect
- **Corners should use proper wall characters:**
  - Top-left corner: `|` (if more vertical) or `-` (if more horizontal)
  - Top-right corner: `|` (if more vertical) or `-` (if more horizontal)
  - Bottom-left corner: `|` (if more vertical) or `-` (if more horizontal)
  - Bottom-right corner: `|` (if more vertical) or `-` (if more horizontal)
- **Use the wall character that best fits the visual flow**

### Door Rules
- **`+` = Doors (walkable) - ONLY on deeper levels (level 3+)**
- **Early levels (1-2) should have NO doors**
- **Rooms connect via open corridors and room entrances**
- **Room entrances are simply gaps in walls, not doors**

### Level Progression
- **Level 1-2:** Simple rooms with corridor connections, no doors
- **Level 3+:** May introduce doors, locked doors, secret doors
- **Level 5+:** More complex features like traps, special rooms

## Core NetHack Gameplay Rules

### 1. Fog of War (Line of Sight)
- **NEVER show the entire dungeon at once**
- **Only reveal tiles within player's line of sight** (typically 7-10 tile radius)
- **Remember explored areas** but show them dimmed/grayed out
- **Walls block line of sight** - can't see around corners
- **Monsters only visible when in line of sight**
- **Items only visible when in line of sight or previously seen**

### 2. Monster AI and Behavior
- **Monsters MUST actively hunt the player** when nearby
- **Monsters move toward player** when they detect them
- **Monsters attack when adjacent** to the player
- **Different monster types have different behaviors:**
  - Aggressive monsters (orcs, goblins) - always chase
  - Passive monsters (some animals) - only attack when attacked
  - Intelligent monsters - use tactics, avoid traps
- **Monsters should move every turn** (not just stand still)
- **Line of sight affects monster detection** - they can't see through walls

### 3. Turn-Based Movement
- **Each keypress = one turn** for the player
- **All monsters get one move per player turn**
- **Combat happens in turns** - player attacks, monster attacks back
- **Time only advances when player acts**

### 4. Traditional Roguelike Features
- **Permadeath** - when you die, you start over
- **Procedural generation** - each game is different
- **ASCII graphics** with meaningful symbols
- **Complex item system** with identification
- **Character progression** through experience and equipment

## Implementation Requirements

### Fog of War Implementation
```javascript
// Calculate visible tiles from player position
function calculateVisibleTiles(playerX, playerY, dungeon, viewRadius = 8) {
    const visible = new Set();
    
    // Bresenham line algorithm for line of sight
    for (let angle = 0; angle < 360; angle += 1) {
        const rad = angle * Math.PI / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        
        for (let distance = 0; distance <= viewRadius; distance++) {
            const x = Math.round(playerX + dx * distance);
            const y = Math.round(playerY + dy * distance);
            
            if (x < 0 || x >= dungeon[0].length || y < 0 || y >= dungeon.length) break;
            
            visible.add(`${x},${y}`);
            
            // Stop at walls
            if (dungeon[y][x] === '#') break;
        }
    }
    
    return visible;
}
```

### Monster AI Implementation
```javascript
// Monster AI - move toward player each turn
function moveMonsters(monsters, playerX, playerY, dungeon) {
    monsters.forEach(monster => {
        if (monster.hp <= 0) return;
        
        // Calculate path to player (simple pathfinding)
        const dx = playerX - monster.x;
        const dy = playerY - monster.y;
        const distance = Math.abs(dx) + Math.abs(dy);
        
        // Only move if player is within detection range
        if (distance <= monster.detectionRange || 8) {
            let newX = monster.x;
            let newY = monster.y;
            
            // Move toward player (simple AI)
            if (Math.abs(dx) > Math.abs(dy)) {
                newX += dx > 0 ? 1 : -1;
            } else {
                newY += dy > 0 ? 1 : -1;
            }
            
            // Check if move is valid
            if (isValidMove(newX, newY, dungeon)) {
                monster.x = newX;
                monster.y = newY;
            }
        }
    });
}
```

## Visual Requirements

### Fog of War Display
- **Visible areas:** Full brightness, all details shown
- **Previously explored:** Dimmed (50% opacity), no monsters/items
- **Unexplored:** Completely black/hidden
- **Player always visible** at full brightness
- **Smooth transitions** between visible/hidden areas

### Monster Behavior Indicators
- **Monsters should appear to "notice" the player** when in range
- **Movement should be purposeful** - toward player or tactical
- **Different monster symbols** should behave differently
- **Sleeping monsters** wake up when player gets close

## Gameplay Balance

### Difficulty Progression
- **Deeper levels = stronger monsters** with better AI
- **Limited visibility** makes exploration dangerous
- **Monster ambushes** possible around corners
- **Resource management** becomes critical

### Player Strategy
- **Exploration vs Safety** - risk/reward for exploring
- **Tactical positioning** - use walls and corridors
- **Resource conservation** - health, items, equipment
- **Learning monster patterns** - different behaviors to master

## Technical Implementation Notes

### Performance Considerations
- **Only calculate fog of war when player moves**
- **Cache visible tile calculations** for efficiency
- **Update monster AI in batches** to prevent lag
- **Optimize line of sight algorithms** for real-time play

### Multiplayer Adaptations
- **Each player has individual fog of war**
- **Shared exploration** - players can see what teammates explored
- **Coordinated monster AI** - monsters react to all players
- **Turn synchronization** - all players move, then all monsters

## Enforcement Rules

- If fog of war is not implemented, STOP and add it immediately
- If monsters are not actively hunting players, fix the AI
- If the entire map is visible, implement proper line of sight
- Always prioritize authentic NetHack gameplay over convenience
- Test with multiple players to ensure proper multiplayer roguelike experience

## References

- **NetHack DevTeam** - Official NetHack source code and documentation
- **Roguelike Development** - Traditional roguelike design principles
- **Line of Sight Algorithms** - Bresenham, shadowcasting, recursive shadowcasting
- **Monster AI Patterns** - Classic roguelike AI behaviors and tactics