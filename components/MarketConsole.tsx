'use client'

import { useEffect, useMemo, useState } from 'react'

import { BackofficeFrame, buildAuthorizedHeaders } from '@/components/BackofficeFrame'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useAuth } from '@/components/AuthProvider'
import { useLanguage } from '@/components/LanguageProvider'
import { pickLanguage } from '@/lib/i18n'
import type { MarketOverviewResponse } from '@/types/admin'

function stageLabel(stage: string, language: 'zh' | 'en') {
  switch (stage) {
    case 'applied':
      return pickLanguage(language, '已投递', 'Applied')
    case 'screening':
      return pickLanguage(language, '筛选中', 'Screening')
    case 'interview':
      return pickLanguage(language, '面试中', 'Interview')
    case 'offer':
      return pickLanguage(language, 'Offer', 'Offer')
    case 'hired':
      return pickLanguage(language, '已录用', 'Hired')
    case 'rejected':
      return pickLanguage(language, '未通过', 'Rejected')
    case 'withdrawn':
      return pickLanguage(language, '已撤回', 'Withdrawn')
    default:
      return stage
  }
}

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

export function MarketConsole() {
  const { user, loading } = useAuth()
  const { language } = useLanguage()
  const [data, setData] = useState<MarketOverviewResponse | null>(null)
  const [error, setError] = useState('')
  const [loadingData, setLoadingData] = useState(true)

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
    if (loading) {
      return
    }

    if (!user || (user.role !== 'admin' && user.role !== 'market')) {
      setLoadingData(false)
      return
    }

    void loadOverview()
  }, [loading, user?.id, user?.role])

  async function loadOverview() {
    setLoadingData(true)
    setError('')

    try {
      const response = await fetch('/api/market/overview', {
        headers: buildAuthorizedHeaders(),
        cache: 'no-store',
      })
      const payload = (await response.json()) as MarketOverviewResponse | { error?: string }

      if (!response.ok || !('totals' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Failed to load market overview.')
      }

      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load market overview.')
    } finally {
      setLoadingData(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return (
      <BackofficeFrame
        active="market"
        user={null}
        title={pickLanguage(language, '运营后台', 'Market Console')}
        subtitle={pickLanguage(language, '请先登录后访问 /market。', 'Sign in first to access /market.')}
      >
        <div className="card text-sm text-slate-600">
          {pickLanguage(language, '当前未登录。请先返回首页完成登录。', 'You are not signed in. Return to the homepage and log in first.')}
        </div>
      </BackofficeFrame>
    )
  }

  if (user.role !== 'admin' && user.role !== 'market') {
    return (
      <BackofficeFrame
        active="market"
        user={user}
        title={pickLanguage(language, '运营后台', 'Market Console')}
        subtitle={pickLanguage(language, '当前账号没有访问权限。', 'This account does not have access.')}
      >
        <div className="card text-sm text-slate-600">
          {pickLanguage(language, '只有管理员可以访问这个后台。', 'Only administrators can open this console.')}
        </div>
      </BackofficeFrame>
    )
  }

  return (
    <BackofficeFrame
      active="market"
      user={user}
      title={pickLanguage(language, '运营后台', 'Market Console')}
      subtitle={pickLanguage(
        language,
        '查看用户、岗位、投递、支付和 AI 使用的整体运营情况。',
        'Review users, jobs, applications, payments, and AI usage from one operations dashboard.'
      )}
    >
      {loadingData || !data ? (
        <div className="card text-sm text-slate-500">
          {pickLanguage(language, '正在加载运营数据...', 'Loading market data...')}
        </div>
      ) : (
        <div className="space-y-6">
          {error && <div className="card border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div>}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card">
              <p className="text-sm text-slate-500">{pickLanguage(language, '注册用户', 'Registered Users')}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{data.totals.users}</p>
              <p className="mt-2 text-sm text-slate-500">
                {pickLanguage(language, '招聘方', 'Recruiters')} {data.totals.recruiters} · {pickLanguage(language, '求职者', 'Candidates')} {data.totals.candidates}
              </p>
            </div>

            <div className="card">
              <p className="text-sm text-slate-500">{pickLanguage(language, '岗位与投递', 'Jobs & Applications')}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{data.totals.jobs}</p>
              <p className="mt-2 text-sm text-slate-500">
                {pickLanguage(language, '投递数', 'Applications')} {data.totals.applications}
              </p>
            </div>

            <div className="card">
              <p className="text-sm text-slate-500">{pickLanguage(language, '收入', 'Revenue')}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">
                {currencyFormatter.format(data.totals.checkoutRevenueRmb)}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {pickLanguage(language, '已支付订单', 'Paid Orders')} {data.totals.paidOrders}
              </p>
            </div>

            <div className="card">
              <p className="text-sm text-slate-500">{pickLanguage(language, 'AI 使用', 'AI Usage')}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{data.totals.aiUsageCount}</p>
              <p className="mt-2 text-sm text-slate-500">
                {pickLanguage(language, '估算支出', 'Estimated Spend')} {currencyFormatter.format(data.totals.aiEstimatedSpendRmb)}
              </p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-950">
                {pickLanguage(language, '运营总览', 'Operations Snapshot')}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="text-slate-500">{pickLanguage(language, '已发布岗位', 'Published Jobs')}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{data.totals.publishedJobs}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="text-slate-500">{pickLanguage(language, '简历数', 'Resumes')}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{data.totals.resumes}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="text-slate-500">{pickLanguage(language, '测评数', 'Assessments')}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{data.totals.assessments}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="text-slate-500">{pickLanguage(language, '组织线索', 'Organization Leads')}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{data.totals.organizationLeads}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-slate-950">
                {pickLanguage(language, '投递阶段分布', 'Application Stage Mix')}
              </h2>
              <div className="mt-4 space-y-3">
                {data.applicationStages.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    {pickLanguage(language, '还没有投递数据。', 'No application data yet.')}
                  </div>
                ) : (
                  data.applicationStages.map((item) => (
                    <div
                      key={item.stage}
                      className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      <span>{stageLabel(item.stage, language)}</span>
                      <span className="font-semibold text-slate-950">{item.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-950">
                {pickLanguage(language, 'AI 功能分布', 'AI Feature Mix')}
              </h2>
              <div className="mt-4 space-y-3">
                {data.aiFeatures.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    {pickLanguage(language, '还没有 AI 使用数据。', 'No AI usage data yet.')}
                  </div>
                ) : (
                  data.aiFeatures.map((item) => (
                    <div
                      key={item.feature}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium text-slate-950">{featureLabel(item.feature, language)}</span>
                        <span>{item.count}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {pickLanguage(language, '估算支出', 'Estimated Spend')} {currencyFormatter.format(item.estimatedSpendRmb)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-slate-950">
                {pickLanguage(language, '最近支付记录', 'Recent Payments')}
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-3 pr-4 font-medium">{pickLanguage(language, '用户', 'User')}</th>
                      <th className="pb-3 pr-4 font-medium">{pickLanguage(language, '方案', 'Plan')}</th>
                      <th className="pb-3 pr-4 font-medium">{pickLanguage(language, '金额', 'Amount')}</th>
                      <th className="pb-3 pr-0 font-medium">{pickLanguage(language, '时间', 'Paid At')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentRevenue.length === 0 ? (
                      <tr>
                        <td className="py-4 text-slate-500" colSpan={4}>
                          {pickLanguage(language, '还没有支付记录。', 'No payment records yet.')}
                        </td>
                      </tr>
                    ) : (
                      data.recentRevenue.map((item) => (
                        <tr key={item.id}>
                          <td className="py-4 pr-4 text-slate-700">{item.userName}</td>
                          <td className="py-4 pr-4 text-slate-700">{item.planName}</td>
                          <td className="py-4 pr-4 text-slate-700">{currencyFormatter.format(item.amount)}</td>
                          <td className="py-4 pr-0 text-slate-500">
                            {item.paidAt ? new Date(item.paidAt).toLocaleString(language === 'en' ? 'en-US' : 'zh-CN') : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}
    </BackofficeFrame>
  )
}
