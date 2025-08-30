import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { gameReducer, initialState } from './gameReducer'
import { WebSocketService } from '../services/websocket'

const GameContext = createContext()

export const useGame = () => {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}

export const GameProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  useEffect(() => {
    const wsService = new WebSocketService(dispatch)
    
    // Store websocket service in state for components to use
    dispatch({ type: 'SET_WEBSOCKET', payload: wsService })

    return () => {
      wsService.disconnect()
    }
  }, [])

  const actions = {
    joinGame: (playerData) => {
      if (state.websocket) {
        state.websocket.joinGame(playerData)
      }
    },
    
    movePlayer: (direction) => {
      if (state.websocket && state.gameState) {
        // Simple server-authoritative movement - no client prediction
        state.websocket.movePlayer(direction)
      }
    },

    sendMessage: (type, data) => {
      if (state.websocket) {
        state.websocket.send(type, data)
      }
    }
  }

  return (
    <GameContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </GameContext.Provider>
  )
}