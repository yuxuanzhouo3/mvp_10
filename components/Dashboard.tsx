'use client'

import dynamic from 'next/dynamic'
import { ReactNode, useEffect, useState, useTransition } from 'react'

import { useAuth } from './AuthProvider'
import { Navigation } from './Navigation'
import type { TabType } from '@/types/tabs'

const Analytics = dynamic(() => import('./Analytics').then((module) => module.Analytics), {
  loading: () => <DashboardPanelSkeleton label="正在加载分析数据..." />,
})

const CandidateAssessmentCenter = dynamic(
  () => import('./CandidateAssessmentCenter').then((module) => module.CandidateAssessmentCenter),
  {
    loading: () => <DashboardPanelSkeleton label="正在加载 AI 面试中心..." />,
  }
)

const CandidateJobBoard = dynamic(() => import('./CandidateJobBoard').then((module) => module.CandidateJobBoard), {
  loading: () => <DashboardPanelSkeleton label="正在加载岗位推荐..." />,
})

const CandidateResumeCenter = dynamic(
  () => import('./CandidateResumeCenter').then((module) => module.CandidateResumeCenter),
  {
    loading: () => <DashboardPanelSkeleton label="正在加载简历中心..." />,
  }
)

const RecruiterAIScreeningPanel = dynamic(
  () => import('./RecruiterAIScreeningPanel').then((module) => module.RecruiterAIScreeningPanel),
  {
    loading: () => <DashboardPanelSkeleton label="正在加载 AI 初筛..." />,
  }
)

const RecruiterCandidateHub = dynamic(
  () => import('./RecruiterCandidateHub').then((module) => module.RecruiterCandidateHub),
  {
    loading: () => <DashboardPanelSkeleton label="正在加载候选人列表..." />,
  }
)

const RecruiterJobSetup = dynamic(
  () => import('./RecruiterJobSetup').then((module) => module.RecruiterJobSetup),
  {
    loading: () => <DashboardPanelSkeleton label="正在加载岗位管理..." />,
  }
)

const RecruiterOverview = dynamic(
  () => import('./RecruiterOverview').then((module) => module.RecruiterOverview),
  {
    loading: () => <DashboardPanelSkeleton label="正在加载概览..." />,
  }
)

const Settings = dynamic(() => import('./Settings').then((module) => module.Settings), {
  loading: () => <DashboardPanelSkeleton label="正在加载设置..." />,
})

function DashboardPanelSkeleton({ label }: { label: string }) {
  return (
    <div className="card flex min-h-[260px] items-center justify-center py-16 text-sm text-slate-500">
      {label}
    </div>
  )
}

function TabPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return <div className={active ? 'block' : 'hidden'}>{children}</div>
}

function markTabLoaded(
  current: Partial<Record<TabType, true>>,
  tab: TabType
): Partial<Record<TabType, true>> {
  if (current[tab]) {
    return current
  }

  return { ...current, [tab]: true }
}

export function Dashboard() {
  const { user } = useAuth()
  const isRecruiterView = user?.role === 'recruiter' || user?.role === 'admin'
  const defaultTab: TabType = isRecruiterView ? 'jobs' : 'dashboard'
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab)
  const [loadedTabs, setLoadedTabs] = useState<Partial<Record<TabType, true>>>({
    [defaultTab]: true,
  })
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setLoadedTabs((current) => markTabLoaded(current, defaultTab))
    setActiveTab(defaultTab)
  }, [defaultTab])

  function handleTabChange(nextTab: TabType) {
    if (nextTab === activeTab) {
      return
    }

    setLoadedTabs((current) => markTabLoaded(current, nextTab))
    startTransition(() => {
      setActiveTab(nextTab)
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation activeTab={activeTab} onTabChange={handleTabChange} user={user} />
      <main className="pt-28 lg:pt-20">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {isPending && (
            <div className="mb-4 text-xs text-slate-400">页面切换中，正在准备内容...</div>
          )}

          {isRecruiterView ? (
            <>
              {loadedTabs.dashboard && (
                <TabPanel active={activeTab === 'dashboard'}>
                  <RecruiterOverview />
                </TabPanel>
              )}
              {loadedTabs.jobs && (
                <TabPanel active={activeTab === 'jobs'}>
                  <RecruiterJobSetup />
                </TabPanel>
              )}
              {loadedTabs.candidates && (
                <TabPanel active={activeTab === 'candidates'}>
                  <RecruiterCandidateHub />
                </TabPanel>
              )}
              {loadedTabs.screening && (
                <TabPanel active={activeTab === 'screening'}>
                  <RecruiterAIScreeningPanel />
                </TabPanel>
              )}
              {loadedTabs.settings && (
                <TabPanel active={activeTab === 'settings'}>
                  <Settings />
                </TabPanel>
              )}
            </>
          ) : (
            <>
              {loadedTabs.dashboard && (
                <TabPanel active={activeTab === 'dashboard'}>
                  <CandidateJobBoard />
                </TabPanel>
              )}
              {loadedTabs.resume && (
                <TabPanel active={activeTab === 'resume'}>
                  <CandidateResumeCenter />
                </TabPanel>
              )}
              {loadedTabs.interview && (
                <TabPanel active={activeTab === 'interview'}>
                  <CandidateAssessmentCenter />
                </TabPanel>
              )}
              {loadedTabs.analytics && (
                <TabPanel active={activeTab === 'analytics'}>
                  <Analytics />
                </TabPanel>
              )}
              {loadedTabs.settings && (
                <TabPanel active={activeTab === 'settings'}>
                  <Settings />
                </TabPanel>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
