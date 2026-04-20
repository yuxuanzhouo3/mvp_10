'use client'

import dynamic from 'next/dynamic'

import { useAuth } from '@/components/AuthProvider'
import { LandingPage } from '@/components/LandingPage'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const Dashboard = dynamic(() => import('@/components/Dashboard').then((m) => m.Dashboard), {
  loading: () => <LoadingSpinner />,
})

export default function HomePage() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (user) return <Dashboard />
  return <LandingPage />
}
