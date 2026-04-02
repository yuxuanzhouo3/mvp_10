'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, FileText, Loader2, RefreshCw, Save, Users } from 'lucide-react'

import { getStoredAuthToken } from './AuthProvider'
import { TechnicalTag } from './TechnicalText'
import type { JobRecord } from '@/types/job'
import type { RecruiterCandidateRecord } from '@/types/recruiter'
import type { ResumeInsight } from '@/types/resume'

function authHeaders(json = false) {
  const token = getStoredAuthToken()
  if (!token) {
    throw new Error('请先重新登录。')
  }

  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  }
}

function insightTone(type: ResumeInsight['type']) {
  switch (type) {
    case 'strength':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'warning':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'improvement':
    default:
      return 'bg-sky-50 text-sky-700 border-sky-200'
  }
}

function stageLabel(stage: string) {
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

function stageTone(stage: string) {
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

function recommendationLabel(value: string | null | undefined) {
  switch (value) {
    case 'strong_yes':
      return '强烈推荐'
    case 'yes':
      return '推荐'
    case 'hold':
      return '待复核'
    case 'no':
      return '谨慎推进'
    default:
      return '待评估'
  }
}

function normalizeSkill(value: string) {
  return value.trim().toLowerCase()
}

function assessmentStatusLabel(value: string) {
  switch (value) {
    case 'draft':
      return '待作答'
    case 'in_progress':
      return '作答中'
    case 'submitted':
      return '已提交，待评分'
    case 'scored':
      return '已评分'
    default:
      return value
  }
}

export function RecruiterCandidateHub() {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [candidates, setCandidates] = useState<RecruiterCandidateRecord[]>([])
  const [resumeSelection, setResumeSelection] = useState<Record<string, string>>({})
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  )

  const stats = useMemo(() => {
    const activeCandidates = candidates.filter((candidate) => candidate.application.stage !== 'rejected').length
    const assessed = candidates.filter((candidate) => candidate.latestAssessment?.summary.overallScore !== null).length
    return {
      total: candidates.length,
      active: activeCandidates,
      assessed,
    }
  }, [candidates])

  useEffect(() => {
    void loadJobs()
  }, [])

  useEffect(() => {
    if (!selectedJobId) {
      setCandidates([])
      return
    }

    void loadCandidates(selectedJobId)
  }, [selectedJobId])

  async function loadJobs() {
    try {
      setLoadingJobs(true)
      setError('')
      const response = await fetch('/api/jobs?scope=mine', {
        cache: 'no-store',
        headers: authHeaders(),
      })
      const payload = (await response.json()) as JobRecord[] | { error?: string }

      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(!Array.isArray(payload) && payload.error ? payload.error : '岗位加载失败。')
      }

      setJobs(payload)
      setSelectedJobId((current) => current || payload[0]?.id || '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '岗位加载失败。')
    } finally {
      setLoadingJobs(false)
    }
  }

  async function loadCandidates(jobId: string) {
    try {
      setLoadingCandidates(true)
      setError('')
      const response = await fetch(`/api/recruiter/candidates?jobId=${encodeURIComponent(jobId)}`, {
        cache: 'no-store',
        headers: authHeaders(),
      })
      const payload = (await response.json()) as RecruiterCandidateRecord[] | { error?: string }

      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(!Array.isArray(payload) && payload.error ? payload.error : '候选人加载失败。')
      }

      setCandidates(payload)
      setResumeSelection(
        Object.fromEntries(payload.map((candidate) => [candidate.application.id, candidate.selectedResume?.id ?? '']))
      )
      setNoteDrafts(
        Object.fromEntries(payload.map((candidate) => [candidate.application.id, candidate.application.notes]))
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '候选人加载失败。')
    } finally {
      setLoadingCandidates(false)
    }
  }

  async function patchApplication(applicationId: string, body: Record<string, unknown>, successMessage: string) {
    try {
      setActingId(applicationId)
      setError('')
      setMessage('')
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as { id?: string; error?: string }

      if (!response.ok || !payload.id) {
        throw new Error(payload.error || '候选人更新失败。')
      }

      if (selectedJobId) {
        await loadCandidates(selectedJobId)
      }
      setMessage(successMessage)
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : '候选人更新失败。')
    } finally {
      setActingId(null)
    }
  }

  if (loadingJobs) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">正在加载候选人页面...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f5f8ff)] p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700">
            <Users className="h-4 w-4" />
            <span>候选人简历池</span>
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">这里只显示真实投递到当前岗位的候选人。</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            招聘方可以查看求职者投递时关联的简历，也可以在候选人的多个简历版本之间切换，并查看简历分析、改进建议和 AI 结果。
          </p>
        </div>
        <button onClick={() => selectedJobId && void loadCandidates(selectedJobId)} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          <span>刷新候选人</span>
        </button>
      </div>

      <div className="card">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block">
            <p className="mb-2 text-sm font-medium text-slate-900">选择岗位</p>
            <p className="mb-2 text-xs text-slate-500">只有投递到该岗位的求职者才会出现在下方。</p>
            <select
              value={selectedJobId}
              onChange={(event) => setSelectedJobId(event.target.value)}
              className="input-field"
            >
              {jobs.length === 0 && <option value="">暂无岗位</option>}
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} · {job.company}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-medium text-slate-900">{selectedJob?.title || '暂未选择岗位'}</p>
            <p className="mt-1">{selectedJob ? `当前岗位共有 ${candidates.length} 位投递候选人。` : '请选择岗位查看候选人。'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">投递候选人</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">在流程中</p>
          <p className="mt-2 text-3xl font-semibold text-sky-700">{stats.active}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">已收到 AI 测评结果</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{stats.assessed}</p>
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

      {loadingCandidates ? (
        <div className="card flex items-center justify-center py-16">
          <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
          <span className="text-sm text-slate-500">正在加载候选人简历...</span>
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
          当前岗位还没有收到投递简历。
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map((candidate) => {
            const selectedResumeId = resumeSelection[candidate.application.id] ?? ''
            const selectedResume =
              candidate.availableResumes.find((resume) => resume.id === selectedResumeId) ?? candidate.selectedResume
            const candidateSkills = selectedResume?.profile.skills ?? []
            const candidateSkillSet = new Set(candidateSkills.map(normalizeSkill))
            const matchedSkills =
              selectedJob?.requiredSkills.filter((skill) => candidateSkillSet.has(normalizeSkill(skill))) ?? []
            const extraSkills = candidateSkills.filter(
              (skill) => !matchedSkills.some((matchedSkill) => normalizeSkill(matchedSkill) === normalizeSkill(skill))
            )
            const strengths = [...matchedSkills, ...extraSkills].slice(0, 8)
            const missingRequiredSkills =
              selectedJob?.requiredSkills.filter((skill) => !candidateSkillSet.has(normalizeSkill(skill))) ?? []
            const suggestions =
              selectedResume?.insights.filter((item) => item.type === 'improvement' || item.type === 'warning') ?? []

            return (
              <div key={candidate.application.id} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{candidate.application.userName}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${stageTone(candidate.application.stage)}`}>
                        {stageLabel(candidate.application.stage)}
                      </span>
                      {selectedResume && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          简历评分 {selectedResume.score} 分
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {candidate.application.userEmail}
                      {selectedResume?.contact.phone ? ` · ${selectedResume.contact.phone}` : ''}
                      {selectedResume?.contact.location ? ` · ${selectedResume.contact.location}` : ''}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {selectedResume?.summary || '当前还没有可用的简历摘要。'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(selectedResume?.profile.skills ?? []).slice(0, 8).map((skill) => (
                        <TechnicalTag
                          key={skill}
                          text={skill}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="w-full xl:w-[320px]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-900">切换候选人简历版本</p>
                      <p className="mt-1 text-xs text-slate-500">求职者有多版简历时，可以在这里切换本岗位要使用的版本。</p>
                      <select
                        value={selectedResumeId}
                        onChange={(event) =>
                          setResumeSelection((current) => ({
                            ...current,
                            [candidate.application.id]: event.target.value,
                          }))
                        }
                        className="input-field mt-3"
                      >
                        {candidate.availableResumes.length === 0 && <option value="">暂无可选简历</option>}
                        {candidate.availableResumes.map((resume) => (
                          <option key={resume.id} value={resume.id}>
                            {resume.fileName} · {resume.score} 分
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          void patchApplication(
                            candidate.application.id,
                            { resumeId: selectedResumeId },
                            `已保存 ${candidate.application.userName} 的简历选择。`
                          )
                        }
                        className="btn-secondary mt-3 flex w-full items-center justify-center gap-2"
                        disabled={!selectedResumeId || actingId === candidate.application.id}
                      >
                        {actingId === candidate.application.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        <span>保存当前岗位所用简历</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-medium text-slate-900">候选人技能亮点</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {strengths.length > 0 ? (
                        strengths.map((skill) => (
                          <span key={skill} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">当前简历里还没有识别出明确技能。</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-medium text-slate-900">岗位技能缺口</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {missingRequiredSkills.length > 0 ? (
                        missingRequiredSkills.map((skill) => (
                          <span key={skill} className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">当前候选人已基本覆盖这个岗位要求的核心技能。</span>
                      )}
                    </div>
                  </div>
                </div>

                <details className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
                    展开查看完整简历分析与流程备注
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </summary>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-4">
                      <div className="rounded-2xl bg-white p-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary-600" />
                          <p className="text-sm font-medium text-slate-900">候选人资料</p>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-600 md:grid-cols-2">
                          <div>
                            <p className="text-xs text-slate-500">姓名</p>
                            <p className="mt-1 font-medium text-slate-900">{selectedResume?.contact.name || candidate.application.userName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">邮箱</p>
                            <p className="mt-1 font-medium text-slate-900">{selectedResume?.contact.email || candidate.application.userEmail}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">电话</p>
                            <p className="mt-1 font-medium text-slate-900">{selectedResume?.contact.phone || '未补充'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">地点</p>
                            <p className="mt-1 font-medium text-slate-900">{selectedResume?.contact.location || '未补充'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">当前岗位</p>
                            <p className="mt-1 font-medium text-slate-900">{selectedResume?.profile.currentTitle || '未识别'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">经验年限</p>
                            <p className="mt-1 font-medium text-slate-900">
                              {selectedResume?.profile.yearsExperience !== null && selectedResume?.profile.yearsExperience !== undefined
                                ? `${selectedResume.profile.yearsExperience} 年`
                                : '未识别'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-sm font-medium text-slate-900">招聘流程备注</p>
                        <textarea
                          rows={5}
                          value={noteDrafts[candidate.application.id] ?? ''}
                          onChange={(event) =>
                            setNoteDrafts((current) => ({
                              ...current,
                              [candidate.application.id]: event.target.value,
                            }))
                          }
                          className="input-field mt-3"
                          placeholder="记录这个候选人的面试关注点、风险或推进建议"
                        />
                        <button
                          onClick={() =>
                            void patchApplication(
                              candidate.application.id,
                              { notes: noteDrafts[candidate.application.id] ?? '' },
                              `已保存 ${candidate.application.userName} 的流程备注。`
                            )
                          }
                          className="btn-secondary mt-3"
                        >
                          保存备注
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-sm font-medium text-slate-900">岗位要求技能</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(selectedJob?.requiredSkills ?? []).length > 0 ? (
                            selectedJob?.requiredSkills.map((skill) => (
                              <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                                {skill}
                              </span>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500">当前岗位还没有填写必须技能。</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-sm font-medium text-slate-900">简历分析建议</p>
                        <div className="mt-3 space-y-3">
                          {suggestions.length > 0 ? (
                            suggestions.map((item) => (
                              <div key={`${item.title}-${item.description}`} className="rounded-2xl border border-slate-200 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                                  <span className={`rounded-full border px-2 py-1 text-[11px] ${insightTone(item.type)}`}>
                                    {item.priority === 'high' ? '优先处理' : item.priority === 'medium' ? '建议处理' : '可优化'}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500">暂未生成详细建议。</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-sm font-medium text-slate-900">AI 结果同步</p>
                        <div className="mt-3 space-y-3 text-sm text-slate-600">
                          <div className="rounded-2xl border border-slate-200 p-3">
                            <p className="font-medium text-slate-900">AI 初筛</p>
                            <p className="mt-2 leading-7">{candidate.screening?.summary || '还没有运行 AI 初筛。'}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 p-3">
                            <p className="font-medium text-slate-900">候选人答题回传</p>
                            {candidate.latestAssessment ? (
                              candidate.latestAssessment.status === 'scored' ? (
                                <>
                                  <p className="mt-2 leading-7">{candidate.latestAssessment.summary.summary}</p>
                                  <p className="mt-2 text-xs text-slate-500">
                                    {candidate.latestAssessment.summary.overallScore ?? '待评分'} 分 ·{' '}
                                    {recommendationLabel(candidate.latestAssessment.summary.recommendation)}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="mt-2 leading-7">
                                    {candidate.latestAssessment.status === 'draft'
                                      ? '题目已经发送，候选人还没有开始作答。'
                                      : candidate.latestAssessment.status === 'in_progress'
                                        ? '候选人正在作答，提交后系统会自动评分并回传给招聘方。'
                                        : '候选人已经提交答案，系统正在完成评分，请稍后刷新查看。'}
                                  </p>
                                  <p className="mt-2 text-xs text-slate-500">
                                    当前状态：{assessmentStatusLabel(candidate.latestAssessment.status)}
                                  </p>
                                </>
                              )
                            ) : (
                              <p className="mt-2">还没有向该候选人发送 AI 面试题。</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
