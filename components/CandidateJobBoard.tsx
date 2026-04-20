'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Briefcase, ChevronDown, Loader2, MapPin, Sparkles } from 'lucide-react'

import {
  applicationStageLabel,
  formatCurrencyRange,
  jobLocationModeLabel,
  pickLanguage,
  postedLabel,
} from '@/lib/i18n'
import { getStoredAuthToken } from './AuthProvider'
import { useLanguage } from './LanguageProvider'
import { TechnicalTag } from './TechnicalText'
import type { ApplicationRecord, ApplicationStage } from '@/types/application'
import type { JobRecommendationResponse } from '@/types/job'

type SortMode = 'match' | 'latest' | 'salary'

const ALL_LOCATIONS = '__all_locations__'
const ACTIVE_STAGES: ApplicationStage[] = ['applied', 'screening', 'interview', 'offer', 'hired']

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
  return updated.sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  )
}

function getAuthorizedHeaders(includeJson = false) {
  const token = getStoredAuthToken()

  if (!token) {
    throw new Error('Please sign in again.')
  }

  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  }
}

export function CandidateJobBoard() {
  const { language } = useLanguage()
  const [data, setData] = useState<JobRecommendationResponse | null>(null)
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [actingJobId, setActingJobId] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [locationFilter, setLocationFilter] = useState(ALL_LOCATIONS)
  const [minSalaryFilter, setMinSalaryFilter] = useState('')
  const [maxSalaryFilter, setMaxSalaryFilter] = useState('')
  const [minMatch, setMinMatch] = useState('0')
  const [sortMode, setSortMode] = useState<SortMode>('match')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const copy = {
    title: pickLanguage(language, '岗位推荐', 'Job Recommendations'),
    heading: pickLanguage(
      language,
      '先按地点和薪资范围筛一轮，再挑高匹配岗位投递。',
      'Filter by location and salary first, then apply to the roles with the best match.'
    ),
    description: pickLanguage(
      language,
      '重要信息直接展示，匹配解释、缺口技能和投递建议放进展开区，页面会更干净。',
      'Key information stays visible while match rationale, skill gaps, and application advice live inside the expanded section.'
    ),
    refresh: pickLanguage(language, '刷新岗位', 'Refresh Jobs'),
    totalMatches: pickLanguage(language, '当前可选岗位', 'Available Roles'),
    activeApplications: pickLanguage(language, '进行中的投递', 'Active Applications'),
    topSkillGap: pickLanguage(language, '优先补齐技能', 'Top Skill Gap'),
    bestFocus: pickLanguage(language, '当前重点建议', 'Current Focus'),
    filters: pickLanguage(language, '筛选与排序', 'Filters & Sorting'),
    searchPlaceholder: pickLanguage(language, '搜索岗位、公司、技能', 'Search roles, companies, or skills'),
    minSalary: pickLanguage(language, '最低薪资', 'Min Salary'),
    maxSalary: pickLanguage(language, '最高薪资', 'Max Salary'),
    allLocations: pickLanguage(language, '全部地点', 'All Locations'),
    allMatches: pickLanguage(language, '全部匹配度', 'All Match Scores'),
    filterHint: pickLanguage(
      language,
      '薪资范围按岗位薪资上下限与筛选条件是否重叠来计算。地点和薪资都可以组合使用。',
      'Salary filtering checks overlap between your range and each job range. Location and salary filters can be combined.'
    ),
    sortByMatch: pickLanguage(language, '按匹配度排序', 'Sort by Match'),
    sortByLatest: pickLanguage(language, '按发布时间排序', 'Sort by Newest'),
    sortBySalary: pickLanguage(language, '按最高薪资排序', 'Sort by Highest Salary'),
    noResults: pickLanguage(
      language,
      '当前没有符合条件的岗位，试试放宽地点、薪资或匹配度筛选。',
      'No roles match your filters right now. Try widening location, salary, or match score.'
    ),
    matchScore: pickLanguage(language, '分匹配', 'match'),
    processing: pickLanguage(language, '处理中...', 'Working...'),
    hired: pickLanguage(language, '已录用', 'Hired'),
    withdraw: pickLanguage(language, '撤回投递', 'Withdraw'),
    apply: pickLanguage(language, '投递岗位', 'Apply'),
    applied: pickLanguage(language, '已投递', 'Applied'),
    details: pickLanguage(language, '展开匹配详情', 'Expand Match Details'),
    whyRecommended: pickLanguage(language, '为什么推荐给你', 'Why This Role'),
    noReason: pickLanguage(language, '系统暂未生成更多解释。', 'The system has not generated more rationale yet.'),
    advice: pickLanguage(language, '投递建议', 'Application Advice'),
    matchedSkills: pickLanguage(language, '命中技能', 'Matched Skills'),
    noMatchedSkills: pickLanguage(language, '暂未命中明显技能。', 'No clearly matched skills yet.'),
    missingSkills: pickLanguage(language, '建议补齐技能', 'Suggested Skills to Add'),
    skills: pickLanguage(language, '技能匹配', 'Skills'),
    experience: pickLanguage(language, '经验匹配', 'Experience'),
    location: pickLanguage(language, '地点匹配', 'Location'),
    growth: pickLanguage(language, '成长空间', 'Growth'),
    compensation: pickLanguage(language, '薪资匹配', 'Compensation'),
    loading: pickLanguage(language, '正在加载岗位推荐...', 'Loading job recommendations...'),
    noGap: pickLanguage(language, '暂无', 'None yet'),
    bestFocusFallback: pickLanguage(
      language,
      '继续更新简历，系统会给你更准确的推荐。',
      'Keep refining your resume and the system will generate more accurate recommendations.'
    ),
    loadFailed: pickLanguage(language, '岗位推荐加载失败。', 'Failed to load job recommendations.'),
    applicationsFailed: pickLanguage(language, '投递记录加载失败。', 'Failed to load applications.'),
    applyFailed: pickLanguage(language, '投递失败。', 'Failed to apply.'),
    withdrawFailed: pickLanguage(language, '撤回失败。', 'Failed to withdraw the application.'),
  }

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

      const recommendationPayload = (await recommendationResponse.json()) as
        | JobRecommendationResponse
        | { error?: string }
      const applicationPayload = (await applicationResponse.json()) as
        | ApplicationRecord[]
        | { error?: string }

      if (!recommendationResponse.ok || !('recommendations' in recommendationPayload)) {
        throw new Error(
          'error' in recommendationPayload && recommendationPayload.error
            ? recommendationPayload.error
            : copy.loadFailed
        )
      }

      if (!applicationResponse.ok || !Array.isArray(applicationPayload)) {
        throw new Error(
          !Array.isArray(applicationPayload) && applicationPayload.error
            ? applicationPayload.error
            : copy.applicationsFailed
        )
      }

      setData(recommendationPayload)
      setApplications(applicationPayload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed)
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
    const options = Array.from(
      new Set((data?.recommendations ?? []).map((item) => item.job.location))
    ).sort()

    return [{ value: ALL_LOCATIONS, label: copy.allLocations }, ...options.map((value) => ({ value, label: value }))]
  }, [copy.allLocations, data?.recommendations])

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
        const matchLocation =
          locationFilter === ALL_LOCATIONS || item.job.location === locationFilter
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
      topSkillGap: data?.summary.topSkillGap ?? copy.noGap,
      bestFocus: data?.summary.bestFocus ?? copy.bestFocusFallback,
    }
  }, [
    applications,
    copy.bestFocusFallback,
    copy.noGap,
    data,
    filteredRecommendations.length,
  ])

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
        throw new Error('error' in payload && payload.error ? payload.error : copy.applyFailed)
      }

      setApplications((current) => upsertApplication(current, payload))
      setMessage(
        pickLanguage(language, `已投递 ${payload.jobTitle}。`, `Applied to ${payload.jobTitle}.`)
      )
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.applyFailed)
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
        throw new Error('error' in payload && payload.error ? payload.error : copy.withdrawFailed)
      }

      setApplications((current) => upsertApplication(current, payload))
      setMessage(
        pickLanguage(language, `已撤回 ${payload.jobTitle}。`, `Withdrew ${payload.jobTitle}.`)
      )
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : copy.withdrawFailed)
    } finally {
      setActingJobId(null)
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">{copy.loading}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#eef4ff)] p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700">
            <Sparkles className="h-4 w-4" />
            <span>{copy.title}</span>
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">{copy.heading}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">{copy.description}</p>
        </div>
        <button onClick={() => void loadData()} className="btn-secondary">
          {copy.refresh}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">{copy.totalMatches}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.totalMatches}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.activeApplications}</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{stats.activeApplications}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.topSkillGap}</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{stats.topSkillGap}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.bestFocus}</p>
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
          {copy.filters}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </summary>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="input-field xl:col-span-2"
            placeholder={copy.searchPlaceholder}
          />
          <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="input-field">
            {locationOptions.map((location) => (
              <option key={location.value} value={location.value}>
                {location.label}
              </option>
            ))}
          </select>
          <input
            value={minSalaryFilter}
            onChange={(event) => setMinSalaryFilter(event.target.value)}
            className="input-field"
            placeholder={copy.minSalary}
          />
          <input
            value={maxSalaryFilter}
            onChange={(event) => setMaxSalaryFilter(event.target.value)}
            className="input-field"
            placeholder={copy.maxSalary}
          />
          <select value={minMatch} onChange={(event) => setMinMatch(event.target.value)} className="input-field">
            <option value="0">{copy.allMatches}</option>
            <option value="70">70+</option>
            <option value="80">80+</option>
            <option value="90">90+</option>
          </select>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <p className="text-xs leading-6 text-slate-500">{copy.filterHint}</p>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="input-field">
            <option value="match">{copy.sortByMatch}</option>
            <option value="latest">{copy.sortByLatest}</option>
            <option value="salary">{copy.sortBySalary}</option>
          </select>
        </div>
      </details>

      <div className="space-y-4">
        {filteredRecommendations.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
            {copy.noResults}
          </div>
        )}

        {filteredRecommendations.map((item) => {
          const application = applicationByJobId.get(item.job.id)
          const active = application ? isActiveApplication(application.stage) : false
          const canApply =
            !application || application.stage === 'withdrawn' || application.stage === 'rejected'

          return (
            <div key={item.job.id} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-slate-900">{item.job.title}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${scoreTone(item.matchScore)}`}>
                      {language === 'en'
                        ? `${item.matchScore}% ${copy.matchScore}`
                        : `${item.matchScore} ${copy.matchScore}`}
                    </span>
                    {application && (
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${stageTone(application.stage)}`}>
                        {applicationStageLabel(application.stage, language)}
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
                    <span>{jobLocationModeLabel(item.job.locationMode, language)}</span>
                    <span>{formatCurrencyRange(item.job, language)}</span>
                    <span>{postedLabel(item.job.postedAt, language)}</span>
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
                      ? copy.processing
                      : application?.stage === 'hired'
                        ? copy.hired
                        : active
                          ? copy.withdraw
                          : canApply
                            ? copy.apply
                            : copy.applied}
                  </button>
                </div>
              </div>

              <details className="mt-4 rounded-2xl bg-slate-50 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
                  {copy.details}
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </summary>
                <div className="mt-4 space-y-4 text-sm text-slate-600">
                  <div>
                    <p className="font-medium text-slate-900">{copy.whyRecommended}</p>
                    <p className="mt-1">
                      {item.reasons.join(language === 'en' ? '; ' : '；') || copy.noReason}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-slate-900">{copy.advice}</p>
                    <p className="mt-1">{item.personalizedAdvice}</p>
                  </div>

                  <div>
                    <p className="font-medium text-slate-900">{copy.matchedSkills}</p>
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
                        <span>{copy.noMatchedSkills}</span>
                      )}
                    </div>
                  </div>

                  {item.missingSkills.length > 0 && (
                    <div>
                      <p className="font-medium text-slate-900">{copy.missingSkills}</p>
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
                      <p className="text-xs text-slate-500">{copy.skills}</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{item.breakdown.skills}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-slate-500">{copy.experience}</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{item.breakdown.experience}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-slate-500">{copy.location}</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{item.breakdown.location}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-slate-500">{copy.growth}</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{item.breakdown.growth}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs text-slate-500">{copy.compensation}</p>
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
