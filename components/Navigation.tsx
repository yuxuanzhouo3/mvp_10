'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Briefcase, ChevronDown, FileSearch, FileText, LayoutDashboard, LogOut, Settings, Sparkles, User, Users } from 'lucide-react'

import { useAuth } from './AuthProvider'
import type { AppUser } from '@/types/auth'
import type { TabType } from '@/types/tabs'

interface NavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  user: AppUser | null
}

export function Navigation({ activeTab, onTabChange, user }: NavigationProps) {
  const { logout } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const navigation = useMemo(() => {
    if (user?.role === 'recruiter' || user?.role === 'admin') {
      return [
        { name: '概览', icon: LayoutDashboard, tab: 'dashboard' as const },
        { name: '岗位管理', icon: Briefcase, tab: 'jobs' as const },
        { name: '候选人', icon: Users, tab: 'candidates' as const },
        { name: 'AI 初筛', icon: FileSearch, tab: 'screening' as const },
        { name: '设置', icon: Settings, tab: 'settings' as const },
      ]
    }

    return [
      { name: '岗位推荐', icon: Sparkles, tab: 'dashboard' as const },
      { name: '我的简历', icon: FileText, tab: 'resume' as const },
      { name: 'AI 面试', icon: FileSearch, tab: 'interview' as const },
      { name: '分析', icon: BarChart3, tab: 'analytics' as const },
      { name: '设置', icon: Settings, tab: 'settings' as const },
    ]
  }, [user?.role])

  const roleLabel = user?.role === 'recruiter' ? '招聘方' : user?.role === 'admin' ? '管理员' : '求职者'

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/92 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-950 sm:text-base">AI 招聘工作台</h1>
            <p className="text-xs text-slate-500">{user?.role === 'recruiter' ? '招聘方视角' : '求职者视角'}</p>
          </div>
        </div>

        <div className="hidden items-center gap-1 lg:flex">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.name}
                onClick={() => onTabChange(item.tab)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeTab === item.tab ? 'bg-primary-100 text-primary-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 sm:block">
            {roleLabel}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu((current) => !current)}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white">
                <User className="h-4 w-4" />
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium text-slate-900">{user?.name || 'User'}</p>
                <p className="text-xs text-slate-500">{roleLabel}</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="rounded-xl bg-slate-50 px-3 py-3">
                  <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{user?.email}</p>
                </div>
                <button onClick={logout} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
                  <LogOut className="h-4 w-4" />
                  <span>退出登录</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 px-3 py-2 lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.name}
                onClick={() => onTabChange(item.tab)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  activeTab === item.tab ? 'bg-primary-100 text-primary-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
