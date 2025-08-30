export class WebSocketService {
  constructor(dispatch) {
    this.dispatch = dispatch
    this.ws = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.connect()
  }

  connect() {
    const wsUrl = 'wss://nv9uxm5a4h.execute-api.us-east-1.amazonaws.com/prod'
    
    this.ws = new WebSocket(wsUrl)
    
    this.ws.onopen = () => {
      console.log('Connected to game server')
      this.reconnectAttempts = 0
    }
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      this.handleMessage(message)
    }
    
    this.ws.onclose = () => {
      console.log('Disconnected from game server')
      this.dispatch({ type: 'DISCONNECT' })
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++
          console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
          this.connect()
        }, 2000 * this.reconnectAttempts)
      }
    }
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.dispatch({ type: 'SET_ERROR', payload: 'Connection error' })
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'connectionId':
        this.dispatch({ 
          type: 'SET_CONNECTION_ID', 
          payload: message.data.connectionId 
        })
        break

      case 'gameState':
        this.dispatch({ 
          type: 'SET_GAME_STATE', 
          payload: message.data 
        })
        break

      case 'playerUpdate':
        this.dispatch({ 
          type: 'UPDATE_PLAYER', 
          payload: message.data 
        })
        break

      case 'message':
        this.dispatch({ 
          type: 'ADD_MESSAGE', 
          payload: {
            text: message.data.text,
            color: message.data.color || 'white',
            timestamp: Date.now()
          }
        })
        break

      case 'error':
        this.dispatch({ 
          type: 'SET_ERROR', 
          payload: message.message 
        })
        break

      default:
        console.log('Unknown message type:', message.type)
    }
  }

  send(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = { action: type, ...data }
      this.ws.send(JSON.stringify(message))
    } else {
      console.error('WebSocket not ready')
    }
  }

  joinGame(playerData) {
    this.send('joinGame', playerData)
  }

  movePlayer(direction) {
    this.send('playerMove', { direction })
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
    }
  }
}