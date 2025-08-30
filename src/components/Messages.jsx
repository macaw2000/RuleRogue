import React, { useEffect, useRef } from 'react'
import { useGame } from '../context/GameContext'

const Messages = () => {
  const { state } = useGame()
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [state.messages])

  return (
    <div className="messages">
      {state.messages.map((message, index) => (
        <div 
          key={`${message.timestamp}-${index}`} 
          className="message"
          style={{ color: message.color }}
        >
          {message.text}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}

export default Messages