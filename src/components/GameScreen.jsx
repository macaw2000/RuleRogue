import React, { useEffect, useState } from 'react'
import { useGame } from '../context/GameContext'
import DungeonView from './DungeonView'
import Sidebar from './Sidebar'
import Messages from './Messages'
import HelpModal from './HelpModal'

const GameScreen = ({ onLogout }) => {
  const { state, actions } = useGame()
  const [showHelp, setShowHelp] = useState(false)
  const [showInventory, setShowInventory] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Prevent default for game keys
      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'h', 'i', 'Escape'].includes(event.key)) {
        event.preventDefault()
      }

      // Ignore key repeats for movement
      if (event.repeat) return

      const key = event.key.toLowerCase()
      
      switch (key) {
        case 'w':
        case 'arrowup':
          actions.movePlayer('up')
          break
        case 's':
        case 'arrowdown':
          actions.movePlayer('down')
          break
        case 'a':
        case 'arrowleft':
          actions.movePlayer('left')
          break
        case 'd':
        case 'arrowright':
          actions.movePlayer('right')
          break
        case 'h':
          setShowHelp(true)
          break
        case 'i':
          setShowInventory(!showInventory)
          break
        case 'escape':
          setShowHelp(false)
          setShowInventory(false)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [actions, showInventory])

  if (!state.gameState) {
    return (
      <div className="game-screen">
        <div className="game-main">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            fontSize: '18px',
            color: '#0f0'
          }}>
            {state.isConnected ? 'Joining game...' : 'Connecting to server...'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="game-screen">
      <div className="game-main">
        <div className="game-header">
          <div className="room-info">
            Room: {state.gameState.roomCode || 'DEFAULT'} | 
            Level: {state.gameState.currentLevel || 1} | 
            Players: {state.gameState.players?.length || 0}
          </div>
          <button className="btn btn-secondary" onClick={onLogout}>
            Logout
          </button>
        </div>

        <div className="dungeon-container">
          <DungeonView />
        </div>

        <Messages />
      </div>

      <Sidebar showInventory={showInventory} />

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}

export default GameScreen