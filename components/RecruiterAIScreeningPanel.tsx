'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  FileSearch,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react'

import { getStoredAuthToken } from './AuthProvider'
import { TechnicalTag } from './TechnicalText'
import type { AssessmentQuestion, AssessmentQuestionCategory, AssessmentRecord } from '@/types/assessment'
import type { JobRecord } from '@/types/job'
import type { RecruiterCandidateRecord } from '@/types/recruiter'
import type { RecruiterScreeningRecord } from '@/types/screening'

type QuestionSourceMode = 'ai' | 'manual'
type DraftOrigin = AssessmentRecord['source'] | 'manual' | null

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

function categoryLabel(value: AssessmentQuestionCategory) {
  switch (value) {
    case 'technical':
      return '技术能力'
    case 'problem_solving':
      return '问题解决'
    case 'behavioral':
      return '行为案例'
    case 'communication':
      return '沟通表达'
    case 'role_fit':
    default:
      return '岗位匹配'
  }
}

function emptyQuestion(index: number): AssessmentQuestion {
  return {
    id: crypto.randomUUID(),
    prompt: '',
    category: index % 2 === 0 ? 'technical' : 'communication',
    difficulty: index < 2 ? 'easy' : index < 4 ? 'medium' : 'hard',
    expectedPoints: [],
    idealAnswer: '',
    maxScore: 20,
  }
}

function emptyQuestionSet() {
  return Array.from({ length: 5 }, (_, index) => emptyQuestion(index))
}

function splitPoints(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
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

function assessmentStatusLabel(value: AssessmentRecord['status']) {
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

function normalizeFromScreening(record: RecruiterScreeningRecord | null | undefined) {
  return record?.questions.map((question) => ({ ...question })) ?? null
}

function buildTitle(job: JobRecord | null, candidate: RecruiterCandidateRecord | null, sourceMode: QuestionSourceMode) {
  if (!job) {
    return 'AI 面试题'
  }

  const name = candidate?.application.userName || '候选人'
  return sourceMode === 'manual' ? `招聘方自定义面试题 - ${job.title} - ${name}` : `AI 初筛面试题 - ${job.title} - ${name}`
}

function buildGeneratedFrom(job: JobRecord | null, candidate: RecruiterCandidateRecord | null, sourceMode: QuestionSourceMode) {
  if (!job) {
    return '由招聘方生成。'
  }

  const resumeName = candidate?.selectedResume?.fileName || candidate?.availableResumes[0]?.fileName || '候选人简历'
  return sourceMode === 'manual'
    ? `由招聘方结合 ${job.title} 岗位要求和 ${resumeName} 手动编辑题目。`
    : `由系统结合 ${job.title} 岗位要求与候选人简历自动生成题目和参考答案，并允许招聘方二次润色。`
}

export function RecruiterAIScreeningPanel() {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [candidates, setCandidates] = useState<RecruiterCandidateRecord[]>([])
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [sourceMode, setSourceMode] = useState<QuestionSourceMode>('ai')
  const [draftQuestions, setDraftQuestions] = useState<AssessmentQuestion[]>(emptyQuestionSet())
  const [titleDraft, setTitleDraft] = useState('')
  const [generatedFromDraft, setGeneratedFromDraft] = useState('')
  const [draftOrigin, setDraftOrigin] = useState<DraftOrigin>(null)
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [runningScreening, setRunningScreening] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  )

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.application.id === selectedApplicationId) ?? candidates[0] ?? null,
    [candidates, selectedApplicationId]
  )

  const activeResume = useMemo(
    () => selectedCandidate?.selectedResume ?? selectedCandidate?.availableResumes[0] ?? null,
    [selectedCandidate]
  )

  useEffect(() => {
    void loadJobs()
  }, [])

  useEffect(() => {
    if (!selectedJobId) {
      setCandidates([])
      setSelectedApplicationId('')
      return
    }

    void loadCandidates(selectedJobId)
  }, [selectedJobId])

  useEffect(() => {
    setError('')
    setMessage('')
  }, [selectedJobId, selectedApplicationId, sourceMode])

  useEffect(() => {
    if (!selectedCandidate) {
      setDraftQuestions(emptyQuestionSet())
      setTitleDraft(buildTitle(selectedJob, null, sourceMode))
      setGeneratedFromDraft(buildGeneratedFrom(selectedJob, null, sourceMode))
      setDraftOrigin(sourceMode === 'manual' ? 'manual' : null)
      return
    }

    const existingAiDraft =
      sourceMode === 'ai' && selectedCandidate.screening?.source === 'openai'
        ? normalizeFromScreening(selectedCandidate.screening)
        : null

    const seededQuestions =
      sourceMode === 'ai' ? existingAiDraft ?? emptyQuestionSet() : emptyQuestionSet()

    setDraftQuestions(seededQuestions)
    setTitleDraft(buildTitle(selectedJob, selectedCandidate, sourceMode))
    setGeneratedFromDraft(buildGeneratedFrom(selectedJob, selectedCandidate, sourceMode))
    setDraftOrigin(sourceMode === 'ai' ? selectedCandidate.screening?.source ?? null : 'manual')
  }, [selectedCandidate, selectedJob, sourceMode])

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
      setSelectedApplicationId((current) =>
        payload.some((candidate) => candidate.application.id === current) ? current : payload[0]?.application.id || ''
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '候选人加载失败。')
    } finally {
      setLoadingCandidates(false)
    }
  }

  function updateQuestion(index: number, updater: (question: AssessmentQuestion) => AssessmentQuestion) {
    setDraftQuestions((current) => current.map((question, currentIndex) => (currentIndex === index ? updater(question) : question)))
  }

  async function generateAiDraft() {
    if (!selectedCandidate) {
      setError('请先选择一个候选人。')
      return
    }

    const resumeId = activeResume?.id
    if (!resumeId) {
      setError('当前候选人还没有可用简历，无法生成 AI 初筛。')
      return
    }

    try {
      setRunningScreening(true)
      setError('')
      setMessage('')

      const response = await fetch('/api/recruiter/screenings', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          applicationId: selectedCandidate.application.id,
          resumeId,
          requireAi: true,
        }),
      })
      const payload = (await response.json()) as RecruiterScreeningRecord | { error?: string }

      if (!response.ok || !('id' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : 'AI 初筛生成失败。')
      }

      setDraftQuestions(payload.questions.map((question) => ({ ...question })))
      setTitleDraft(`AI 初筛面试题 - ${payload.jobTitle} - ${payload.candidateName || '候选人'}`)
      setGeneratedFromDraft(payload.generatedFrom)
      setDraftOrigin(payload.source)
      await loadCandidates(selectedJobId)
      setMessage('AI 初筛结果和题目草稿已生成，你可以继续编辑后发送给候选人。')
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'AI 初筛生成失败。')
    } finally {
      setRunningScreening(false)
    }
  }

  async function sendAssessment() {
    if (!selectedCandidate) {
      setError('请先选择一个候选人。')
      return
    }

    if (sourceMode === 'ai' && draftOrigin !== 'openai') {
      setError('请先点击“生成 AI 题目草稿”，确认题目和参考答案都由 AI 生成后再发送。')
      return
    }

    const resumeId = activeResume?.id
    if (!resumeId) {
      setError('当前候选人还没有可用简历。')
      return
    }

    const preparedQuestions = draftQuestions
      .map((question) => ({
        ...question,
        prompt: question.prompt.trim(),
        idealAnswer: question.idealAnswer.trim(),
        expectedPoints: question.expectedPoints.map((item) => item.trim()).filter(Boolean),
      }))
      .filter((question) => question.prompt && question.idealAnswer && question.expectedPoints.length > 0)

    if (preparedQuestions.length < 3) {
      setError('至少准备 3 道完整题目后才能发送。')
      return
    }

    try {
      setSending(true)
      setError('')
      setMessage('')

      const response = await fetch('/api/assessments', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          mode: 'interview',
          applicationId: selectedCandidate.application.id,
          resumeId,
          title: titleDraft.trim() || buildTitle(selectedJob, selectedCandidate, sourceMode),
          generatedFrom: generatedFromDraft.trim() || buildGeneratedFrom(selectedJob, selectedCandidate, sourceMode),
          questions: preparedQuestions,
          requireAi: sourceMode === 'ai',
        }),
      })
      const payload = (await response.json()) as AssessmentRecord | { error?: string }

      if (!response.ok || !('id' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : '题目发送失败。')
      }

      await loadCandidates(selectedJobId)
      setMessage('题目已发送给当前候选人。候选人作答并提交后，系统会自动评分并同步回招聘方。')
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '题目发送失败。')
    } finally {
      setSending(false)
    }
  }

  if (loadingJobs) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">正在加载 AI 初筛页...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#eef8ff)] p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700">
            <Sparkles className="h-4 w-4" />
            <span>AI 初筛与发题</span>
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">先选候选人，再决定是 AI 出题还是招聘方手动出题。</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            这里支持切换候选人、生成 AI 初筛结果、编辑题目、发送给求职者并等待系统自动评分回传。
          </p>
        </div>
        <button onClick={() => selectedJobId && void loadCandidates(selectedJobId)} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          <span>刷新数据</span>
        </button>
      </div>

      <div className="card">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <label className="block">
            <p className="mb-2 text-sm font-medium text-slate-900">选择岗位</p>
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

          <label className="block">
            <p className="mb-2 text-sm font-medium text-slate-900">选择候选人</p>
            <select
              value={selectedCandidate?.application.id ?? ''}
              onChange={(event) => setSelectedApplicationId(event.target.value)}
              className="input-field"
              disabled={loadingCandidates || candidates.length === 0}
            >
              {candidates.length === 0 && <option value="">当前岗位暂无候选人</option>}
              {candidates.map((candidate) => (
                <option key={candidate.application.id} value={candidate.application.id}>
                  {candidate.application.userName} · {(candidate.selectedResume ?? candidate.availableResumes[0])?.score ?? 0} 分
                </option>
              ))}
            </select>
          </label>
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
          <span className="text-sm text-slate-500">正在加载候选人数据...</span>
        </div>
      ) : !selectedCandidate ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
          当前岗位还没有投递候选人，暂时无法发题。
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                    <FileSearch className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{selectedCandidate.application.userName}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedCandidate.application.userEmail}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">当前简历</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{activeResume?.fileName || '未关联'}</p>
                    <p className="mt-1 text-xs text-slate-500">简历评分 {activeResume?.score ?? 0} 分</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">岗位</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{selectedJob?.title || '未选择岗位'}</p>
                    <p className="mt-1 text-xs text-slate-500">{selectedJob?.company || ''}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {activeResume?.summary || '当前简历还没有摘要。'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(activeResume?.profile.skills ?? []).slice(0, 8).map((skill) => (
                    <TechnicalTag key={skill} text={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600" />
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">AI 初筛结果</h3>
                    <p className="mt-1 text-sm text-slate-500">可先跑 AI 初筛，再把生成的题目继续编辑后发送。</p>
                  </div>
                  <button onClick={() => void generateAiDraft()} className="btn-secondary flex items-center gap-2" disabled={runningScreening}>
                    {runningScreening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    <span>{runningScreening ? '生成中...' : '生成 AI 题目草稿'}</span>
                  </button>
                </div>
                {sourceMode === 'ai' && draftOrigin !== 'openai' && (
                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                    当前还没有 AI 题目草稿。请先生成一次，系统会同时产出题目和参考答案。
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-900">初筛结论</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {selectedCandidate.screening?.summary || '还没有生成 AI 初筛结果。'}
                    </p>
                  </div>

                  {selectedCandidate.screening && (
                    <details className="rounded-2xl bg-slate-50 p-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
                        展开查看分数、风险和追问点
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </summary>
                      <div className="mt-4 space-y-4 text-sm text-slate-600">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-xs text-slate-500">综合得分</p>
                            <p className="mt-2 text-xl font-semibold text-slate-900">{selectedCandidate.screening.overallScore}</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-xs text-slate-500">结论</p>
                            <p className="mt-2 text-xl font-semibold text-slate-900">
                              {recommendationLabel(selectedCandidate.screening.recommendation)}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="font-medium text-slate-900">重点追问</p>
                          <ul className="mt-2 space-y-2">
                            {selectedCandidate.screening.interviewFocus.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <p className="font-medium text-slate-900">风险项</p>
                          <ul className="mt-2 space-y-2">
                            {selectedCandidate.screening.risks.length === 0 ? (
                              <li>当前未发现明显风险项。</li>
                            ) : (
                              selectedCandidate.screening.risks.map((item) => <li key={item}>- {item}</li>)
                            )}
                          </ul>
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-slate-900">最近一次候选人测评状态</h3>
                <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  {selectedCandidate.latestAssessment ? (
                    selectedCandidate.latestAssessment.status === 'scored' ? (
                      <>
                        <p className="font-medium text-slate-900">
                          {selectedCandidate.latestAssessment.summary.overallScore ?? '待评分'} 分 ·{' '}
                          {recommendationLabel(selectedCandidate.latestAssessment.summary.recommendation)}
                        </p>
                        <p className="mt-2 leading-7">{selectedCandidate.latestAssessment.summary.summary}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-slate-900">
                          当前状态：{assessmentStatusLabel(selectedCandidate.latestAssessment.status)}
                        </p>
                        <p className="mt-2 leading-7">
                          {selectedCandidate.latestAssessment.status === 'draft'
                            ? '题目已经发送给候选人，正在等待候选人开始作答。'
                            : selectedCandidate.latestAssessment.status === 'in_progress'
                              ? '候选人正在作答，提交后系统会自动评分并回传给招聘方。'
                              : '候选人已经提交答案，系统正在完成评分，请稍后刷新查看。'}
                        </p>
                      </>
                    )
                  ) : (
                    <p>当前候选人还没有返回作答结果。</p>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">发题设置</h3>
                  <p className="mt-1 text-sm text-slate-500">可以直接使用 AI 草稿，也可以完全手动编辑题目。</p>
                </div>
                <div className="flex rounded-2xl bg-slate-100 p-1">
                  <button
                    onClick={() => setSourceMode('ai')}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium ${sourceMode === 'ai' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600'}`}
                  >
                    AI 出题
                  </button>
                  <button
                    onClick={() => setSourceMode('manual')}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium ${sourceMode === 'manual' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600'}`}
                  >
                    手动出题
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <p className="mb-2 text-sm font-medium text-slate-900">题目标题</p>
                  <input value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} className="input-field" />
                </label>
                <label className="block">
                  <p className="mb-2 text-sm font-medium text-slate-900">题目说明</p>
                  <input value={generatedFromDraft} onChange={(event) => setGeneratedFromDraft(event.target.value)} className="input-field" />
                </label>
              </div>

              <div className="mt-5 space-y-4">
                {draftQuestions.map((question, index) => (
                  <div key={question.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block md:col-span-2">
                        <p className="mb-2 text-sm font-medium text-slate-900">第 {index + 1} 题</p>
                        <textarea
                          value={question.prompt}
                          onChange={(event) =>
                            updateQuestion(index, (current) => ({
                              ...current,
                              prompt: event.target.value,
                            }))
                          }
                          rows={3}
                          className="input-field"
                          placeholder="请输入题目内容"
                        />
                      </label>

                      <label className="block">
                        <p className="mb-2 text-sm font-medium text-slate-900">考察维度</p>
                        <select
                          value={question.category}
                          onChange={(event) =>
                            updateQuestion(index, (current) => ({
                              ...current,
                              category: event.target.value as AssessmentQuestionCategory,
                            }))
                          }
                          className="input-field"
                        >
                          <option value="technical">{categoryLabel('technical')}</option>
                          <option value="problem_solving">{categoryLabel('problem_solving')}</option>
                          <option value="behavioral">{categoryLabel('behavioral')}</option>
                          <option value="communication">{categoryLabel('communication')}</option>
                          <option value="role_fit">{categoryLabel('role_fit')}</option>
                        </select>
                      </label>

                      <label className="block">
                        <p className="mb-2 text-sm font-medium text-slate-900">难度</p>
                        <select
                          value={question.difficulty}
                          onChange={(event) =>
                            updateQuestion(index, (current) => ({
                              ...current,
                              difficulty: event.target.value as AssessmentQuestion['difficulty'],
                            }))
                          }
                          className="input-field"
                        >
                          <option value="easy">简单</option>
                          <option value="medium">中等</option>
                          <option value="hard">困难</option>
                        </select>
                      </label>

                      <label className="block">
                        <p className="mb-2 text-sm font-medium text-slate-900">期待候选人回答到的要点</p>
                        <textarea
                          value={question.expectedPoints.join('，')}
                          onChange={(event) =>
                            updateQuestion(index, (current) => ({
                              ...current,
                              expectedPoints: splitPoints(event.target.value),
                            }))
                          }
                          rows={3}
                          className="input-field"
                          placeholder="例如：问题拆解，技术取舍，量化结果"
                        />
                      </label>

                      <label className="block">
                        <p className="mb-2 text-sm font-medium text-slate-900">理想回答标准</p>
                        <textarea
                          value={question.idealAnswer}
                          onChange={(event) =>
                            updateQuestion(index, (current) => ({
                              ...current,
                              idealAnswer: event.target.value,
                            }))
                          }
                          rows={3}
                          className="input-field"
                          placeholder="系统评分时会参考这一段"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {sourceMode === 'ai' && (
                  <button onClick={() => void generateAiDraft()} className="btn-secondary flex items-center gap-2" disabled={runningScreening}>
                    {runningScreening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    <span>{runningScreening ? '生成中...' : '重新生成 AI 草稿'}</span>
                  </button>
                )}
                <button onClick={() => void sendAssessment()} className="btn-primary flex items-center gap-2" disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>{sending ? '发送中...' : '发送给当前候选人'}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
