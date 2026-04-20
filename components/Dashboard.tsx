'use client'

import dynamic from 'next/dynamic'
import { ReactNode, useEffect, useState, useTransition } from 'react'

import { pickLanguage } from '@/lib/i18n'
import { useAuth } from './AuthProvider'
import { useLanguage } from './LanguageProvider'
import { Navigation } from './Navigation'
import type { TabType } from '@/types/tabs'

function DashboardPanelSkeleton({ label }: { label: string }) {
  return (
    <div className="card flex min-h-[260px] items-center justify-center py-16 text-sm text-slate-500">
      {label}
    </div>
  )
}

function LocalizedDashboardPanelSkeleton({
  zhLabel,
  enLabel,
}: {
  zhLabel: string
  enLabel: string
}) {
  const { language } = useLanguage()

  return <DashboardPanelSkeleton label={pickLanguage(language, zhLabel, enLabel)} />
}

const Analytics = dynamic(() => import('./Analytics').then((module) => module.Analytics), {
  loading: () => (
    <LocalizedDashboardPanelSkeleton zhLabel="正在加载分析数据..." enLabel="Loading analytics..." />
  ),
})

const CandidateAssessmentCenter = dynamic(
  () => import('./CandidateAssessmentCenter').then((module) => module.CandidateAssessmentCenter),
  {
    loading: () => (
      <LocalizedDashboardPanelSkeleton
        zhLabel="正在加载 AI 面试中心..."
        enLabel="Loading AI interview center..."
      />
    ),
  }
)

const CandidateJobBoard = dynamic(
  () => import('./CandidateJobBoard').then((module) => module.CandidateJobBoard),
  {
    loading: () => (
      <LocalizedDashboardPanelSkeleton
        zhLabel="正在加载岗位推荐..."
        enLabel="Loading job recommendations..."
      />
    ),
  }
)

const CandidateResumeCenter = dynamic(
  () => import('./CandidateResumeCenter').then((module) => module.CandidateResumeCenter),
  {
    loading: () => (
      <LocalizedDashboardPanelSkeleton
        zhLabel="正在加载简历中心..."
        enLabel="Loading resume center..."
      />
    ),
  }
)

const RecruiterAIScreeningPanel = dynamic(
  () => import('./RecruiterAIScreeningPanel').then((module) => module.RecruiterAIScreeningPanel),
  {
    loading: () => (
      <LocalizedDashboardPanelSkeleton zhLabel="正在加载 AI 初筛..." enLabel="Loading AI screening..." />
    ),
  }
)

const RecruiterCandidateHub = dynamic(
  () => import('./RecruiterCandidateHub').then((module) => module.RecruiterCandidateHub),
  {
    loading: () => (
      <LocalizedDashboardPanelSkeleton zhLabel="正在加载候选人列表..." enLabel="Loading candidates..." />
    ),
  }
)

const RecruiterJobSetup = dynamic(
  () => import('./RecruiterJobSetup').then((module) => module.RecruiterJobSetup),
  {
    loading: () => (
      <LocalizedDashboardPanelSkeleton
        zhLabel="正在加载岗位管理..."
        enLabel="Loading job management..."
      />
    ),
  }
)

const RecruiterOverview = dynamic(
  () => import('./RecruiterOverview').then((module) => module.RecruiterOverview),
  {
    loading: () => (
      <LocalizedDashboardPanelSkeleton zhLabel="正在加载概览..." enLabel="Loading overview..." />
    ),
  }
)

const Settings = dynamic(() => import('./Settings').then((module) => module.Settings), {
  loading: () => (
    <LocalizedDashboardPanelSkeleton zhLabel="正在加载设置..." enLabel="Loading settings..." />
  ),
})

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
  const { language } = useLanguage()
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
            <div className="mb-4 text-xs text-slate-400">
              {pickLanguage(language, '页面切换中，正在准备内容...', 'Switching views and preparing content...')}
            </div>
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
