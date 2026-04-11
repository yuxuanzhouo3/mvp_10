'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Socket } from 'socket.io-client'

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
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL?.trim()

    if (!socketUrl) {
      return
    }

    let disposed = false
    let activeSocket: Socket | null = null

    void import('socket.io-client')
      .then(({ io }) => {
        if (disposed) {
          return
        }

        const newSocket = io(socketUrl, {
          transports: ['websocket'],
          autoConnect: false,
        })

        newSocket.on('connect', () => {
          setConnected(true)
        })

        newSocket.on('disconnect', () => {
          setConnected(false)
        })

        newSocket.on('error', (error) => {
          console.error('WebSocket error:', error)
        })

        activeSocket = newSocket
        setSocket(newSocket)
        newSocket.connect()
      })
      .catch((error) => {
        console.error('WebSocket initialization failed:', error)
      })

    return () => {
      disposed = true

      if (activeSocket) {
        activeSocket.disconnect()
      }
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
