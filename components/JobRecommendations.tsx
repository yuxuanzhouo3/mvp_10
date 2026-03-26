'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building,
  DollarSign,
  Filter,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'

import { getStoredAuthToken, useAuth } from './AuthProvider'
import type { ApplicationRecord, ApplicationStage } from '@/types/application'
import type { JobRecommendationResponse, JobRecord, JobType } from '@/types/job'

type SalaryBand = '' | '0-200k' | '200k-300k' | '300k-400k' | '400k+'
type SortOption = 'match' | 'latest' | 'salary-high'

interface Filters {
  search: string
  location: string
  salary: SalaryBand
  type: JobType | ''
  skills: string
  minMatch: string
}

const defaultFilters: Filters = { search: '', location: '', salary: '', type: '', skills: '', minMatch: '0' }
const ACTIVE_STAGES: ApplicationStage[] = ['applied', 'screening', 'interview', 'offer', 'hired']

function salaryLabel(job: JobRecord) {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: job.currency,
    maximumFractionDigits: 0,
  })
  return `${formatter.format(job.salaryMin)} - ${formatter.format(job.salaryMax)}`
}

function normalizedSalary(job: JobRecord) {
  const rate = job.currency === 'CNY' ? 1 : 7.2
  return { min: job.salaryMin * rate, max: job.salaryMax * rate }
}

function inBand(job: JobRecord, band: SalaryBand) {
  if (!band) return true
  const { min, max } = normalizedSalary(job)
  if (band === '0-200k') return min < 200000
  if (band === '200k-300k') return max >= 200000 && min <= 300000
  if (band === '300k-400k') return max >= 300000 && min <= 400000
  return max >= 400000
}

function postedLabel(postedAt: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(postedAt).getTime()) / (1000 * 60 * 60 * 24)))
  return days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} ago`
}

function scoreColor(score: number) {
  if (score >= 90) return 'text-green-600 bg-green-100'
  if (score >= 80) return 'text-blue-600 bg-blue-100'
  if (score >= 70) return 'text-yellow-600 bg-yellow-100'
  return 'text-gray-600 bg-gray-100'
}

function readIds(key: string) {
  if (typeof window === 'undefined' || !key) return []
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeIds(key: string, ids: string[]) {
  if (typeof window === 'undefined' || !key) return
  window.localStorage.setItem(key, JSON.stringify(ids))
}

function isActiveApplication(stage: ApplicationStage) {
  return ACTIVE_STAGES.includes(stage)
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

function stagePill(stage: ApplicationStage) {
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
      return 'bg-emerald-100 text-emerald-700'
  }
}

function upsertApplication(records: ApplicationRecord[], next: ApplicationRecord) {
  const existingIndex = records.findIndex((item) => item.id === next.id)
  if (existingIndex === -1) {
    return [next, ...records]
  }

  const updated = [...records]
  updated[existingIndex] = next
  return updated.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

export function JobRecommendations() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [sortBy, setSortBy] = useState<SortOption>('match')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [data, setData] = useState<JobRecommendationResponse | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [actingJobId, setActingJobId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setSavedIds(readIds(`job_saved_${user.id}`))
  }, [user])

  useEffect(() => {
    if (!user) return
    writeIds(`job_saved_${user.id}`, savedIds)
  }, [savedIds, user])

  useEffect(() => {
    async function loadRecommendations() {
      const token = getStoredAuthToken()
      if (!token || !user) {
        setError('Please sign in again to load personalized recommendations.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const [recommendationResponse, applicationResponse] = await Promise.all([
          fetch('/api/jobs/recommendations', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }),
          fetch('/api/applications?scope=me', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }),
        ])

        const recommendationPayload = (await recommendationResponse.json()) as JobRecommendationResponse | { error?: string }
        const applicationPayload = (await applicationResponse.json()) as ApplicationRecord[] | { error?: string }

        if (!recommendationResponse.ok || !('recommendations' in recommendationPayload)) {
          throw new Error(
            'error' in recommendationPayload && recommendationPayload.error
              ? recommendationPayload.error
              : 'Failed to load recommendations.'
          )
        }

        if (!applicationResponse.ok || !Array.isArray(applicationPayload)) {
          throw new Error(
            !Array.isArray(applicationPayload) && applicationPayload.error
              ? applicationPayload.error
              : 'Failed to load application records.'
          )
        }

        setData(recommendationPayload)
        setApplications(applicationPayload)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load recommendations.')
      } finally {
        setLoading(false)
      }
    }

    void loadRecommendations()
  }, [user])

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

  const filteredJobs = useMemo(() => {
    const source = data?.recommendations ?? []
    const skills = filters.skills.split(/[,/]/).map((item) => item.trim().toLowerCase()).filter(Boolean)
    const search = filters.search.trim().toLowerCase()
    const location = filters.location.trim().toLowerCase()
    const minMatch = Number(filters.minMatch || '0')

    return source
      .filter((recommendation) => {
        const job = recommendation.job
        const skillPool = [...job.requiredSkills, ...job.preferredSkills].map((item) => item.toLowerCase())
        const text = [job.title, job.company, job.location, job.description, ...recommendation.reasons].join(' ').toLowerCase()
        return (
          (!search || text.includes(search)) &&
          (!location || job.location.toLowerCase().includes(location)) &&
          (!filters.type || job.type === filters.type) &&
          inBand(job, filters.salary) &&
          (skills.length === 0 || skills.every((skill) => skillPool.some((item) => item.includes(skill)))) &&
          recommendation.matchScore >= minMatch
        )
      })
      .sort((left, right) => {
        if (sortBy === 'latest') return new Date(right.job.postedAt).getTime() - new Date(left.job.postedAt).getTime()
        if (sortBy === 'salary-high') return normalizedSalary(right.job).max - normalizedSalary(left.job).max
        return right.matchScore - left.matchScore
      })
  }, [data, filters, sortBy])

  useEffect(() => {
    if (filteredJobs.length === 0) return setSelectedId(null)
    if (!selectedId || !filteredJobs.some((item) => item.job.id === selectedId)) {
      setSelectedId(filteredJobs[0].job.id)
    }
  }, [filteredJobs, selectedId])

  const selected = filteredJobs.find((item) => item.job.id === selectedId) ?? filteredJobs[0] ?? null
  const radarData = selected
    ? [
        { name: 'Skills', value: selected.breakdown.skills },
        { name: 'Exp', value: selected.breakdown.experience },
        { name: 'Location', value: selected.breakdown.location },
        { name: 'Growth', value: selected.breakdown.growth },
        { name: 'Pay', value: selected.breakdown.compensation },
      ]
    : []
  const avgMatch = filteredJobs.length ? Math.round(filteredJobs.reduce((sum, item) => sum + item.matchScore, 0) / filteredJobs.length) : 0
  const activeApplicationCount = applications.filter((item) => isActiveApplication(item.stage)).length

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function toggleSaved(id: string) {
    setSavedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  async function applyToJob(jobId: string, matchScore: number) {
    const token = getStoredAuthToken()
    if (!token) {
      setError('Please sign in again before applying.')
      return
    }

    try {
      setActingJobId(jobId)
      setError('')
      setFeedback('')

      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId, matchScore }),
      })

      const payload = (await response.json()) as ApplicationRecord | { error?: string }
      if (!response.ok || !('id' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : 'Failed to apply.')
      }

      setApplications((current) => upsertApplication(current, payload))
      setFeedback(`Application submitted for ${payload.jobTitle}.`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to apply.')
    } finally {
      setActingJobId(null)
    }
  }

  async function withdrawApplication(application: ApplicationRecord) {
    try {
      setActingJobId(application.jobId)
      setError('')
      setFeedback('')

      const response = await fetch(`/api/applications/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'withdrawn' }),
      })

      const payload = (await response.json()) as ApplicationRecord | { error?: string }
      if (!response.ok || !('id' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : 'Failed to withdraw application.')
      }

      setApplications((current) => upsertApplication(current, payload))
      setFeedback(`Application withdrawn from ${payload.jobTitle}.`)
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : 'Failed to withdraw application.')
    } finally {
      setActingJobId(null)
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Loading personalized job recommendations...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Intelligent Job Matching</h1>
          <p className="mt-2 text-gray-600">Server-ranked roles based on your resume signals, preferences, and skill overlap.</p>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 md:mt-0">
          <TrendingUp className="h-5 w-5 text-primary-600" />
          <span>{filteredJobs.length} active matches</span>
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

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card"><p className="text-sm text-gray-500">Average Match</p><p className="mt-1 text-2xl font-bold text-blue-700">{avgMatch}%</p></div>
        <div className="card"><p className="text-sm text-gray-500">Live Applications</p><p className="mt-1 text-2xl font-bold text-emerald-700">{activeApplicationCount}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Top Skill Gap</p><p className="mt-1 text-2xl font-bold text-amber-700">{data?.summary.topSkillGap ?? 'None'}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Profile Source</p><p className="mt-1 text-sm font-medium text-gray-900">{data?.profile.resumeFound ? 'Resume-powered' : 'Preferences-powered'}</p></div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <label className="mb-2 block text-sm font-medium text-gray-700">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} className="input-field pl-10" placeholder="Role, company, skill..." />
            </div>
          </div>
          <div><label className="mb-2 block text-sm font-medium text-gray-700">Location</label><input value={filters.location} onChange={(event) => updateFilter('location', event.target.value)} className="input-field" placeholder="Remote, Shanghai..." /></div>
          <div><label className="mb-2 block text-sm font-medium text-gray-700">Type</label><select value={filters.type} onChange={(event) => updateFilter('type', event.target.value as JobType | '')} className="input-field"><option value="">All types</option><option value="Full-time">Full-time</option><option value="Part-time">Part-time</option><option value="Contract">Contract</option><option value="Internship">Internship</option></select></div>
          <div><label className="mb-2 block text-sm font-medium text-gray-700">Salary</label><select value={filters.salary} onChange={(event) => updateFilter('salary', event.target.value as SalaryBand)} className="input-field"><option value="">Any salary</option><option value="0-200k">Below CNY 200k</option><option value="200k-300k">CNY 200k - 300k</option><option value="300k-400k">CNY 300k - 400k</option><option value="400k+">CNY 400k+</option></select></div>
          <div><label className="mb-2 block text-sm font-medium text-gray-700">Skills</label><input value={filters.skills} onChange={(event) => updateFilter('skills', event.target.value)} className="input-field" placeholder="Python, SQL" /></div>
          <div><label className="mb-2 block text-sm font-medium text-gray-700">Min Match</label><select value={filters.minMatch} onChange={(event) => updateFilter('minMatch', event.target.value)} className="input-field"><option value="0">Any score</option><option value="70">70%+</option><option value="80">80%+</option><option value="90">90%+</option></select></div>
          <div><label className="mb-2 block text-sm font-medium text-gray-700">Sort</label><select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} className="input-field"><option value="match">Best match</option><option value="latest">Latest</option><option value="salary-high">Highest salary</option></select></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {filteredJobs.length === 0 && (
            <div className="card border border-dashed border-gray-300">
              <div className="flex items-start gap-3">
                <Filter className="mt-0.5 h-5 w-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">No roles match these filters.</p>
                  <p className="mt-1 text-sm text-gray-600">Try lowering the minimum match threshold or removing a location restriction.</p>
                </div>
              </div>
            </div>
          )}
          {filteredJobs.map((recommendation) => {
            const job = recommendation.job
            const saved = savedIds.includes(job.id)
            const application = applicationByJobId.get(job.id)
            const active = application ? isActiveApplication(application.stage) : false
            const canApply = !application || application.stage === 'withdrawn' || application.stage === 'rejected'
            const buttonLabel = !application
              ? 'Apply Now'
              : application.stage === 'rejected'
                ? 'Re-apply'
                : application.stage === 'withdrawn'
                  ? 'Apply Again'
                  : application.stage === 'hired'
                    ? 'Hired'
                    : 'Withdraw Application'
            return (
              <div key={job.id} onClick={() => setSelectedId(job.id)} className={`card cursor-pointer transition-all ${selected?.job.id === job.id ? 'border border-primary-400 bg-primary-50/40 shadow-md' : 'border border-transparent hover:shadow-md'}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-gray-900">{job.title}</h3>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${scoreColor(recommendation.matchScore)}`}>{recommendation.matchScore}% Match</span>
                  {application && <span className={`rounded-full px-2 py-1 text-xs font-medium ${stagePill(application.stage)}`}>{stageLabel(application.stage)}</span>}
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-gray-600"><div className="flex items-center"><Building className="mr-1 h-4 w-4" />{job.company}</div><div className="flex items-center"><MapPin className="mr-1 h-4 w-4" />{job.location}</div><div className="flex items-center"><DollarSign className="mr-1 h-4 w-4" />{salaryLabel(job)}</div><div className="flex items-center"><Briefcase className="mr-1 h-4 w-4" />{job.type}</div></div>
                <p className="text-sm text-gray-700">{job.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">{[...job.requiredSkills, ...job.preferredSkills].slice(0, 8).map((skill) => <span key={skill} className="rounded-md bg-primary-100 px-2 py-1 text-xs text-primary-700">{skill}</span>)}</div>
                <div className="mt-4 rounded-lg bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">Why this matches</p>
                  <p className="mt-1 text-sm text-gray-600">{recommendation.reasons.join(' | ')}</p>
                  <p className="mt-2 text-sm text-gray-600">{recommendation.personalizedAdvice}</p>
                  {application && (
                    <p className="mt-2 text-xs text-gray-500">
                      Last updated {new Date(application.updatedAt).toLocaleString()}.
                    </p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <button onClick={(event) => { event.stopPropagation(); toggleSaved(job.id) }} className="btn-secondary flex items-center space-x-2">
                    {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                    <span>{saved ? 'Saved' : 'Save Job'}</span>
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      if (application && active && application.stage !== 'hired') {
                        void withdrawApplication(application)
                        return
                      }
                      if (canApply) {
                        void applyToJob(job.id, recommendation.matchScore)
                      }
                    }}
                    disabled={actingJobId === job.id || application?.stage === 'hired'}
                    className={active ? 'btn-secondary' : 'btn-primary'}
                  >
                    {actingJobId === job.id ? 'Saving...' : buttonLabel}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900">Profile Signals</h3><Sparkles className="h-5 w-5 text-primary-500" /></div>
            {data?.profile ? <div className="space-y-3 text-sm text-gray-700"><p><span className="font-medium text-gray-900">Name:</span> {data.profile.candidateName || user?.name || 'Unknown'}</p><p><span className="font-medium text-gray-900">Experience:</span> {data.profile.yearsExperience !== null ? `${data.profile.yearsExperience} years` : data.profile.experienceLevel}</p><p><span className="font-medium text-gray-900">Industries:</span> {data.profile.industries.join(', ') || 'Not set'}</p><p><span className="font-medium text-gray-900">Locations:</span> {data.profile.preferredLocations.join(', ') || 'Not set'}</p><p><span className="font-medium text-gray-900">Skills:</span> {data.profile.skills.join(', ') || 'Upload a resume to improve matching'}</p></div> : <p className="text-sm text-gray-500">Profile signals will appear once recommendations load.</p>}
          </div>

          <div className="card">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900">Match Analysis</h3>{selected && <span className="rounded-full bg-primary-100 px-2 py-1 text-xs font-medium text-primary-700">{selected.job.company}</span>}</div>
            {selected ? <><div className="h-64"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData}><PolarGrid /><PolarAngleAxis dataKey="name" /><PolarRadiusAxis angle={30} domain={[0, 100]} /><Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} /></RadarChart></ResponsiveContainer></div><div className="mt-4 rounded-lg bg-gray-50 p-4"><p className="text-sm font-medium text-gray-900">Matched skills</p><p className="mt-1 text-sm text-gray-600">{selected.matchedSkills.join(', ') || 'No strong overlap detected yet.'}</p><p className="mt-3 text-sm font-medium text-gray-900">Skill gaps</p><p className="mt-1 text-sm text-gray-600">{selected.missingSkills.join(', ') || 'No major gap detected.'}</p></div></> : <p className="text-sm text-gray-500">Pick a role to inspect the breakdown.</p>}
          </div>

          <div className="card">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Next Move</h3>
            {selected ? <div className="space-y-3"><div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><Target className="mt-0.5 h-5 w-5 text-amber-600" /><div><p className="text-sm font-medium text-amber-900">Focus on {selected.job.company}</p><p className="mt-1 text-sm text-amber-800">{data?.summary.bestFocus}</p></div></div></div><p className="text-sm text-gray-600">Posted {postedLabel(selected.job.postedAt)}. Keep your resume aligned to {selected.job.requiredSkills.slice(0, 2).join(' and ')} before applying.</p></div> : <p className="text-sm text-gray-500">Once a result appears, this panel will suggest the next action.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
