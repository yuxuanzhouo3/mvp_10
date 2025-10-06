'use client'

import { useAuth } from '@/components/AuthProvider'
import { Dashboard } from '@/components/Dashboard'
import { LoginPage } from '@/components/LoginPage'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export default function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return <LoginPage />
  }

  return <Dashboard />
} 