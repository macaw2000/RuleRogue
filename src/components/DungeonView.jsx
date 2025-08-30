import React from 'react'
import { useGame } from '../context/GameContext'

const characterClasses = {
  fighter: { color: 'class-fighter' },
  wizard: { color: 'class-wizard' },
  rogue: { color: 'class-rogue' },
  cleric: { color: 'class-cleric' }
}

const DungeonView = () => {
  const { state } = useGame()
  
  if (!state.gameState || !state.gameState.dungeon) {
    return <div className="dungeon">Loading dungeon...</div>
  }

  const { dungeon, players, monsters = [], items = [] } = state.gameState

  // Create a copy of the dungeon to add entities
  const displayDungeon = dungeon.map(row => [...row])

  // Add items to the display
  items.forEach(item => {
    if (item.y >= 0 && item.y < displayDungeon.length && 
        item.x >= 0 && item.x < displayDungeon[0].length) {
      displayDungeon[item.y][item.x] = item.symbol
    }
  })

  // Add living monsters to the display (server should already filter these)
  monsters.forEach(monster => {
    if (monster.y >= 0 && monster.y < displayDungeon.length && 
        monster.x >= 0 && monster.x < displayDungeon[0].length) {
      displayDungeon[monster.y][monster.x] = monster.symbol
    }
  })

  // Add players to the display (players on top)
  players.forEach((player, index) => {
    if (player.y >= 0 && player.y < displayDungeon.length && 
        player.x >= 0 && player.x < displayDungeon[0].length) {
      displayDungeon[player.y][player.x] = player.symbol
      // Store player data for styling
      displayDungeon[player.y][player.x + '_playerIndex'] = index
      displayDungeon[player.y][player.x + '_playerData'] = player
    }
  })

  // Convert to JSX elements with proper styling
  const dungeonElements = []
  for (let y = 0; y < displayDungeon.length; y++) {
    const row = []
    for (let x = 0; x < displayDungeon[y].length; x++) {
      const char = displayDungeon[y][x]
      let className = ''
      const playerIndex = displayDungeon[y][x + '_playerIndex']
      const playerData = displayDungeon[y][x + '_playerData']
      
      // Determine color class based on character
      if (char === '@' || char === '*' || char === '&' || char === '+') {
        // Player characters
        const player = players.find(p => p.x === x && p.y === y)
        if (player) {
          className = characterClasses[player.class]?.color || 'class-fighter'
          // Add unique player color variation
          if (playerIndex !== undefined) {
            className += ` player-${playerIndex % 4}`
          }
        }
      } else if (['r', 'g', 'o', 'k', 's', 'z', 'T'].includes(char)) {
        className = 'monster'
      } else if (['!', '?', '/', ')', '[', '=', '"', ']'].includes(char)) {
        className = 'item'
      } else if (char === '<' || char === '>') {
        className = 'stairs'
      } else if (char === '#') {
        className = 'wall'
      } else if (char === '.') {
        className = 'floor'
      } else if (char === ' ') {
        className = 'empty'
      }

      // Add tooltip for players
      const title = playerData ? 
        `${playerData.name} the ${playerData.className}${playerData.id === state.connectionId ? ' (You)' : ''} - HP: ${playerData.hp}/${playerData.maxHp}` : 
        undefined

      row.push(
        <span 
          key={`${x}-${y}`} 
          className={className}
          title={title}
        >
          {char}
        </span>
      )
    }
    dungeonElements.push(
      <div key={y}>
        {row}
      </div>
    )
  }

  return (
    <div className="dungeon">
      {dungeonElements}
    </div>
  )
}

export default DungeonView