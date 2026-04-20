'use client'

import { ReactNode } from 'react'
import { AuthProvider } from './AuthProvider'
import { LanguageProvider } from './LanguageProvider'
import { WebSocketProvider } from './WebSocketProvider'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <WebSocketProvider>{children}</WebSocketProvider>
      </AuthProvider>
    </LanguageProvider>
  )
} 
