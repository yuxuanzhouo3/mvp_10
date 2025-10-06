'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  email: string
  name: string
  avatar?: string
  preferences: {
    industries: string[]
    locations: string[]
    experienceLevel: string
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (userData: any) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Demo user for demonstration
const demoUser: User = {
  id: '1',
  email: 'demo@jobsearch.com',
  name: 'John Doe',
  avatar: '/images/avatar.jpg',
  preferences: {
    industries: ['Technology', 'AI/ML', 'Software Development'],
    locations: ['San Francisco, CA', 'New York, NY', 'Remote'],
    experienceLevel: '5-10 years'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(demoUser) // Start with demo user
  const [loading, setLoading] = useState(false) // Set to false since we have demo user

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('auth_token')
    if (token) {
      // Validate token with backend
      validateToken(token)
    } else {
      setLoading(false)
    }
  }, [])

  const validateToken = async (token: string) => {
    try {
      // Mock API call - replace with actual backend call
      const response = await fetch('/api/auth/validate', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        localStorage.removeItem('auth_token')
      }
    } catch (error) {
      console.error('Token validation failed:', error)
      localStorage.removeItem('auth_token')
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      // Mock API call - replace with actual backend call
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      if (response.ok) {
        const { user: userData, token } = await response.json()
        localStorage.setItem('auth_token', token)
        setUser(userData)
      } else {
        // For demo purposes, always set demo user
        setUser(demoUser)
        localStorage.setItem('auth_token', 'demo-token')
      }
    } catch (error) {
      console.error('Login error:', error)
      // For demo purposes, always set demo user
      setUser(demoUser)
      localStorage.setItem('auth_token', 'demo-token')
    }
  }

  const logout = () => {
    localStorage.removeItem('auth_token')
    setUser(null)
  }

  const register = async (userData: any) => {
    try {
      // Mock API call - replace with actual backend call
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      if (response.ok) {
        const { user: newUser, token } = await response.json()
        localStorage.setItem('auth_token', token)
        setUser(newUser)
      } else {
        // For demo purposes, always set demo user
        setUser(demoUser)
        localStorage.setItem('auth_token', 'demo-token')
      }
    } catch (error) {
      console.error('Registration error:', error)
      // For demo purposes, always set demo user
      setUser(demoUser)
      localStorage.setItem('auth_token', 'demo-token')
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 