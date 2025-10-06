'use client'

import { ReactNode } from 'react'
import { AuthProvider } from './AuthProvider'
import { WebSocketProvider } from './WebSocketProvider'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <WebSocketProvider>
        {children}
      </WebSocketProvider>
    </AuthProvider>
  )
} 