'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'

interface WebSocketContextType {
  socket: Socket | null
  connected: boolean
  sendMessage: (type: string, data: any) => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Initialize WebSocket connection
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000', {
      transports: ['websocket'],
      autoConnect: false,
    })

    newSocket.on('connect', () => {
      console.log('WebSocket connected')
      setConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      setConnected(false)
    })

    newSocket.on('error', (error) => {
      console.error('WebSocket error:', error)
    })

    setSocket(newSocket)

    // Connect when component mounts
    newSocket.connect()

    return () => {
      newSocket.disconnect()
    }
  }, [])

  const sendMessage = (type: string, data: any) => {
    if (socket && connected) {
      socket.emit(type, data)
    } else {
      console.warn('WebSocket not connected')
    }
  }

  return (
    <WebSocketContext.Provider value={{ socket, connected, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
} 