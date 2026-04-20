'use client'

import { useEffect, useMemo, useState } from 'react'

import { getStoredAuthToken, useAuth } from '@/components/AuthProvider'
import { BackofficeFrame, buildAuthorizedHeaders } from '@/components/BackofficeFrame'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useLanguage } from '@/components/LanguageProvider'
import { pickLanguage, roleLabel } from '@/lib/i18n'
import type { AdminAiDashboardResponse, AdminAiUserSummary } from '@/types/admin'

function featureLabel(feature: string, language: 'zh' | 'en') {
  switch (feature) {
    case 'resume_analysis':
      return pickLanguage(language, '简历分析', 'Resume Analysis')
    case 'assessment_generation':
      return pickLanguage(language, '面试题生成', 'Assessment Generation')
    case 'recruiter_screening':
      return pickLanguage(language, '招聘筛选', 'Recruiter Screening')
    default:
      return feature
  }
}

function statusLabel(status: AdminAiUserSummary['status'], language: 'zh' | 'en') {
  switch (status) {
    case 'trial_available':
      return pickLanguage(language, '可继续试用', 'Trial Available')
    case 'payment_required':
      return pickLanguage(language, '需收费', 'Payment Required')
    case 'paid_active':
      return pickLanguage(language, '已开通', 'Paid Active')
    case 'per_user_budget_reached':
      return pickLanguage(language, '用户额度用尽', 'User Budget Reached')
    case 'monthly_budget_reached':
      return pickLanguage(language, '平台额度用尽', 'Monthly Budget Reached')
    case 'user_limit_reached':
      return pickLanguage(language, '月活用户上限', 'User Capacity Reached')
    case 'disabled':
      return pickLanguage(language, '已停用', 'Disabled')
    default:
      return status
  }
}

function displayRole(role: AdminAiUserSummary['role'], language: 'zh' | 'en') {
  if (role === 'market') {
    return pickLanguage(language, '运营', 'Market')
  }

  return roleLabel(role, language)
}

export function AdminConsole() {
  const { user, loading } = useAuth()
  const { language } = useLanguage()
  const [data, setData] = useState<AdminAiDashboardResponse | null>(null)
  const [error, setError] = useState('')
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null)
  const [configDraft, setConfigDraft] = useState({
    enabled: true,
    monthlyBudgetRmb: 10,
    userLimit: 100,
    perUserMonthlyBudgetRmb: 0.1,
    freeTrialCount: 3,
  })

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(language === 'en' ? 'en-US' : 'zh-CN', {
        style: 'currency',
        currency: 'CNY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [language]
  )

  useEffect(() => {
    if (!data) {
      return
    }

    setConfigDraft({
      enabled: data.config.enabled,
      monthlyBudgetRmb: data.config.monthlyBudgetRmb,
      userLimit: data.config.userLimit,
      perUserMonthlyBudgetRmb: data.config.perUserMonthlyBudgetRmb,
      freeTrialCount: data.config.freeTrialCount,
    })
  }, [data])

  useEffect(() => {
    if (loading) {
      return
    }

    if (!user || user.role !== 'admin' || !getStoredAuthToken()) {
      setLoadingData(false)
      return
    }

    void loadDashboard()
  }, [loading, user?.id, user?.role])

  async function loadDashboard() {
    setLoadingData(true)
    setError('')

    try {
      const response = await fetch('/api/admin/ai', {
        headers: buildAuthorizedHeaders(),
        cache: 'no-store',
      })
      const payload = (await response.json()) as AdminAiDashboardResponse | { error?: string }

      if (!response.ok || !('config' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Failed to load the admin console.')
      }

      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load the admin console.')
    } finally {
      setLoadingData(false)
    }
  }

  async function saveConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/admin/ai', {
        method: 'PUT',
        headers: new Headers({
          ...Object.fromEntries(buildAuthorizedHeaders().entries()),
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(configDraft),
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save AI quota settings.')
      }

      await loadDashboard()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save AI quota settings.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleUserAccess(targetUserId: string, aiPaidEnabled: boolean) {
    setTogglingUserId(targetUserId)
    setError('')

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(targetUserId)}`, {
        method: 'PATCH',
        headers: new Headers({
          ...Object.fromEntries(buildAuthorizedHeaders().entries()),
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ aiPaidEnabled }),
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update user AI access.')
      }

      await loadDashboard()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update user AI access.')
    } finally {
      setTogglingUserId(null)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return (
      <BackofficeFrame
        active="admin"
        user={null}
        title={pickLanguage(language, '管理员后台', 'Admin Console')}
        subtitle={pickLanguage(language, '请先登录后访问 /admin。', 'Sign in first to access /admin.')}
      >
        <div className="card text-sm text-slate-600">
          {pickLanguage(language, '当前未登录。请先返回首页完成登录。', 'You are not signed in. Return to the homepage and log in first.')}
        </div>
      </BackofficeFrame>
    )
  }

  if (user.role !== 'admin') {
    return (
      <BackofficeFrame
        active="admin"
        user={user}
        title={pickLanguage(language, '管理员后台', 'Admin Console')}
        subtitle={pickLanguage(language, '当前账号没有管理员权限。', 'This account does not have admin access.')}
      >
        <div className="card text-sm text-slate-600">
          {pickLanguage(language, '只有管理员可以访问这个后台。', 'Only administrators can open this console.')}
        </div>
      </BackofficeFrame>
    )
  }

  return (
    <BackofficeFrame
      active="admin"
      user={user}
      title={pickLanguage(language, '管理员后台', 'Admin Console')}
      subtitle={pickLanguage(
        language,
        '配置 AI 月预算、用户上限、免费体验次数，并控制谁可以继续使用付费 AI。',
        'Configure the AI monthly budget, user capacity, free trials, and which accounts can keep using paid AI.'
      )}
    >
      {loadingData || !data ? (
        <div className="card text-sm text-slate-500">
          {pickLanguage(language, '正在加载后台数据...', 'Loading admin data...')}
        </div>
      ) : (
        <div className="space-y-6">
          {error && <div className="card border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div>}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card">
              <p className="text-sm text-slate-500">{pickLanguage(language, '本月 AI 支出', 'AI Spend This Month')}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">
                {currencyFormatter.format(data.overview.totalEstimatedSpendRmb)}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {pickLanguage(language, '剩余预算', 'Remaining')}{' '}
                {currencyFormatter.format(data.overview.monthlyBudgetRemainingRmb)}
              </p>
            </div>

            <div className="card">
              <p className="text-sm text-slate-500">{pickLanguage(language, '活跃 AI 用户', 'Active AI Users')}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{data.overview.activeUserCount}</p>
              <p className="mt-2 text-sm text-slate-500">
                {pickLanguage(language, '剩余席位', 'Remaining Capacity')} {data.overview.userLimitRemaining}
              </p>
            </div>

            <div className="card">
              <p className="text-sm text-slate-500">{pickLanguage(language, '需收费提醒用户', 'Users Requiring Payment')}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{data.overview.paymentRequiredUserCount}</p>
              <p className="mt-2 text-sm text-slate-500">
                {pickLanguage(language, '已开通用户', 'Paid-enabled Users')} {data.overview.paidEnabledUserCount}
              </p>
            </div>

            <div className="card">
              <p className="text-sm text-slate-500">{pickLanguage(language, '本月 AI 调用', 'AI Uses This Month')}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{data.overview.totalUsageCount}</p>
              <p className="mt-2 text-sm text-slate-500">
                {pickLanguage(language, '试用单价', 'Estimated Unit Cost')}{' '}
                {currencyFormatter.format(data.config.perUserMonthlyBudgetRmb / data.config.freeTrialCount)}
              </p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <form className="card space-y-5" onSubmit={(event) => void saveConfig(event)}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    {pickLanguage(language, 'AI 配额配置', 'AI Quota Settings')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {pickLanguage(
                      language,
                      '默认按 10 元/月、100 用户、每用户 0.1 元/月控制，并允许 3 次免费体验。',
                      'The default policy is 10 RMB per month, 100 users, 0.1 RMB per user per month, with 3 free trials.'
                    )}
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={configDraft.enabled}
                    onChange={(event) =>
                      setConfigDraft((current) => ({ ...current, enabled: event.target.checked }))
                    }
                  />
                  <span>{pickLanguage(language, '启用 AI 配额', 'Enable AI Quota')}</span>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-2 block font-medium text-slate-700">
                    {pickLanguage(language, '平台月预算 (RMB)', 'Monthly Platform Budget (RMB)')}
                  </span>
                  <input
                    className="input-field"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={configDraft.monthlyBudgetRmb}
                    onChange={(event) =>
                      setConfigDraft((current) => ({
                        ...current,
                        monthlyBudgetRmb: Number(event.target.value),
                      }))
                    }
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-2 block font-medium text-slate-700">
                    {pickLanguage(language, '月可用用户数', 'Monthly User Capacity')}
                  </span>
                  <input
                    className="input-field"
                    type="number"
                    min="1"
                    step="1"
                    value={configDraft.userLimit}
                    onChange={(event) =>
                      setConfigDraft((current) => ({
                        ...current,
                        userLimit: Number(event.target.value),
                      }))
                    }
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-2 block font-medium text-slate-700">
                    {pickLanguage(language, '每用户月预算 (RMB)', 'Per-user Monthly Budget (RMB)')}
                  </span>
                  <input
                    className="input-field"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={configDraft.perUserMonthlyBudgetRmb}
                    onChange={(event) =>
                      setConfigDraft((current) => ({
                        ...current,
                        perUserMonthlyBudgetRmb: Number(event.target.value),
                      }))
                    }
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-2 block font-medium text-slate-700">
                    {pickLanguage(language, '免费体验次数', 'Free Trial Count')}
                  </span>
                  <input
                    className="input-field"
                    type="number"
                    min="1"
                    step="1"
                    value={configDraft.freeTrialCount}
                    onChange={(event) =>
                      setConfigDraft((current) => ({
                        ...current,
                        freeTrialCount: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {pickLanguage(language, '当前预计每次 AI 使用成本约为', 'Current estimated cost per AI use is about')}{' '}
                <span className="font-semibold text-slate-950">
                  {currencyFormatter.format(configDraft.perUserMonthlyBudgetRmb / Math.max(configDraft.freeTrialCount, 1))}
                </span>
              </div>

              <button type="submit" className="btn-primary" disabled={saving}>
                {saving
                  ? pickLanguage(language, '保存中...', 'Saving...')
                  : pickLanguage(language, '保存配置', 'Save Settings')}
              </button>
            </form>

            <div className="card">
              <h2 className="text-lg font-semibold text-slate-950">
                {pickLanguage(language, '最近 AI 使用记录', 'Recent AI Usage')}
              </h2>
              <div className="mt-4 space-y-3">
                {data.recentUsage.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    {pickLanguage(language, '本月还没有 AI 使用记录。', 'No AI activity has been recorded this month yet.')}
                  </div>
                ) : (
                  data.recentUsage.map((record) => (
                    <div
                      key={record.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-950">{record.userName}</p>
                          <p className="mt-1 text-xs text-slate-500">{record.userEmail}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-slate-950">{featureLabel(record.feature, language)}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {record.accessMode === 'trial'
                              ? pickLanguage(language, '免费试用', 'Trial')
                              : pickLanguage(language, '付费额度', 'Paid')}
                            {' · '}
                            {currencyFormatter.format(record.estimatedCostRmb)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {pickLanguage(language, '用户 AI 权限管理', 'User AI Access')}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {pickLanguage(
                    language,
                    '免费体验用完后，可以在这里为指定用户打开继续使用 AI 的权限。',
                    'After free trials are exhausted, enable continued AI access for selected users here.'
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-3 pr-4 font-medium">{pickLanguage(language, '用户', 'User')}</th>
                    <th className="pb-3 pr-4 font-medium">{pickLanguage(language, '角色', 'Role')}</th>
                    <th className="pb-3 pr-4 font-medium">{pickLanguage(language, '本月使用', 'Uses')}</th>
                    <th className="pb-3 pr-4 font-medium">{pickLanguage(language, '状态', 'Status')}</th>
                    <th className="pb-3 pr-4 font-medium">{pickLanguage(language, '功能', 'Features')}</th>
                    <th className="pb-3 pr-4 font-medium">{pickLanguage(language, '付费开关', 'Paid Access')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.users.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="py-4 pr-4">
                        <p className="font-medium text-slate-950">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.email}</p>
                      </td>
                      <td className="py-4 pr-4 text-slate-700">
                        <p>{displayRole(item.role, language)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.plan} · {item.billingStatus}
                        </p>
                      </td>
                      <td className="py-4 pr-4 text-slate-700">
                        <p>
                          {item.usageCount}{' '}
                          {pickLanguage(language, '次', 'uses')}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {currencyFormatter.format(item.estimatedSpendRmb)}
                        </p>
                      </td>
                      <td className="py-4 pr-4 text-slate-700">
                        <p>{statusLabel(item.status, language)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {pickLanguage(language, '剩余试用', 'Trials left')} {item.remainingTrialCount}
                        </p>
                      </td>
                      <td className="py-4 pr-4 text-slate-700">
                        {item.featuresUsed.length > 0
                          ? item.featuresUsed.map((feature) => featureLabel(feature, language)).join(', ')
                          : pickLanguage(language, '暂无', 'None yet')}
                      </td>
                      <td className="py-4 pr-0">
                        <button
                          type="button"
                          className={item.aiPaidEnabled ? 'btn-primary' : 'btn-secondary'}
                          disabled={togglingUserId === item.id}
                          onClick={() => void toggleUserAccess(item.id, !item.aiPaidEnabled)}
                        >
                          {togglingUserId === item.id
                            ? pickLanguage(language, '更新中...', 'Updating...')
                            : item.aiPaidEnabled
                              ? pickLanguage(language, '已开通', 'Enabled')
                              : pickLanguage(language, '开启付费权限', 'Enable Paid Access')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </BackofficeFrame>
  )
}
