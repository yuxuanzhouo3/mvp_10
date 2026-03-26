'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  Calendar,
  FileText,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { getStoredAuthToken, useAuth } from './AuthProvider'
import type { ApplicationRecord, ApplicationStage } from '@/types/application'
import type { AssessmentRecord, AssessmentRecommendation } from '@/types/assessment'
import type { ResumeListItem } from '@/types/resume'

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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function shortMonth(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short' })
}

function isInterviewStage(stage: ApplicationStage) {
  return stage === 'interview' || stage === 'offer' || stage === 'hired'
}

function isOfferStage(stage: ApplicationStage) {
  return stage === 'offer' || stage === 'hired'
}

function isPositiveRecommendation(value: AssessmentRecommendation | null) {
  return value === 'strong_yes' || value === 'yes'
}

function changeLabel(current: number, previous: number, suffix = '%') {
  if (previous === 0) {
    if (current === 0) return 'No change'
    return 'New this period'
  }

  const delta = ((current - previous) / previous) * 100
  const rounded = Math.round(Math.abs(delta))

  if (rounded === 0) {
    return 'Flat vs previous period'
  }

  return `${delta >= 0 ? '+' : '-'}${rounded}${suffix === '%' ? '%' : ''} vs previous period`
}

function changeTone(current: number, previous: number) {
  if (current === previous) return 'text-gray-600'
  return current >= previous ? 'text-green-600' : 'text-rose-600'
}

function stageLabel(stage: ApplicationStage) {
  switch (stage) {
    case 'applied':
      return 'Applied'
    case 'screening':
      return 'Screening'
    case 'interview':
      return 'Interview'
    case 'offer':
      return 'Offer'
    case 'hired':
      return 'Hired'
    case 'rejected':
      return 'Rejected'
    case 'withdrawn':
      return 'Withdrawn'
    default:
      return stage
  }
}

function recommendationLabel(value: AssessmentRecommendation | null) {
  switch (value) {
    case 'strong_yes':
      return 'Strong Yes'
    case 'yes':
      return 'Yes'
    case 'hold':
      return 'Hold'
    case 'no':
      return 'No'
    default:
      return 'Pending'
  }
}

function activityLabel(item: ActivityItem) {
  if (item.kind === 'assessment') {
    const record = item.payload
    const modeLabel = record.mode === 'written' ? 'written assessment' : 'interview assessment'

    if (record.status === 'scored') {
      return `${modeLabel} scored for ${record.jobTitle || 'general role'}`
    }

    return `${modeLabel} created for ${record.jobTitle || 'general role'}`
  }

  const record = item.payload
  switch (record.stage) {
    case 'interview':
      return `Interview in progress with ${record.company}`
    case 'offer':
      return `Offer stage reached at ${record.company}`
    case 'hired':
      return `Hired by ${record.company}`
    case 'rejected':
      return `Application closed by ${record.company}`
    case 'withdrawn':
      return `Application withdrawn from ${record.company}`
    case 'screening':
      return `Screening underway for ${record.company}`
    default:
      return `Applied to ${record.jobTitle} at ${record.company}`
  }
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))

  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`

  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

function assessmentTimestamp(record: AssessmentRecord) {
  return record.summary.completedAt ?? record.updatedAt
}

export function Analytics() {
  const { user } = useAuth()
  const [timeRange, setTimeRange] = useState<TimeRange>('6m')
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadAnalyticsData() {
      const token = getStoredAuthToken()
      if (!token || !user) {
        setError('Please sign in again to load analytics.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const [applicationResponse, resumeResponse, assessmentResponse] = await Promise.all([
          fetch('/api/applications?scope=me', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }),
          fetch('/api/resumes', {
            cache: 'no-store',
          }),
          fetch('/api/assessments', {
            cache: 'no-store',
          }),
        ])

        const applicationData = (await applicationResponse.json()) as ApplicationRecord[] | { error?: string }
        const resumeData = (await resumeResponse.json()) as ResumeListItem[] | { error?: string }
        const assessmentData = (await assessmentResponse.json()) as AssessmentRecord[] | { error?: string }

        if (!applicationResponse.ok || !Array.isArray(applicationData)) {
          throw new Error(
            !Array.isArray(applicationData) && applicationData.error ? applicationData.error : 'Failed to load application analytics.'
          )
        }

        if (!resumeResponse.ok || !Array.isArray(resumeData)) {
          throw new Error(
            !Array.isArray(resumeData) && resumeData.error ? resumeData.error : 'Failed to load resume analytics.'
          )
        }

        if (!assessmentResponse.ok || !Array.isArray(assessmentData)) {
          throw new Error(
            !Array.isArray(assessmentData) && assessmentData.error ? assessmentData.error : 'Failed to load assessment analytics.'
          )
        }

        const relatedResumeIds = new Set(
          resumeData
            .filter((resume) => {
              const sameEmail = Boolean(resume.contact.email && resume.contact.email === user.email)
              const sameName = Boolean(resume.contact.name && resume.contact.name === user.name)
              return sameEmail || sameName
            })
            .map((resume) => resume.id)
        )

        const scopedAssessments = assessmentData.filter((record) => {
          if (record.resumeId && relatedResumeIds.has(record.resumeId)) {
            return true
          }

          if (record.candidateEmail && record.candidateEmail === user.email) {
            return true
          }

          if (record.candidateName && record.candidateName === user.name) {
            return true
          }

          return false
        })

        setApplications(applicationData)
        setAssessments(scopedAssessments)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load analytics data.')
      } finally {
        setLoading(false)
      }
    }

    void loadAnalyticsData()
  }, [user])

  const analytics = useMemo(() => {
    const monthCount = TIME_RANGE_MONTHS[timeRange]
    const currentPeriodStart = addMonths(startOfMonth(new Date()), -(monthCount - 1))
    const previousPeriodStart = addMonths(currentPeriodStart, -monthCount)

    const inCurrentApplications = applications.filter(
      (item) => new Date(item.createdAt).getTime() >= currentPeriodStart.getTime()
    )
    const inPreviousApplications = applications.filter((item) => {
      const createdAt = new Date(item.createdAt).getTime()
      return createdAt >= previousPeriodStart.getTime() && createdAt < currentPeriodStart.getTime()
    })

    const inCurrentAssessments = assessments.filter(
      (item) => new Date(assessmentTimestamp(item)).getTime() >= currentPeriodStart.getTime()
    )
    const inPreviousAssessments = assessments.filter((item) => {
      const createdAt = new Date(assessmentTimestamp(item)).getTime()
      return createdAt >= previousPeriodStart.getTime() && createdAt < currentPeriodStart.getTime()
    })

    const totalApplications = inCurrentApplications.length
    const interviews = inCurrentApplications.filter((item) => isInterviewStage(item.stage)).length
    const offers = inCurrentApplications.filter((item) => isOfferStage(item.stage)).length
    const successRate = totalApplications === 0 ? 0 : Math.round((offers / totalApplications) * 1000) / 10

    const scoredCurrentAssessments = inCurrentAssessments.filter((item) => item.summary.overallScore !== null)
    const scoredPreviousAssessments = inPreviousAssessments.filter((item) => item.summary.overallScore !== null)
    const assessmentAverage =
      scoredCurrentAssessments.length === 0
        ? 0
        : Math.round(
            scoredCurrentAssessments.reduce((sum, item) => sum + (item.summary.overallScore ?? 0), 0) /
              scoredCurrentAssessments.length
          )
    const assessmentAveragePrev =
      scoredPreviousAssessments.length === 0
        ? 0
        : Math.round(
            scoredPreviousAssessments.reduce((sum, item) => sum + (item.summary.overallScore ?? 0), 0) /
              scoredPreviousAssessments.length
          )

    const passRate =
      scoredCurrentAssessments.length === 0
        ? 0
        : Math.round(
            (scoredCurrentAssessments.filter((item) => isPositiveRecommendation(item.summary.recommendation)).length /
              scoredCurrentAssessments.length) *
              1000
          ) / 10
    const passRatePrev =
      scoredPreviousAssessments.length === 0
        ? 0
        : Math.round(
            (scoredPreviousAssessments.filter((item) => isPositiveRecommendation(item.summary.recommendation)).length /
              scoredPreviousAssessments.length) *
              1000
          ) / 10

    const trendBuckets = Array.from({ length: monthCount }, (_, index) => {
      const monthDate = addMonths(currentPeriodStart, index)
      const bucketStart = monthDate.getTime()
      const bucketEnd = addMonths(monthDate, 1).getTime()
      const monthApplications = applications.filter((item) => {
        const createdAt = new Date(item.createdAt).getTime()
        return createdAt >= bucketStart && createdAt < bucketEnd
      })
      const monthAssessments = assessments.filter((item) => {
        const createdAt = new Date(assessmentTimestamp(item)).getTime()
        return createdAt >= bucketStart && createdAt < bucketEnd
      })
      const scoredMonthAssessments = monthAssessments.filter((item) => item.summary.overallScore !== null)

      return {
        month: shortMonth(monthDate),
        applications: monthApplications.length,
        interviews: monthApplications.filter((item) => isInterviewStage(item.stage)).length,
        offers: monthApplications.filter((item) => isOfferStage(item.stage)).length,
        assessments: monthAssessments.length,
        assessmentAverage:
          scoredMonthAssessments.length === 0
            ? 0
            : Math.round(
                scoredMonthAssessments.reduce((sum, item) => sum + (item.summary.overallScore ?? 0), 0) /
                  scoredMonthAssessments.length
              ),
      }
    })

    const stageOrder: ApplicationStage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn']
    const stageBreakdown = stageOrder.map((stage) => ({
      stage: stageLabel(stage),
      count: inCurrentApplications.filter((item) => item.stage === stage).length,
    }))

    const recommendationOrder: AssessmentRecommendation[] = ['strong_yes', 'yes', 'hold', 'no']
    const recommendationBreakdown = recommendationOrder.map((recommendation) => ({
      recommendation: recommendationLabel(recommendation),
      count: inCurrentAssessments.filter((item) => item.summary.recommendation === recommendation).length,
    }))

    const companyStats = Array.from(
      inCurrentApplications.reduce((map, item) => {
        const current = map.get(item.company) ?? { company: item.company, applications: 0, interviews: 0, offers: 0 }
        current.applications += 1
        if (isInterviewStage(item.stage)) current.interviews += 1
        if (isOfferStage(item.stage)) current.offers += 1
        map.set(item.company, current)
        return map
      }, new Map<string, { company: string; applications: number; interviews: number; offers: number }>())
        .values()
    ).sort((left, right) => right.applications - left.applications)

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
      .slice(0, 6)

    return {
      totalApplications,
      interviews,
      offers,
      successRate,
      totalApplicationsPrev: inPreviousApplications.length,
      interviewsPrev: inPreviousApplications.filter((item) => isInterviewStage(item.stage)).length,
      offersPrev: inPreviousApplications.filter((item) => isOfferStage(item.stage)).length,
      successRatePrev:
        inPreviousApplications.length === 0
          ? 0
          : Math.round(
              (inPreviousApplications.filter((item) => isOfferStage(item.stage)).length / inPreviousApplications.length) * 1000
            ) / 10,
      totalAssessments: inCurrentAssessments.length,
      totalAssessmentsPrev: inPreviousAssessments.length,
      assessmentAverage,
      assessmentAveragePrev,
      passRate,
      passRatePrev,
      trendBuckets,
      stageBreakdown,
      recommendationBreakdown,
      companyStats,
      recentActivity,
    }
  }, [applications, assessments, timeRange])

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Loading analytics...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Track live application progress together with written-test and interview assessment results.
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="input-field"
          >
            <option value="1m">Last Month</option>
            <option value="3m">Last 3 Months</option>
            <option value="6m">Last 6 Months</option>
            <option value="1y">Last Year</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="card">
          <div className="flex items-center">
            <div className="rounded-lg bg-blue-100 p-2">
              <Briefcase className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Applications</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalApplications}</p>
            </div>
          </div>
          <div className={`mt-4 text-sm ${changeTone(analytics.totalApplications, analytics.totalApplicationsPrev)}`}>
            {changeLabel(analytics.totalApplications, analytics.totalApplicationsPrev, '')}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="rounded-lg bg-green-100 p-2">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Interviews</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.interviews}</p>
            </div>
          </div>
          <div className={`mt-4 text-sm ${changeTone(analytics.interviews, analytics.interviewsPrev)}`}>
            {changeLabel(analytics.interviews, analytics.interviewsPrev, '')}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="rounded-lg bg-yellow-100 p-2">
              <Target className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Offers</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.offers}</p>
            </div>
          </div>
          <div className={`mt-4 text-sm ${changeTone(analytics.offers, analytics.offersPrev)}`}>
            {changeLabel(analytics.offers, analytics.offersPrev, '')}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="rounded-lg bg-slate-100 p-2">
              <BarChart3 className="h-6 w-6 text-slate-700" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.successRate}%</p>
            </div>
          </div>
          <div className={`mt-4 text-sm ${changeTone(analytics.successRate, analytics.successRatePrev)}`}>
            {changeLabel(analytics.successRate, analytics.successRatePrev)}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="rounded-lg bg-violet-100 p-2">
              <FileText className="h-6 w-6 text-violet-700" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Assessment Avg</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.assessmentAverage}%</p>
            </div>
          </div>
          <div className={`mt-4 text-sm ${changeTone(analytics.assessmentAverage, analytics.assessmentAveragePrev)}`}>
            {changeLabel(analytics.assessmentAverage, analytics.assessmentAveragePrev)}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="rounded-lg bg-fuchsia-100 p-2">
              <Sparkles className="h-6 w-6 text-fuchsia-700" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Assessment Pass</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.passRate}%</p>
            </div>
          </div>
          <div className={`mt-4 text-sm ${changeTone(analytics.passRate, analytics.passRatePrev)}`}>
            {changeLabel(analytics.passRate, analytics.passRatePrev)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Application Trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.trendBuckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="applications" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="interviews" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="offers" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Assessment Trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.trendBuckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="assessments" stroke="#8b5cf6" strokeWidth={2} />
                <Line type="monotone" dataKey="assessmentAverage" stroke="#ec4899" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Pipeline Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.stageBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">AI Decision Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.recommendationBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="recommendation" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Top Companies Applied</h3>
          <div className="space-y-3">
            {analytics.companyStats.length === 0 && (
              <p className="text-sm text-gray-500">No company activity in this range yet.</p>
            )}
            {analytics.companyStats.slice(0, 5).map((company) => (
              <div key={company.company} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div>
                  <p className="font-medium text-gray-900">{company.company}</p>
                  <p className="text-sm text-gray-500">{company.applications} applications</p>
                </div>
                <span className="text-sm font-medium text-green-600">
                  {company.interviews} interviews / {company.offers} offers
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Current Pipeline</h3>
          <div className="space-y-4">
            {analytics.stageBreakdown.map((item) => {
              const total = Math.max(analytics.totalApplications, 1)
              const width = (item.count / total) * 100
              return (
                <div key={item.stage}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-gray-600">{item.stage}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${width}%` }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="space-y-3">
            {analytics.recentActivity.length === 0 && (
              <p className="text-sm text-gray-500">Recent activity will appear after you apply to roles or finish an assessment.</p>
            )}
            {analytics.recentActivity.map((item) => (
              <div key={item.id} className="flex items-start space-x-3">
                <div className={`mt-1 h-2 w-2 rounded-full ${item.kind === 'assessment' ? 'bg-violet-500' : 'bg-blue-500'}`}></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{activityLabel(item)}</p>
                  <p className="text-xs text-gray-500">{relativeTime(item.at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
