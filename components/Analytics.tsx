'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  Calendar,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { getStoredAuthToken } from './AuthProvider'
import type { ApplicationRecord, ApplicationStage } from '@/types/application'
import type { AssessmentRecord } from '@/types/assessment'

type TimeRange = '1m' | '3m' | '6m' | '1y'

type ActivityItem =
  | { id: string; kind: 'application'; at: string; payload: ApplicationRecord }
  | { id: string; kind: 'assessment'; at: string; payload: AssessmentRecord }

const TIME_RANGE_MONTHS: Record<TimeRange, number> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
  '1y': 12,
}

function authHeaders() {
  const token = getStoredAuthToken()
  if (!token) {
    throw new Error('请先重新登录。')
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function shortMonth(date: Date) {
  return date.toLocaleDateString('zh-CN', { month: 'short' })
}

function assessmentTimestamp(record: AssessmentRecord) {
  return record.summary.completedAt ?? record.updatedAt
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))

  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours} 小时前`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`

  const months = Math.floor(days / 30)
  return `${months} 个月前`
}

function stageLabel(stage: ApplicationStage) {
  switch (stage) {
    case 'applied':
      return '已投递'
    case 'screening':
      return '初筛中'
    case 'interview':
      return '面试中'
    case 'offer':
      return 'Offer 阶段'
    case 'hired':
      return '已录用'
    case 'rejected':
      return '未通过'
    case 'withdrawn':
      return '已撤回'
    default:
      return stage
  }
}

function recommendationLabel(value: AssessmentRecord['summary']['recommendation']) {
  switch (value) {
    case 'strong_yes':
      return '强烈推荐'
    case 'yes':
      return '推荐'
    case 'hold':
      return '待复核'
    case 'no':
      return '不推荐'
    default:
      return '待评估'
  }
}

function activityLabel(item: ActivityItem) {
  if (item.kind === 'assessment') {
    const record = item.payload
    const sourceLabel = record.kind === 'practice' ? '岗位自测' : '招聘方发题'
    const actionLabel = record.status === 'scored' ? '已完成评分' : '已生成题目'
    return `${sourceLabel}：${record.jobTitle || record.title} ${actionLabel}`
  }

  const record = item.payload
  return `${record.company} · ${record.jobTitle} 当前状态：${stageLabel(record.stage)}`
}

function averageScore(records: AssessmentRecord[]) {
  const scored = records.filter((item) => item.summary.overallScore !== null)
  if (scored.length === 0) {
    return 0
  }

  return Math.round(
    scored.reduce((sum, item) => sum + (item.summary.overallScore ?? 0), 0) / scored.length
  )
}

function isInterviewProgress(stage: ApplicationStage) {
  return stage === 'interview' || stage === 'offer' || stage === 'hired'
}

export function Analytics() {
  const [timeRange, setTimeRange] = useState<TimeRange>('6m')
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadAnalyticsData() {
      try {
        setLoading(true)
        setError('')

        const [applicationResponse, assessmentResponse] = await Promise.all([
          fetch('/api/applications?scope=me', {
            cache: 'no-store',
            headers: authHeaders(),
          }),
          fetch('/api/assessments', {
            cache: 'no-store',
            headers: authHeaders(),
          }),
        ])

        const applicationData = (await applicationResponse.json()) as ApplicationRecord[] | { error?: string }
        const assessmentData = (await assessmentResponse.json()) as AssessmentRecord[] | { error?: string }

        if (!applicationResponse.ok || !Array.isArray(applicationData)) {
          throw new Error(
            !Array.isArray(applicationData) && applicationData.error ? applicationData.error : '投递分析加载失败。'
          )
        }

        if (!assessmentResponse.ok || !Array.isArray(assessmentData)) {
          throw new Error(
            !Array.isArray(assessmentData) && assessmentData.error ? assessmentData.error : '测评分数加载失败。'
          )
        }

        setApplications(applicationData)
        setAssessments(assessmentData)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '分析数据加载失败。')
      } finally {
        setLoading(false)
      }
    }

    void loadAnalyticsData()
  }, [])

  const analytics = useMemo(() => {
    const monthCount = TIME_RANGE_MONTHS[timeRange]
    const currentPeriodStart = addMonths(startOfMonth(new Date()), -(monthCount - 1))

    const inCurrentApplications = applications.filter(
      (item) => new Date(item.createdAt).getTime() >= currentPeriodStart.getTime()
    )
    const inCurrentAssessments = assessments.filter(
      (item) => new Date(assessmentTimestamp(item)).getTime() >= currentPeriodStart.getTime()
    )

    const practiceAssessments = inCurrentAssessments.filter((item) => item.kind === 'practice')
    const recruiterAssessments = inCurrentAssessments.filter((item) => item.kind === 'recruiter_assigned')
    const scoredPractice = practiceAssessments.filter((item) => item.summary.overallScore !== null)
    const scoredRecruiter = recruiterAssessments.filter((item) => item.summary.overallScore !== null)

    const comparisonMap = new Map<
      string,
      {
        jobTitle: string
        company: string
        practiceScore: number | null
        recruiterScore: number | null
      }
    >()

    for (const record of scoredPractice) {
      const key = record.jobId ?? record.jobTitle ?? record.id
      if (!comparisonMap.has(key)) {
        comparisonMap.set(key, {
          jobTitle: record.jobTitle || record.title,
          company: record.company || '目标公司',
          practiceScore: record.summary.overallScore,
          recruiterScore: null,
        })
      }
    }

    for (const record of scoredRecruiter) {
      const key = record.jobId ?? record.jobTitle ?? record.id
      const current = comparisonMap.get(key)
      if (current) {
        comparisonMap.set(key, {
          ...current,
          recruiterScore: record.summary.overallScore,
        })
      }
    }

    const linkedComparisons = Array.from(comparisonMap.values())
      .filter((item) => item.practiceScore !== null && item.recruiterScore !== null)
      .map((item) => ({
        ...item,
        delta: (item.recruiterScore ?? 0) - (item.practiceScore ?? 0),
      }))
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))

    const trendBuckets = Array.from({ length: monthCount }, (_, index) => {
      const monthDate = addMonths(currentPeriodStart, index)
      const bucketStart = monthDate.getTime()
      const bucketEnd = addMonths(monthDate, 1).getTime()

      const monthApplications = applications.filter((item) => {
        const createdAt = new Date(item.createdAt).getTime()
        return createdAt >= bucketStart && createdAt < bucketEnd
      })
      const monthPractice = assessments.filter((item) => {
        const createdAt = new Date(assessmentTimestamp(item)).getTime()
        return createdAt >= bucketStart && createdAt < bucketEnd && item.kind === 'practice'
      })
      const monthRecruiter = assessments.filter((item) => {
        const createdAt = new Date(assessmentTimestamp(item)).getTime()
        return createdAt >= bucketStart && createdAt < bucketEnd && item.kind === 'recruiter_assigned'
      })

      return {
        month: shortMonth(monthDate),
        applications: monthApplications.length,
        interviews: monthApplications.filter((item) => isInterviewProgress(item.stage)).length,
        practiceAvg: averageScore(monthPractice),
        recruiterAvg: averageScore(monthRecruiter),
      }
    })

    const pipelineBreakdown = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'].map((stage) => ({
      stage: stageLabel(stage as ApplicationStage),
      count: inCurrentApplications.filter((item) => item.stage === stage).length,
    }))

    const recentActivity: ActivityItem[] = [
      ...applications.map((item) => ({
        id: `application-${item.id}`,
        kind: 'application' as const,
        at: item.updatedAt,
        payload: item,
      })),
      ...assessments.map((item) => ({
        id: `assessment-${item.id}`,
        kind: 'assessment' as const,
        at: assessmentTimestamp(item),
        payload: item,
      })),
    ]
      .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
      .slice(0, 8)

    return {
      totalApplications: inCurrentApplications.length,
      interviewProgress: inCurrentApplications.filter((item) => isInterviewProgress(item.stage)).length,
      practiceAverage: averageScore(scoredPractice),
      recruiterAverage: averageScore(scoredRecruiter),
      linkedComparisons,
      practiceCount: practiceAssessments.length,
      recruiterCount: recruiterAssessments.length,
      trendBuckets,
      pipelineBreakdown,
      recentActivity,
    }
  }, [applications, assessments, timeRange])

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">正在加载分析数据...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#eef8ff)] p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700">
            <BarChart3 className="h-4 w-4" />
            <span>求职分析</span>
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">把投递、自测和招聘方正式题目的结果放在一起看。</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            这里重点看两个问题：你做的岗位自测分数如何，和招聘方真正发来的题目相比有没有差距。
          </p>
        </div>
        <select value={timeRange} onChange={(event) => setTimeRange(event.target.value as TimeRange)} className="input-field w-full lg:w-52">
          <option value="1m">最近 1 个月</option>
          <option value="3m">最近 3 个月</option>
          <option value="6m">最近 6 个月</option>
          <option value="1y">最近 1 年</option>
        </select>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">投递岗位</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{analytics.totalApplications}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">进入面试相关阶段</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{analytics.interviewProgress}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-100 p-3 text-violet-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">岗位自测平均分</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{analytics.practiceAverage}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">招聘方正式题平均分</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{analytics.recruiterAverage}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">分数趋势对比</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.trendBuckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="practiceAvg" stroke="#8b5cf6" strokeWidth={2} name="岗位自测平均分" />
                <Line type="monotone" dataKey="recruiterAvg" stroke="#0ea5e9" strokeWidth={2} name="招聘方题目平均分" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">投递与推进趋势</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.trendBuckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="applications" fill="#3b82f6" radius={[6, 6, 0, 0]} name="投递数" />
                <Bar dataKey="interviews" fill="#10b981" radius={[6, 6, 0, 0]} name="进入面试相关阶段" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">同岗位：自测 vs 招聘方题目</h3>
          <div className="space-y-3">
            {analytics.linkedComparisons.length === 0 && (
              <p className="text-sm text-slate-500">
                还没有可直接对照的岗位。先做一次岗位自测，或者先收到招聘方发来的正式题目。
              </p>
            )}
            {analytics.linkedComparisons.map((item) => (
              <div key={`${item.company}-${item.jobTitle}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{item.jobTitle}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.company}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.delta >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.delta >= 0 ? `+${item.delta}` : item.delta}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">岗位自测</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{item.practiceScore}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">招聘方题目</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{item.recruiterScore}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">投递流程分布</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.pipelineBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} name="数量" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-slate-900">最近动态</h3>
        </div>
        <div className="space-y-3">
          {analytics.recentActivity.length === 0 && (
            <p className="text-sm text-slate-500">最近还没有新的投递或测评动态。</p>
          )}
          {analytics.recentActivity.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <div className={`mt-2 h-2.5 w-2.5 rounded-full ${item.kind === 'assessment' ? 'bg-violet-500' : 'bg-blue-500'}`}></div>
              <div className="flex-1">
                <p className="text-sm text-slate-900">{activityLabel(item)}</p>
                <p className="mt-1 text-xs text-slate-500">{relativeTime(item.at)}</p>
              </div>
              {item.kind === 'assessment' && item.payload.summary.overallScore !== null && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  {item.payload.summary.overallScore} 分 · {recommendationLabel(item.payload.summary.recommendation)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
