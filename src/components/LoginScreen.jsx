import React, { useState, useEffect } from 'react'
import { useGame } from '../context/GameContext'

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
}

const LoginScreen = ({ onLogin }) => {
  const { actions } = useGame()
  const [playerName, setPlayerName] = useState('')
  const [characterClass, setCharacterClass] = useState('fighter')
  const [roomCode, setRoomCode] = useState('')
  const [createRoom, setCreateRoom] = useState(false)

  // Load saved preferences
  useEffect(() => {
    const savedName = localStorage.getItem('playerName')
    const savedClass = localStorage.getItem('characterClass')
    const savedRoom = localStorage.getItem('lastRoomCode')
    
    if (savedName) setPlayerName(savedName)
    if (savedClass) setCharacterClass(savedClass)
    if (savedRoom) setRoomCode(savedRoom)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!playerName.trim()) {
      alert('Please enter a character name!')
      return
    }

    // Save preferences
    localStorage.setItem('playerName', playerName)
    localStorage.setItem('characterClass', characterClass)
    localStorage.setItem('lastRoomCode', roomCode)

    const classData = characterClasses[characterClass]
    const character = {
      name: playerName.trim(),
      class: characterClass,
      className: classData.name,
      hp: classData.hp,
      maxHp: classData.maxHp,
      symbol: classData.symbol,
      roomCode: roomCode.trim().toUpperCase(),
      createRoom: createRoom
    }

    actions.joinGame(character)
    onLogin()
  }

  const clearSavedData = () => {
    localStorage.removeItem('playerName')
    localStorage.removeItem('characterClass')
    localStorage.removeItem('lastRoomCode')
    setPlayerName('')
    setCharacterClass('fighter')
    setRoomCode('')
    setCreateRoom(false)
  }

  const selectedClass = characterClasses[characterClass]

  return (
    <div className="login-screen">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>🗡️ Multiplayer Roguelike</h1>
        
        <div className="form-group">
          <label htmlFor="playerName">Character Name:</label>
          <input
            type="text"
            id="playerName"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your character name"
            maxLength={20}
          />
        </div>

        <div className="form-group">
          <label htmlFor="characterClass">Character Class:</label>
          <select
            id="characterClass"
            value={characterClass}
            onChange={(e) => setCharacterClass(e.target.value)}
          >
            {Object.entries(characterClasses).map(([key, classData]) => (
              <option key={key} value={key}>
                {classData.name}
              </option>
            ))}
          </select>
        </div>

        <div className="character-preview">
          <div className={selectedClass.color}>
            <strong>{playerName || 'Your Character'} the {selectedClass.name}</strong><br />
            Symbol: {selectedClass.symbol}<br />
            Health: {selectedClass.hp} HP<br />
            {selectedClass.description}
          </div>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={createRoom}
              onChange={(e) => setCreateRoom(e.target.checked)}
            />
            {' '}Create New Room
          </label>
        </div>

        {!createRoom && (
          <div className="form-group">
            <label htmlFor="roomCode">Room Code (optional):</label>
            <input
              type="text"
              id="roomCode"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Enter 6-character room code"
              maxLength={6}
            />
          </div>
        )}

        <button type="submit" className="btn">
          Join Game
        </button>

        <button type="button" className="btn btn-secondary" onClick={clearSavedData}>
          Clear Saved Data
        </button>
      </form>
    </div>
  )
}

export default LoginScreen