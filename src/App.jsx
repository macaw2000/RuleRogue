import React, { useState, useEffect } from 'react'
import LoginScreen from './components/LoginScreen'
import GameScreen from './components/GameScreen'
import { GameProvider } from './context/GameContext'
import './index.css'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  return (
    <div className="app">
      <GameProvider>
        {!isLoggedIn ? (
          <LoginScreen onLogin={() => setIsLoggedIn(true)} />
        ) : (
          <GameScreen onLogout={() => setIsLoggedIn(false)} />
        )}
      </GameProvider>
    </div>
  )
}

export default App