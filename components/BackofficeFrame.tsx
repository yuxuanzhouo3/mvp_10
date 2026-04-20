'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'

import { getStoredAuthToken, useAuth } from '@/components/AuthProvider'
import { useLanguage } from '@/components/LanguageProvider'
import { pickLanguage, roleLabel } from '@/lib/i18n'
import type { AppUser } from '@/types/auth'

interface BackofficeFrameProps {
  user: AppUser | null
  active: 'admin' | 'market'
  title: string
  subtitle: string
  children: ReactNode
}

function navClass(active: boolean) {
  return active
    ? 'rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white'
    : 'rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950'
}

function displayRole(user: AppUser | null, language: 'zh' | 'en') {
  if (user?.role === 'market') {
    return pickLanguage(language, '运营', 'Market')
  }

  return roleLabel(user?.role, language)
}

export function buildAuthorizedHeaders() {
  const token = getStoredAuthToken()
  const headers = new Headers()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return headers
}

export function BackofficeFrame({
  user,
  active,
  title,
  subtitle,
  children,
}: BackofficeFrameProps) {
  const { language, toggleLanguage } = useLanguage()
  const { logout } = useAuth()
  const currentRoleLabel = displayRole(user, language)

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
              {pickLanguage(language, '后台工作台', 'Back Office')}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap gap-2">
              <Link href="/" className={navClass(false)}>
                {pickLanguage(language, '前台', 'Workspace')}
              </Link>
              <Link href="/admin" className={navClass(active === 'admin')}>
                /admin
              </Link>
              <Link href="/market" className={navClass(active === 'market')}>
                /market
              </Link>
            </nav>

            <button
              type="button"
              onClick={toggleLanguage}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              {language === 'zh' ? 'EN' : 'ZH'}
            </button>

            <div className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">
              {user ? `${user.name} · ${currentRoleLabel}` : pickLanguage(language, '未登录', 'Signed out')}
            </div>

            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              {pickLanguage(language, '退出', 'Log out')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
