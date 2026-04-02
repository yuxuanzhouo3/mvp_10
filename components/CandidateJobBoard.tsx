'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Briefcase, ChevronDown, Loader2, MapPin, Sparkles } from 'lucide-react'

import { getStoredAuthToken } from './AuthProvider'
import { TechnicalTag } from './TechnicalText'
import type { ApplicationRecord, ApplicationStage } from '@/types/application'
import type { JobRecommendationResponse, JobRecord } from '@/types/job'

type SortMode = 'match' | 'latest' | 'salary'

const ACTIVE_STAGES: ApplicationStage[] = ['applied', 'screening', 'interview', 'offer', 'hired']

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

function stageTone(stage: ApplicationStage) {
  switch (stage) {
    case 'screening':
      return 'bg-sky-100 text-sky-700'
    case 'interview':
      return 'bg-violet-100 text-violet-700'
    case 'offer':
      return 'bg-amber-100 text-amber-700'
    case 'hired':
      return 'bg-emerald-100 text-emerald-700'
    case 'rejected':
      return 'bg-rose-100 text-rose-700'
    case 'withdrawn':
      return 'bg-slate-100 text-slate-700'
    default:
      return 'bg-blue-100 text-blue-700'
  }
}

function scoreTone(score: number) {
  if (score >= 88) return 'bg-emerald-100 text-emerald-700'
  if (score >= 76) return 'bg-blue-100 text-blue-700'
  if (score >= 66) return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-700'
}

function locationModeLabel(mode: JobRecord['locationMode']) {
  switch (mode) {
    case 'remote':
      return '远程'
    case 'hybrid':
      return '混合'
    case 'onsite':
    default:
      return '现场'
  }
}

function salaryLabel(job: JobRecord) {
  const formatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: job.currency,
    maximumFractionDigits: 0,
  })

  return `${formatter.format(job.salaryMin)} - ${formatter.format(job.salaryMax)}`
}

function postedLabel(postedAt: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(postedAt).getTime()) / (1000 * 60 * 60 * 24)))
  return days === 0 ? '今天发布' : `${days} 天前发布`
}

function isActiveApplication(stage: ApplicationStage) {
  return ACTIVE_STAGES.includes(stage)
}

function upsertApplication(records: ApplicationRecord[], next: ApplicationRecord) {
  const index = records.findIndex((item) => item.id === next.id)
  if (index === -1) {
    return [next, ...records]
  }

  const updated = [...records]
  updated[index] = next
  return updated.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

function getAuthorizedHeaders(includeJson = false) {
  const token = getStoredAuthToken()

  if (!token) {
    throw new Error('请先重新登录。')
  }

  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  }
}

export function CandidateJobBoard() {
  const [data, setData] = useState<JobRecommendationResponse | null>(null)
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [actingJobId, setActingJobId] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [locationFilter, setLocationFilter] = useState('全部地点')
  const [minSalaryFilter, setMinSalaryFilter] = useState('')
  const [maxSalaryFilter, setMaxSalaryFilter] = useState('')
  const [minMatch, setMinMatch] = useState('0')
  const [sortMode, setSortMode] = useState<SortMode>('match')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError('')

      const [recommendationResponse, applicationResponse] = await Promise.all([
        fetch('/api/jobs/recommendations', {
          cache: 'no-store',
          headers: getAuthorizedHeaders(),
        }),
        fetch('/api/applications?scope=me', {
          cache: 'no-store',
          headers: getAuthorizedHeaders(),
        }),
      ])

      const recommendationPayload = (await recommendationResponse.json()) as JobRecommendationResponse | { error?: string }
      const applicationPayload = (await applicationResponse.json()) as ApplicationRecord[] | { error?: string }

      if (!recommendationResponse.ok || !('recommendations' in recommendationPayload)) {
        throw new Error(
          'error' in recommendationPayload && recommendationPayload.error
            ? recommendationPayload.error
            : '岗位推荐加载失败。'
        )
      }

      if (!applicationResponse.ok || !Array.isArray(applicationPayload)) {
        throw new Error(
          !Array.isArray(applicationPayload) && applicationPayload.error
            ? applicationPayload.error
            : '投递记录加载失败。'
        )
      }

      setData(recommendationPayload)
      setApplications(applicationPayload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '岗位推荐加载失败。')
    } finally {
      setLoading(false)
    }
  }

  const applicationByJobId = useMemo(() => {
    const map = new Map<string, ApplicationRecord>()
    const sorted = [...applications].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    )

    sorted.forEach((application) => {
      if (!map.has(application.jobId)) {
        map.set(application.jobId, application)
      }
    })

    return map
  }, [applications])

  const locationOptions = useMemo(() => {
    const options = Array.from(new Set((data?.recommendations ?? []).map((item) => item.job.location))).sort()
    return ['全部地点', ...options]
  }, [data?.recommendations])

  const filteredRecommendations = useMemo(() => {
    const source = data?.recommendations ?? []
    const search = keyword.trim().toLowerCase()
    const min = Number(minMatch || '0')
    const minSalary = minSalaryFilter.trim() ? Number(minSalaryFilter) : null
    const maxSalary = maxSalaryFilter.trim() ? Number(maxSalaryFilter) : null

    return source
      .filter((item) => {
        const haystack = [
          item.job.title,
          item.job.company,
          item.job.location,
          item.job.description,
          ...item.job.requiredSkills,
          ...item.reasons,
        ]
          .join(' ')
          .toLowerCase()

        const matchSearch = !search || haystack.includes(search)
        const matchLocation = locationFilter === '全部地点' || item.job.location === locationFilter
        const matchSalaryMin = minSalary === null || item.job.salaryMax >= minSalary
        const matchSalaryMax = maxSalary === null || item.job.salaryMin <= maxSalary

        return item.matchScore >= min && matchSearch && matchLocation && matchSalaryMin && matchSalaryMax
      })
      .sort((left, right) => {
        if (sortMode === 'latest') {
          return new Date(right.job.postedAt).getTime() - new Date(left.job.postedAt).getTime()
        }

        if (sortMode === 'salary') {
          return right.job.salaryMax - left.job.salaryMax
        }

        return right.matchScore - left.matchScore
      })
  }, [data, keyword, locationFilter, maxSalaryFilter, minMatch, minSalaryFilter, sortMode])

  const stats = useMemo(() => {
    const activeApplications = applications.filter((item) => isActiveApplication(item.stage)).length

    return {
      totalMatches: filteredRecommendations.length,
      activeApplications,
      topSkillGap: data?.summary.topSkillGap ?? '暂无',
      bestFocus: data?.summary.bestFocus ?? '继续更新简历，系统会给你更准确的推荐。',
    }
  }, [applications, data, filteredRecommendations.length])

  async function applyToJob(jobId: string, matchScore: number) {
    try {
      setActingJobId(jobId)
      setError('')
      setMessage('')

      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: getAuthorizedHeaders(true),
        body: JSON.stringify({ jobId, matchScore }),
      })

      const payload = (await response.json()) as ApplicationRecord | { error?: string }
      if (!response.ok || !('id' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : '投递失败。')
      }

      setApplications((current) => upsertApplication(current, payload))
      setMessage(`已投递 ${payload.jobTitle}。`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '投递失败。')
    } finally {
      setActingJobId(null)
    }
  }

  async function withdrawApplication(application: ApplicationRecord) {
    try {
      setActingJobId(application.jobId)
      setError('')
      setMessage('')

      const response = await fetch(`/api/applications/${application.id}`, {
        method: 'PATCH',
        headers: getAuthorizedHeaders(true),
        body: JSON.stringify({ stage: 'withdrawn' }),
      })

      const payload = (await response.json()) as ApplicationRecord | { error?: string }
      if (!response.ok || !('id' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : '撤回失败。')
      }

      setApplications((current) => upsertApplication(current, payload))
      setMessage(`已撤回 ${payload.jobTitle}。`)
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : '撤回失败。')
    } finally {
      setActingJobId(null)
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">正在加载岗位推荐...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#eef4ff)] p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700">
            <Sparkles className="h-4 w-4" />
            <span>岗位推荐</span>
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">先按地点和薪资范围筛一轮，再挑高匹配岗位投递。</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            重要信息直接展示，匹配解释、缺口技能和投递建议放进展开区，页面会更干净。
          </p>
        </div>
        <button onClick={() => void loadData()} className="btn-secondary">
          刷新岗位
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">当前可选岗位</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.totalMatches}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">进行中的投递</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{stats.activeApplications}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">优先补齐技能</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{stats.topSkillGap}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">当前重点建议</p>
          <p className="mt-2 text-sm font-medium leading-7 text-slate-900">{stats.bestFocus}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" open>
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
          筛选与排序
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </summary>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="input-field xl:col-span-2"
            placeholder="搜索岗位、公司、技能"
          />
          <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="input-field">
            {locationOptions.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
          <input
            value={minSalaryFilter}
            onChange={(event) => setMinSalaryFilter(event.target.value)}
            className="input-field"
            placeholder="最低薪资"
          />
          <input
            value={maxSalaryFilter}
            onChange={(event) => setMaxSalaryFilter(event.target.value)}
            className="input-field"
            placeholder="最高薪资"
          />
          <select value={minMatch} onChange={(event) => setMinMatch(event.target.value)} className="input-field">
            <option value="0">全部匹配度</option>
            <option value="70">70 分以上</option>
            <option value="80">80 分以上</option>
            <option value="90">90 分以上</option>
          </select>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <p className="text-xs leading-6 text-slate-500">
            薪资范围按岗位薪资上下限与筛选条件是否重叠来计算。地点和薪资都可以组合使用。
          </p>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="input-field">
            <option value="match">按匹配度排序</option>
            <option value="latest">按发布时间排序</option>
            <option value="salary">按最高薪资排序</option>
          </select>
        </div>
      </details>

      <div className="space-y-4">
        {filteredRecommendations.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
            当前没有符合条件的岗位，试试放宽地点、薪资或匹配度筛选。
          </div>
        )}

        {filteredRecommendations.map((item) => {
          const application = applicationByJobId.get(item.job.id)
          const active = application ? isActiveApplication(application.stage) : false
          const canApply = !application || application.stage === 'withdrawn' || application.stage === 'rejected'

          return (
            <div key={item.job.id} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-slate-900">{item.job.title}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${scoreTone(item.matchScore)}`}>
                      {item.matchScore} 分匹配
                    </span>
                    {application && (
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${stageTone(application.stage)}`}>
                        {stageLabel(application.stage)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      {item.job.company}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {item.job.location}
                    </span>
                    <span>{locationModeLabel(item.job.locationMode)}</span>
                    <span>{salaryLabel(item.job)}</span>
                    <span>{postedLabel(item.job.postedAt)}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.job.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.job.requiredSkills.slice(0, 6).map((skill) => (
                      <TechnicalTag
                        key={skill}
                        text={skill}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-3">
                  <button
                    onClick={() => {
                      if (application && active && application.stage !== 'hired') {
                        void withdrawApplication(application)
                        return
                      }

                      if (canApply) {
                        void applyToJob(item.job.id, item.matchScore)
                      }
                    }}
                    disabled={actingJobId === item.job.id || application?.stage === 'hired'}
                    className={active ? 'btn-secondary' : 'btn-primary'}
                  >
                    {actingJobId === item.job.id
                      ? '处理中...'
                      : application?.stage === 'hired'
                        ? '已录用'
                        : active
                          ? '撤回投递'
                          : canApply
                            ? '投递岗位'
                            : '已投递'}
                  </button>
                </div>
              </div>

              <details className="mt-4 rounded-2xl bg-slate-50 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
                  展开匹配详情
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </summary>
                <div className="mt-4 space-y-4 text-sm text-slate-600">
                  <div>
                    <p className="font-medium text-slate-900">为什么推荐给你</p>
                    <p className="mt-1">{item.reasons.join('；') || '系统暂未生成更多解释。'}</p>
                  </div>

                  <div>
                    <p className="font-medium text-slate-900">投递建议</p>
                    <p className="mt-1">{item.personalizedAdvice}</p>
                  </div>

                  <div>
                    <p className="font-medium text-slate-900">命中技能</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.matchedSkills.length > 0 ? (
                        item.matchedSkills.map((skill) => (
                          <TechnicalTag
                            key={skill}
                            text={skill}
                            className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700"
                          />
                        ))
                      ) : (
                        <span>暂未命中明显技能。</span>
                      )}
                    </div>
                  </div>

                  {item.missingSkills.length > 0 && (
                    <div>
                      <p className="font-medium text-slate-900">建议补齐技能</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.missingSkills.map((skill) => (
                          <TechnicalTag
                            key={skill}
                            text={skill}
                            className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-slate-500">技能匹配</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{item.breakdown.skills}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-slate-500">经验匹配</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{item.breakdown.experience}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-slate-500">地点匹配</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{item.breakdown.location}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-slate-500">成长空间</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{item.breakdown.growth}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-slate-500">薪资匹配</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{item.breakdown.compensation}</p>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          )
        })}
      </div>
    </div>
  )
}
