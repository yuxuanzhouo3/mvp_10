'use client'

import { createContext, ReactNode, useContext, useEffect, useState } from 'react'

import type { AppUser } from '@/types/auth'

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (userData: { email: string; password: string; name: string }) => Promise<void>
  forgotPassword: (email: string) => Promise<string>
  resetPassword: (payload: {
    email: string
    code: string
    newPassword: string
  }) => Promise<string>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function getStoredAuthToken() {
  if (typeof window === 'undefined') {
    return null
  }

  return localStorage.getItem('auth_token')
}

async function fetchWithToken(url: string, options: RequestInit = {}) {
  const token = getStoredAuthToken()
  const headers = new Headers(options.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void refreshUser()
  }, [])

  const refreshUser = async () => {
    const token = getStoredAuthToken()

    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const response = await fetchWithToken('/api/auth/validate', {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error('Session expired.')
      }

      const userData = (await response.json()) as AppUser
      setUser(userData)
    } catch (error) {
      console.error('Token validation failed:', error)
      localStorage.removeItem('auth_token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const data = (await response.json()) as { user?: AppUser; token?: string; error?: string }

    if (!response.ok || !data.user || !data.token) {
      throw new Error(data.error || 'Login failed.')
    }

    localStorage.setItem('auth_token', data.token)
    setUser(data.user)
  }

  const logout = async () => {
    try {
      await fetchWithToken('/api/auth/logout', {
        method: 'POST',
      })
    } catch (error) {
      console.error('Logout request failed:', error)
    } finally {
      localStorage.removeItem('auth_token')
      setUser(null)
    }
  }

  const register = async (userData: { email: string; password: string; name: string }) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })

    const data = (await response.json()) as { user?: AppUser; token?: string; error?: string }

    if (!response.ok || !data.user || !data.token) {
      throw new Error(data.error || 'Registration failed.')
    }

    localStorage.setItem('auth_token', data.token)
    setUser(data.user)
  }

  const forgotPassword = async (email: string) => {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    const data = (await response.json()) as { message?: string; error?: string }

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send verification code.')
    }

    return data.message || 'Verification code sent.'
  }

  const resetPassword = async (payload: {
    email: string
    code: string
    newPassword: string
  }) => {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as { message?: string; error?: string }

    if (!response.ok) {
      throw new Error(data.error || 'Failed to reset password.')
    }

    return data.message || 'Password reset successfully.'
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, register, forgotPassword, resetPassword, refreshUser }}
    >
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
