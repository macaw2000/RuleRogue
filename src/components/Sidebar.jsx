import React from 'react'
import { useGame } from '../context/GameContext'

const characterClasses = {
  fighter: { color: 'class-fighter' },
  wizard: { color: 'class-wizard' },
  rogue: { color: 'class-rogue' },
  cleric: { color: 'class-cleric' }
}

const Sidebar = ({ showInventory }) => {
  const { state } = useGame()
  const { gameState, currentPlayer, connectionId } = state

  if (!gameState) return null

  return (
    <div className="sidebar">
      {/* Player Stats */}
      {currentPlayer && (
        <div className="player-stats">
          <h3>Your Character</h3>
          <div className="stat-row">
            <span>Class:</span>
            <span className={characterClasses[currentPlayer.class]?.color}>
              {currentPlayer.className || 'Fighter'}
            </span>
          </div>
          <div className="stat-row">
            <span>HP:</span>
            <span>{currentPlayer.hp}/{currentPlayer.maxHp}</span>
          </div>
          <div className="stat-row">
            <span>Level:</span>
            <span>{currentPlayer.level || 1}</span>
          </div>
          <div className="stat-row">
            <span>Experience:</span>
            <span>{currentPlayer.experience || 0}</span>
          </div>
          <div className="stat-row">
            <span>Gold:</span>
            <span>{currentPlayer.gold || 0}</span>
          </div>
          <div className="stat-row">
            <span>Position:</span>
            <span>({currentPlayer.x}, {currentPlayer.y})</span>
          </div>
        </div>
      )}

      {/* Player List */}
      <div className="player-list">
        <h3>Players ({gameState.players?.length || 0})</h3>
        {gameState.players?.map(player => {
          const classData = characterClasses[player.class] || characterClasses.fighter
          const isCurrentPlayer = player.id === connectionId
          
          return (
            <div 
              key={player.id} 
              className={`player-info ${isCurrentPlayer ? 'current-player' : ''}`}
            >
              <strong className={classData.color}>{player.name}</strong><br />
              <span className={classData.color}>
                {player.className || 'Fighter'} ({player.symbol})
              </span><br />
              HP: {player.hp}/{player.maxHp}<br />
              Level: {player.level || 1}<br />
              Pos: ({player.x}, {player.y})
            </div>
          )
        })}
      </div>

      {/* Inventory */}
      {showInventory && currentPlayer && (
        <div className="inventory">
          <h3>Inventory</h3>
          {!currentPlayer.inventory || currentPlayer.inventory.length === 0 ? (
            <div style={{ color: '#888', fontSize: '12px' }}>No items</div>
          ) : (
            currentPlayer.inventory.map((item, index) => {
              let itemText = `${String.fromCharCode(97 + index)}) ${item.name}`
              
              // Add item stats
              if (item.damage) itemText += ` (+${item.damage} dmg)`
              if (item.defense) itemText += ` (+${item.defense} def)`
              if (item.healing) itemText += ` (+${item.healing} hp)`
              
              // Color by rarity
              let color = '#0f0' // common = green
              if (item.rarity === 'uncommon') color = '#66f'
              if (item.rarity === 'rare') color = '#f6f'
              
              return (
                <div key={item.id || index} className="inventory-item">
                  <span style={{ color }}>{itemText}</span>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Controls Help */}
      <div style={{ marginTop: '20px', fontSize: '12px', color: '#888' }}>
        <strong>Controls:</strong><br />
        WASD/Arrows: Move<br />
        H: Help<br />
        I: Inventory<br />
        ESC: Close menus
      </div>
    </div>
  )
}

export default Sidebar