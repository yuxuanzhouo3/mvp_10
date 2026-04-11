'use client'

import dynamic from 'next/dynamic'

import { useAuth } from '@/components/AuthProvider'
import { LoginPage } from '@/components/LoginPage'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const Dashboard = dynamic(() => import('@/components/Dashboard').then((module) => module.Dashboard), {
  loading: () => <LoadingSpinner />,
})

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
