'use client'

import { useEffect, useState } from 'react'

import { useAuth } from './AuthProvider'
import { Analytics } from './Analytics'
import { CandidateAssessmentCenter } from './CandidateAssessmentCenter'
import { CandidateJobBoard } from './CandidateJobBoard'
import { CandidateResumeCenter } from './CandidateResumeCenter'
import { Navigation } from './Navigation'
import { RecruiterAIScreeningPanel } from './RecruiterAIScreeningPanel'
import { RecruiterCandidateHub } from './RecruiterCandidateHub'
import { RecruiterJobSetup } from './RecruiterJobSetup'
import { RecruiterOverview } from './RecruiterOverview'
import { Settings } from './Settings'
import type { TabType } from '@/types/tabs'

export function Dashboard() {
  const { user } = useAuth()
  const isRecruiterView = user?.role === 'recruiter' || user?.role === 'admin'
  const [activeTab, setActiveTab] = useState<TabType>(isRecruiterView ? 'jobs' : 'dashboard')

  useEffect(() => {
    setActiveTab(isRecruiterView ? 'jobs' : 'dashboard')
  }, [isRecruiterView, user?.role])

  const renderRecruiterContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <RecruiterOverview />
      case 'jobs':
        return <RecruiterJobSetup />
      case 'candidates':
        return <RecruiterCandidateHub />
      case 'screening':
        return <RecruiterAIScreeningPanel />
      case 'settings':
        return <Settings />
      default:
        return <RecruiterJobSetup />
    }
  }

  const renderCandidateContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <CandidateJobBoard />
      case 'resume':
        return <CandidateResumeCenter />
      case 'interview':
        return <CandidateAssessmentCenter />
      case 'analytics':
        return <Analytics />
      case 'settings':
        return <Settings />
      default:
        return <CandidateJobBoard />
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} user={user} />
      <main className="pt-28 lg:pt-20">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {isRecruiterView ? renderRecruiterContent() : renderCandidateContent()}
        </div>
      </main>
    </div>
  )
}
