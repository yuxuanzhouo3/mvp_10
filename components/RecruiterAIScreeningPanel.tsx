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

import {
  assessmentCategoryLabel,
  assessmentDifficultyLabel,
  assessmentStatusLabel,
  pickLanguage,
  recruiterRecommendationLabel,
} from '@/lib/i18n'
import { getStoredAuthToken } from './AuthProvider'
import { useLanguage } from './LanguageProvider'
import { TechnicalTag } from './TechnicalText'
import type {
  AssessmentQuestion,
  AssessmentQuestionCategory,
  AssessmentRecord,
} from '@/types/assessment'
import type { JobRecord } from '@/types/job'
import type { RecruiterCandidateRecord } from '@/types/recruiter'
import type { RecruiterScreeningRecord } from '@/types/screening'

type QuestionSourceMode = 'ai' | 'manual'
type DraftOrigin = AssessmentRecord['source'] | 'manual' | null

function authHeaders(json = false) {
  const token = getStoredAuthToken()
  if (!token) {
    throw new Error('Please sign in again.')
  }

  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
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

function normalizeFromScreening(record: RecruiterScreeningRecord | null | undefined) {
  return record?.questions.map((question) => ({ ...question })) ?? null
}

export function RecruiterAIScreeningPanel() {
  const { language } = useLanguage()
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

  const copy = {
    jobsFailed: pickLanguage(language, '岗位加载失败。', 'Failed to load jobs.'),
    candidatesFailed: pickLanguage(language, '候选人加载失败。', 'Failed to load candidates.'),
    screeningFailed: pickLanguage(language, 'AI 初筛生成失败。', 'Failed to generate AI screening.'),
    sendFailed: pickLanguage(language, '题目发送失败。', 'Failed to send the assessment.'),
    selectCandidate: pickLanguage(language, '请先选择一个候选人。', 'Choose a candidate first.'),
    noResumeForScreening: pickLanguage(language, '当前候选人还没有可用简历，无法生成 AI 初筛。', 'The selected candidate has no available resume for AI screening.'),
    noResume: pickLanguage(language, '当前候选人还没有可用简历。', 'The selected candidate has no available resume.'),
    requireAiDraft: pickLanguage(language, '请先点击“生成 AI 题目草稿”，确认题目和参考答案都由 AI 生成后再发送。', 'Generate the AI draft first so the questions and reference answers come from AI before sending.'),
    requireThreeQuestions: pickLanguage(language, '至少准备 3 道完整题目后才能发送。', 'Prepare at least 3 complete questions before sending.'),
    loading: pickLanguage(language, '正在加载 AI 初筛页...', 'Loading AI screening...'),
    title: pickLanguage(language, 'AI 初筛与发题', 'AI Screening & Assessments'),
    heading: pickLanguage(
      language,
      '先选候选人，再决定是 AI 出题还是招聘方手动出题。',
      'Pick a candidate first, then choose between AI-generated and manual interview questions.'
    ),
    description: pickLanguage(
      language,
      '这里支持切换候选人、生成 AI 初筛结果、编辑题目、发送给求职者并等待系统自动评分回传。',
      'Switch candidates, generate AI screening results, edit questions, send them out, and wait for automatic scoring and sync.'
    ),
    refresh: pickLanguage(language, '刷新数据', 'Refresh Data'),
    selectJob: pickLanguage(language, '选择岗位', 'Choose Job'),
    selectCandidateLabel: pickLanguage(language, '选择候选人', 'Choose Candidate'),
    noJobs: pickLanguage(language, '暂无岗位', 'No jobs yet'),
    noCandidates: pickLanguage(language, '当前岗位暂无候选人', 'No candidates for this role'),
    loadingCandidates: pickLanguage(language, '正在加载候选人数据...', 'Loading candidate data...'),
    emptyCandidates: pickLanguage(language, '当前岗位还没有投递候选人，暂时无法发题。', 'No candidates have applied to this role yet, so there is nobody to send an assessment to.'),
    currentResume: pickLanguage(language, '当前简历', 'Current Resume'),
    notLinked: pickLanguage(language, '未关联', 'Not linked'),
    resumeScore: pickLanguage(language, '简历评分', 'Resume Score'),
    job: pickLanguage(language, '岗位', 'Job'),
    noJobSelected: pickLanguage(language, '未选择岗位', 'No job selected'),
    noSummary: pickLanguage(language, '当前简历还没有摘要。', 'This resume does not have a summary yet.'),
    screening: pickLanguage(language, 'AI 初筛结果', 'AI Screening Result'),
    screeningHint: pickLanguage(language, '可先跑 AI 初筛，再把生成的题目继续编辑后发送。', 'Run AI screening first, then review and edit the generated questions before sending.'),
    generateDraft: pickLanguage(language, '生成 AI 题目草稿', 'Generate AI Draft'),
    generating: pickLanguage(language, '生成中...', 'Generating...'),
    noDraftYet: pickLanguage(language, '当前还没有 AI 题目草稿。请先生成一次，系统会同时产出题目和参考答案。', 'There is no AI draft yet. Generate one first to receive both questions and reference answers.'),
    summary: pickLanguage(language, '初筛结论', 'Screening Summary'),
    noScreening: pickLanguage(language, '还没有生成 AI 初筛结果。', 'No AI screening summary has been generated yet.'),
    expandScores: pickLanguage(language, '展开查看分数、风险和追问点', 'Expand Scores, Risks, and Follow-up Areas'),
    overallScore: pickLanguage(language, '综合得分', 'Overall Score'),
    recommendation: pickLanguage(language, '结论', 'Recommendation'),
    focus: pickLanguage(language, '重点追问', 'Follow-up Focus'),
    risks: pickLanguage(language, '风险项', 'Risks'),
    noRisks: pickLanguage(language, '当前未发现明显风险项。', 'No obvious risks detected so far.'),
    latestAssessment: pickLanguage(language, '最近一次候选人测评状态', 'Latest Candidate Assessment'),
    pendingScore: pickLanguage(language, '待评分', 'Pending Score'),
    assessmentDraft: pickLanguage(language, '题目已经发送给候选人，正在等待候选人开始作答。', 'Questions were sent and the system is waiting for the candidate to start answering.'),
    assessmentProgress: pickLanguage(language, '候选人正在作答，提交后系统会自动评分并回传给招聘方。', 'The candidate is answering now. The system will score and sync results after submission.'),
    assessmentSubmitted: pickLanguage(language, '候选人已经提交答案，系统正在完成评分，请稍后刷新查看。', 'The candidate submitted answers and the system is finishing scoring. Refresh again shortly.'),
    noAssessment: pickLanguage(language, '当前候选人还没有返回作答结果。', 'This candidate has not returned any answers yet.'),
    settings: pickLanguage(language, '发题设置', 'Assessment Settings'),
    settingsHint: pickLanguage(language, '可以直接使用 AI 草稿，也可以完全手动编辑题目。', 'Use the AI draft directly or switch to fully manual editing.'),
    aiMode: pickLanguage(language, 'AI 出题', 'AI Mode'),
    manualMode: pickLanguage(language, '手动出题', 'Manual Mode'),
    assessmentTitle: pickLanguage(language, '题目标题', 'Assessment Title'),
    assessmentDescription: pickLanguage(language, '题目说明', 'Assessment Description'),
    questionLabel: pickLanguage(language, '第', 'Question'),
    questionPlaceholder: pickLanguage(language, '请输入题目内容', 'Enter the question prompt'),
    category: pickLanguage(language, '考察维度', 'Category'),
    difficulty: pickLanguage(language, '难度', 'Difficulty'),
    expectedPoints: pickLanguage(language, '期待候选人回答到的要点', 'Expected Talking Points'),
    expectedPlaceholder: pickLanguage(language, '例如：问题拆解，技术取舍，量化结果', 'For example: problem breakdown, tradeoff discussion, measurable outcomes'),
    idealAnswer: pickLanguage(language, '理想回答标准', 'Reference Answer'),
    idealPlaceholder: pickLanguage(language, '系统评分时会参考这一段', 'This will be used as a reference during scoring'),
    regenerate: pickLanguage(language, '重新生成 AI 草稿', 'Regenerate AI Draft'),
    send: pickLanguage(language, '发送给当前候选人', 'Send to Candidate'),
    sending: pickLanguage(language, '发送中...', 'Sending...'),
    screeningSuccess: pickLanguage(language, 'AI 初筛结果和题目草稿已生成，你可以继续编辑后发送给候选人。', 'AI screening results and the question draft are ready. Review and send them to the candidate when ready.'),
    sendSuccess: pickLanguage(language, '题目已发送给当前候选人。候选人作答并提交后，系统会自动评分并同步回招聘方。', 'The assessment was sent. Once the candidate submits answers, the system will score them and sync results back here.'),
  }

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  )

  const selectedCandidate = useMemo(
    () =>
      candidates.find((candidate) => candidate.application.id === selectedApplicationId) ??
      candidates[0] ??
      null,
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
      setTitleDraft(
        selectedJob
          ? sourceMode === 'manual'
            ? `Manual Interview - ${selectedJob.title}`
            : `AI Screening Interview - ${selectedJob.title}`
          : 'AI Interview'
      )
      setGeneratedFromDraft(
        selectedJob
          ? sourceMode === 'manual'
            ? `Manually prepared by the recruiter for ${selectedJob.title}.`
            : `AI-generated from the ${selectedJob.title} requirements.`
          : 'Prepared by the recruiter.'
      )
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
    setTitleDraft(
      sourceMode === 'manual'
        ? `Manual Interview - ${selectedJob?.title || 'Job'} - ${selectedCandidate.application.userName}`
        : `AI Screening Interview - ${selectedJob?.title || 'Job'} - ${selectedCandidate.application.userName}`
    )
    setGeneratedFromDraft(
      sourceMode === 'manual'
        ? `Edited by the recruiter using the ${selectedJob?.title || 'selected'} role requirements and the candidate resume.`
        : `Generated by the system from the ${selectedJob?.title || 'selected'} role requirements and the candidate resume, then refined by the recruiter.`
    )
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
        throw new Error(!Array.isArray(payload) && payload.error ? payload.error : copy.jobsFailed)
      }

      setJobs(payload)
      setSelectedJobId((current) => current || payload[0]?.id || '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.jobsFailed)
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
        throw new Error(
          !Array.isArray(payload) && payload.error ? payload.error : copy.candidatesFailed
        )
      }

      setCandidates(payload)
      setSelectedApplicationId((current) =>
        payload.some((candidate) => candidate.application.id === current)
          ? current
          : payload[0]?.application.id || ''
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.candidatesFailed)
    } finally {
      setLoadingCandidates(false)
    }
  }

  function updateQuestion(index: number, updater: (question: AssessmentQuestion) => AssessmentQuestion) {
    setDraftQuestions((current) =>
      current.map((question, currentIndex) => (currentIndex === index ? updater(question) : question))
    )
  }

  async function generateAiDraft() {
    if (!selectedCandidate) {
      setError(copy.selectCandidate)
      return
    }

    const resumeId = activeResume?.id
    if (!resumeId) {
      setError(copy.noResumeForScreening)
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
        throw new Error('error' in payload && payload.error ? payload.error : copy.screeningFailed)
      }

      setDraftQuestions(payload.questions.map((question) => ({ ...question })))
      setTitleDraft(`AI Screening Interview - ${payload.jobTitle} - ${payload.candidateName || 'Candidate'}`)
      setGeneratedFromDraft(payload.generatedFrom)
      setDraftOrigin(payload.source)
      await loadCandidates(selectedJobId)
      setMessage(copy.screeningSuccess)
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : copy.screeningFailed)
    } finally {
      setRunningScreening(false)
    }
  }

  async function sendAssessment() {
    if (!selectedCandidate) {
      setError(copy.selectCandidate)
      return
    }

    if (sourceMode === 'ai' && draftOrigin !== 'openai') {
      setError(copy.requireAiDraft)
      return
    }

    const resumeId = activeResume?.id
    if (!resumeId) {
      setError(copy.noResume)
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
      setError(copy.requireThreeQuestions)
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
          title: titleDraft.trim() || 'AI Interview',
          generatedFrom: generatedFromDraft.trim() || 'Prepared by the recruiter.',
          questions: preparedQuestions,
          requireAi: sourceMode === 'ai',
        }),
      })
      const payload = (await response.json()) as AssessmentRecord | { error?: string }

      if (!response.ok || !('id' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : copy.sendFailed)
      }

      await loadCandidates(selectedJobId)
      setMessage(copy.sendSuccess)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : copy.sendFailed)
    } finally {
      setSending(false)
    }
  }

  if (loadingJobs) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">{copy.loading}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#eef8ff)] p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700">
            <Sparkles className="h-4 w-4" />
            <span>{copy.title}</span>
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">{copy.heading}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">{copy.description}</p>
        </div>
        <button onClick={() => selectedJobId && void loadCandidates(selectedJobId)} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          <span>{copy.refresh}</span>
        </button>
      </div>

      <div className="card">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <label className="block">
            <p className="mb-2 text-sm font-medium text-slate-900">{copy.selectJob}</p>
            <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} className="input-field">
              {jobs.length === 0 && <option value="">{copy.noJobs}</option>}
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} · {job.company}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <p className="mb-2 text-sm font-medium text-slate-900">{copy.selectCandidateLabel}</p>
            <select
              value={selectedCandidate?.application.id ?? ''}
              onChange={(event) => setSelectedApplicationId(event.target.value)}
              className="input-field"
              disabled={loadingCandidates || candidates.length === 0}
            >
              {candidates.length === 0 && <option value="">{copy.noCandidates}</option>}
              {candidates.map((candidate) => (
                <option key={candidate.application.id} value={candidate.application.id}>
                  {candidate.application.userName} · {(candidate.selectedResume ?? candidate.availableResumes[0])?.score ?? 0}
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
          <span className="text-sm text-slate-500">{copy.loadingCandidates}</span>
        </div>
      ) : !selectedCandidate ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
          {copy.emptyCandidates}
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
                    <p className="text-xs text-slate-500">{copy.currentResume}</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{activeResume?.fileName || copy.notLinked}</p>
                    <p className="mt-1 text-xs text-slate-500">{copy.resumeScore} {activeResume?.score ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">{copy.job}</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{selectedJob?.title || copy.noJobSelected}</p>
                    <p className="mt-1 text-xs text-slate-500">{selectedJob?.company || ''}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {activeResume?.summary || copy.noSummary}
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
                    <h3 className="text-lg font-semibold text-slate-900">{copy.screening}</h3>
                    <p className="mt-1 text-sm text-slate-500">{copy.screeningHint}</p>
                  </div>
                  <button onClick={() => void generateAiDraft()} className="btn-secondary flex items-center gap-2" disabled={runningScreening}>
                    {runningScreening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    <span>{runningScreening ? copy.generating : copy.generateDraft}</span>
                  </button>
                </div>
                {sourceMode === 'ai' && draftOrigin !== 'openai' && (
                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                    {copy.noDraftYet}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-900">{copy.summary}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {selectedCandidate.screening?.summary || copy.noScreening}
                    </p>
                  </div>

                  {selectedCandidate.screening && (
                    <details className="rounded-2xl bg-slate-50 p-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
                        {copy.expandScores}
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </summary>
                      <div className="mt-4 space-y-4 text-sm text-slate-600">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-xs text-slate-500">{copy.overallScore}</p>
                            <p className="mt-2 text-xl font-semibold text-slate-900">{selectedCandidate.screening.overallScore}</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-xs text-slate-500">{copy.recommendation}</p>
                            <p className="mt-2 text-xl font-semibold text-slate-900">
                              {recruiterRecommendationLabel(selectedCandidate.screening.recommendation, language)}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="font-medium text-slate-900">{copy.focus}</p>
                          <ul className="mt-2 space-y-2">
                            {selectedCandidate.screening.interviewFocus.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <p className="font-medium text-slate-900">{copy.risks}</p>
                          <ul className="mt-2 space-y-2">
                            {selectedCandidate.screening.risks.length === 0 ? (
                              <li>{copy.noRisks}</li>
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
                <h3 className="text-lg font-semibold text-slate-900">{copy.latestAssessment}</h3>
                <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  {selectedCandidate.latestAssessment ? (
                    selectedCandidate.latestAssessment.status === 'scored' ? (
                      <>
                        <p className="font-medium text-slate-900">
                          {selectedCandidate.latestAssessment.summary.overallScore ?? copy.pendingScore} ·{' '}
                          {recruiterRecommendationLabel(
                            selectedCandidate.latestAssessment.summary.recommendation,
                            language
                          )}
                        </p>
                        <p className="mt-2 leading-7">{selectedCandidate.latestAssessment.summary.summary}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-slate-900">
                          {assessmentStatusLabel(selectedCandidate.latestAssessment.status, language)}
                        </p>
                        <p className="mt-2 leading-7">
                          {selectedCandidate.latestAssessment.status === 'draft'
                            ? copy.assessmentDraft
                            : selectedCandidate.latestAssessment.status === 'in_progress'
                              ? copy.assessmentProgress
                              : copy.assessmentSubmitted}
                        </p>
                      </>
                    )
                  ) : (
                    <p>{copy.noAssessment}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{copy.settings}</h3>
                  <p className="mt-1 text-sm text-slate-500">{copy.settingsHint}</p>
                </div>
                <div className="flex rounded-2xl bg-slate-100 p-1">
                  <button
                    onClick={() => setSourceMode('ai')}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                      sourceMode === 'ai' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {copy.aiMode}
                  </button>
                  <button
                    onClick={() => setSourceMode('manual')}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                      sourceMode === 'manual' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {copy.manualMode}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <p className="mb-2 text-sm font-medium text-slate-900">{copy.assessmentTitle}</p>
                  <input value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} className="input-field" />
                </label>
                <label className="block">
                  <p className="mb-2 text-sm font-medium text-slate-900">{copy.assessmentDescription}</p>
                  <input value={generatedFromDraft} onChange={(event) => setGeneratedFromDraft(event.target.value)} className="input-field" />
                </label>
              </div>

              <div className="mt-5 space-y-4">
                {draftQuestions.map((question, index) => (
                  <div key={question.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block md:col-span-2">
                        <p className="mb-2 text-sm font-medium text-slate-900">
                          {language === 'en' ? `${copy.questionLabel} ${index + 1}` : `${copy.questionLabel} ${index + 1} 题`}
                        </p>
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
                          placeholder={copy.questionPlaceholder}
                        />
                      </label>

                      <label className="block">
                        <p className="mb-2 text-sm font-medium text-slate-900">{copy.category}</p>
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
                          <option value="technical">{assessmentCategoryLabel('technical', language)}</option>
                          <option value="problem_solving">{assessmentCategoryLabel('problem_solving', language)}</option>
                          <option value="behavioral">{assessmentCategoryLabel('behavioral', language)}</option>
                          <option value="communication">{assessmentCategoryLabel('communication', language)}</option>
                          <option value="role_fit">{assessmentCategoryLabel('role_fit', language)}</option>
                        </select>
                      </label>

                      <label className="block">
                        <p className="mb-2 text-sm font-medium text-slate-900">{copy.difficulty}</p>
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
                          <option value="easy">{assessmentDifficultyLabel('easy', language)}</option>
                          <option value="medium">{assessmentDifficultyLabel('medium', language)}</option>
                          <option value="hard">{assessmentDifficultyLabel('hard', language)}</option>
                        </select>
                      </label>

                      <label className="block">
                        <p className="mb-2 text-sm font-medium text-slate-900">{copy.expectedPoints}</p>
                        <textarea
                          value={question.expectedPoints.join(language === 'en' ? ', ' : '，')}
                          onChange={(event) =>
                            updateQuestion(index, (current) => ({
                              ...current,
                              expectedPoints: splitPoints(event.target.value),
                            }))
                          }
                          rows={3}
                          className="input-field"
                          placeholder={copy.expectedPlaceholder}
                        />
                      </label>

                      <label className="block">
                        <p className="mb-2 text-sm font-medium text-slate-900">{copy.idealAnswer}</p>
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
                          placeholder={copy.idealPlaceholder}
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
                    <span>{runningScreening ? copy.generating : copy.regenerate}</span>
                  </button>
                )}
                <button onClick={() => void sendAssessment()} className="btn-primary flex items-center gap-2" disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>{sending ? copy.sending : copy.send}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
