'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  PlayCircle,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react'

import { getStoredAuthToken } from './AuthProvider'
import type { JobRecord } from '@/types/job'
import type { ResumeListItem } from '@/types/resume'
import type { RecruiterScreeningRecord } from '@/types/screening'

function scoreTone(score: number) {
  if (score >= 85) return 'bg-emerald-100 text-emerald-700'
  if (score >= 72) return 'bg-blue-100 text-blue-700'
  if (score >= 58) return 'bg-amber-100 text-amber-700'
  return 'bg-rose-100 text-rose-700'
}

function recommendationLabel(record: RecruiterScreeningRecord) {
  switch (record.recommendation) {
    case 'strong_yes':
      return '优先推进'
    case 'yes':
      return '建议面试'
    case 'hold':
      return '待复核'
    case 'no':
    default:
      return '谨慎推进'
  }
}

export function RecruiterAIScreening() {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [screenings, setScreenings] = useState<RecruiterScreeningRecord[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [runningAll, setRunningAll] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData(preferredJobId?: string) {
    const token = getStoredAuthToken()

    if (!token) {
      setError('Please sign in again to run recruiter AI screening.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const [jobResponse, resumeResponse, screeningResponse] = await Promise.all([
        fetch('/api/jobs?scope=mine', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/resumes', { cache: 'no-store' }),
        fetch('/api/recruiter/screenings', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const jobData = (await jobResponse.json()) as JobRecord[] | { error?: string }
      const resumeData = (await resumeResponse.json()) as ResumeListItem[] | { error?: string }
      const screeningData = (await screeningResponse.json()) as RecruiterScreeningRecord[] | { error?: string }

      if (!jobResponse.ok || !Array.isArray(jobData)) {
        throw new Error(!Array.isArray(jobData) && jobData.error ? jobData.error : 'Failed to load jobs.')
      }

      if (!resumeResponse.ok || !Array.isArray(resumeData)) {
        throw new Error(!Array.isArray(resumeData) && resumeData.error ? resumeData.error : 'Failed to load resumes.')
      }

      if (!screeningResponse.ok || !Array.isArray(screeningData)) {
        throw new Error(
          !Array.isArray(screeningData) && screeningData.error ? screeningData.error : 'Failed to load screenings.'
        )
      }

      setJobs(jobData)
      setResumes(resumeData)
      setScreenings(screeningData)
      setSelectedJobId((current) => preferredJobId ?? current ?? jobData[0]?.id ?? '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load recruiter AI screening.')
    } finally {
      setLoading(false)
    }
  }

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  )

  const screeningMap = useMemo(() => {
    return new Map(
      screenings
        .filter((record) => record.jobId === selectedJobId)
        .map((record) => [`${record.jobId}:${record.resumeId}`, record])
    )
  }, [screenings, selectedJobId])

  const scopedResumes = useMemo(() => {
    return resumes.map((resume) => {
      const screening = selectedJobId ? screeningMap.get(`${selectedJobId}:${resume.id}`) ?? null : null
      return { resume, screening }
    })
  }, [resumes, screeningMap, selectedJobId])

  const stats = useMemo(() => {
    const scopedScreenings = screenings.filter((record) => record.jobId === selectedJobId)
    return {
      totalResumes: resumes.length,
      screened: scopedScreenings.length,
      strong: scopedScreenings.filter((record) => record.overallScore >= 72).length,
      pending: Math.max(resumes.length - scopedScreenings.length, 0),
    }
  }, [resumes.length, screenings, selectedJobId])

  async function runSingleScreening(resumeId: string) {
    const token = getStoredAuthToken()

    if (!token || !selectedJobId) {
      setError('请先选择一个岗位，再运行 AI 初筛。')
      return
    }

    try {
      setRunningId(resumeId)
      setError('')
      setMessage('')

      const response = await fetch('/api/recruiter/screenings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId: selectedJobId, resumeId }),
      })

      const payload = (await response.json()) as RecruiterScreeningRecord | { error?: string }

      if (!response.ok || !('id' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : 'Failed to run screening.')
      }

      setScreenings((current) => {
        const next = current.filter((item) => item.id !== payload.id)
        next.unshift(payload)
        return next
      })
      setExpandedId(payload.id)
      setMessage(`已为 ${payload.candidateName || '该候选人'} 生成 AI 初筛结果与面试题。`)
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Failed to run screening.')
    } finally {
      setRunningId(null)
    }
  }

  async function runAllScreenings() {
    if (!selectedJobId) {
      setError('请先选择一个岗位，再批量运行 AI 初筛。')
      return
    }

    setRunningAll(true)
    setError('')
    setMessage('')

    try {
      for (const item of resumes) {
        await runSingleScreening(item.id)
      }

      setMessage(`已完成岗位“${selectedJob?.title || ''}”的批量 AI 初筛。`)
    } finally {
      setRunningAll(false)
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">Loading recruiter AI screening...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">AI 初筛工作台</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
            招聘方先选定 JD，再让系统把候选人简历跑过首轮 AI 预筛。平台会自动生成面试题、预筛分数、
            风险项和面试追问方向，帮助你替代传统 HR 首轮筛简历。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => void loadData(selectedJobId)} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <span>刷新数据</span>
          </button>
          <button
            onClick={() => void runAllScreenings()}
            className="btn-primary flex items-center gap-2"
            disabled={!selectedJobId || runningAll || resumes.length === 0}
          >
            {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span>{runningAll ? '批量初筛中...' : '为全部简历生成 AI 初筛'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">候选人简历</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.totalResumes}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">已生成初筛</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.screened}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">可推进</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{stats.strong}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">待筛选</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700">{stats.pending}</p>
        </div>
      </div>

      <div className="card">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">选择岗位</label>
            <select
              value={selectedJobId}
              onChange={(event) => setSelectedJobId(event.target.value)}
              className="input-field"
            >
              {jobs.length === 0 && <option value="">暂无岗位，请先创建 JD</option>}
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} · {job.company}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {selectedJob ? (
              <div className="space-y-1">
                <p className="font-medium text-slate-900">{selectedJob.title}</p>
                <p>{selectedJob.requiredSkills.slice(0, 4).join('、') || '待补充核心技能要求'}</p>
              </div>
            ) : (
              '先创建一个岗位，再运行 AI 初筛。'
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {scopedResumes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
            还没有候选人简历。先到“候选人库”里上传或整理简历。
          </div>
        )}

        {scopedResumes.map(({ resume, screening }) => {
          const expanded = screening ? expandedId === screening.id : false
          const tone = screening ? scoreTone(screening.overallScore) : 'bg-slate-100 text-slate-600'

          return (
            <div key={resume.id} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {resume.contact.name || resume.fileName}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      简历评分 {resume.score}
                    </span>
                    {screening && (
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>
                        {screening.overallScore} 分 · {recommendationLabel(screening)}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {resume.contact.email || '未识别邮箱'} · {resume.contact.location || '地点待补充'}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{resume.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {resume.profile.skills.slice(0, 8).map((skill) => (
                      <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-3">
                  <button
                    onClick={() => void runSingleScreening(resume.id)}
                    className="btn-primary flex items-center gap-2"
                    disabled={!selectedJobId || runningAll || runningId === resume.id}
                  >
                    {runningId === resume.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                    <span>{screening ? '重新生成初筛' : '生成 AI 初筛'}</span>
                  </button>
                  {screening && (
                    <button
                      onClick={() => setExpandedId((current) => (current === screening.id ? null : screening.id))}
                      className="btn-secondary flex items-center gap-2"
                    >
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <span>{expanded ? '收起结果' : '查看结果'}</span>
                    </button>
                  )}
                </div>
              </div>

              {screening && expanded && (
                <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-900">AI 初筛结论</p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{screening.summary}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">技能匹配</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{screening.scoreBreakdown.skillFit}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">经验匹配</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{screening.scoreBreakdown.experienceFit}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">简历质量</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{screening.scoreBreakdown.resumeQuality}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">沟通准备度</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{screening.scoreBreakdown.communicationFit}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-900">亮点</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {screening.highlights.map((item) => (
                          <span key={item} className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-medium text-slate-900">风险项</p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {screening.risks.length === 0 && <li>当前未发现明显风险项。</li>}
                        {screening.risks.map((risk) => (
                          <li key={risk}>- {risk}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary-600" />
                        <p className="text-sm font-medium text-slate-900">面试重点追问</p>
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {screening.interviewFocus.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary-600" />
                        <p className="text-sm font-medium text-slate-900">自动生成的面试题</p>
                      </div>
                      <div className="mt-4 space-y-3">
                        {screening.questions.map((question, index) => (
                          <div key={question.id} className="rounded-2xl bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-slate-900">
                                Q{index + 1}. {question.prompt}
                              </p>
                              <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] text-slate-600">
                                {question.category}
                              </span>
                            </div>
                            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                              期待要点
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {question.expectedPoints.map((point) => (
                                <span key={point} className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">
                                  {point}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
