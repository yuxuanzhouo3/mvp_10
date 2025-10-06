'use client'

import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { Navigation } from './Navigation'
import { JobRecommendations } from './JobRecommendations'
import { ResumeAnalysis } from './ResumeAnalysis'
import { InterviewSimulator } from './InterviewSimulator'
import { Analytics } from './Analytics'
import { Settings } from './Settings'

type TabType = 'dashboard' | 'resume' | 'interview' | 'analytics' | 'settings'

export function Dashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <JobRecommendations />
      case 'resume':
        return <ResumeAnalysis />
      case 'interview':
        return <InterviewSimulator />
      case 'analytics':
        return <Analytics />
      case 'settings':
        return <Settings />
      default:
        return <JobRecommendations />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} user={user} />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {renderContent()}
        </div>
      </main>
    </div>
  )
} 