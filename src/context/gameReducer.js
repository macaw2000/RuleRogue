export const initialState = {
  websocket: null,
  connectionId: null,
  gameState: null,
  currentPlayer: null,
  messages: [],
  isConnected: false,
  error: null
}

export const gameReducer = (state, action) => {
  switch (action.type) {
    case 'SET_WEBSOCKET':
      return {
        ...state,
        websocket: action.payload
      }

    case 'SET_CONNECTION_ID':
      return {
        ...state,
        connectionId: action.payload,
        isConnected: true
      }

    case 'SET_GAME_STATE':
      const gameState = action.payload
      const currentPlayer = gameState.players?.find(p => p.id === state.connectionId)
      
      return {
        ...state,
        gameState,
        currentPlayer
      }

    case 'UPDATE_PLAYER':
      if (!state.gameState) return state
      
      const updatedPlayers = state.gameState.players.map(player => 
        player.id === action.payload.id 
          ? { 
              ...player, 
              // Only update non-position stats to avoid rubberbanding
              // Position updates come from gameState messages
              hp: action.payload.hp !== undefined ? action.payload.hp : player.hp,
              experience: action.payload.experience !== undefined ? action.payload.experience : player.experience,
              gold: action.payload.gold !== undefined ? action.payload.gold : player.gold
            }
          : player
      )
      
      const updatedGameState = {
        ...state.gameState,
        players: updatedPlayers
      }
      
      const updatedCurrentPlayer = updatedPlayers.find(p => p.id === state.connectionId)
      
      return {
        ...state,
        gameState: updatedGameState,
        currentPlayer: updatedCurrentPlayer
      }

    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [
          ...state.messages.slice(-9), // Keep only last 9 messages
          action.payload
        ]
      }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      }

    case 'DISCONNECT':
      return {
        ...state,
        isConnected: false,
        connectionId: null,
        gameState: null,
        currentPlayer: null
      }

    default:
      return state
  }
}