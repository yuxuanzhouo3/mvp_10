'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Loader2,
  PlayCircle,
  Save,
  Send,
  Sparkles,
} from 'lucide-react'

import {
  assessmentKindLabel,
  assessmentRecommendationLabel,
  assessmentStatusLabel,
  pickLanguage,
} from '@/lib/i18n'
import { getStoredAuthToken } from './AuthProvider'
import { useLanguage } from './LanguageProvider'
import type { ApplicationRecord } from '@/types/application'
import type { AssessmentRecord } from '@/types/assessment'
import type { ResumeListItem } from '@/types/resume'

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

function statusTone(status: AssessmentRecord['status']) {
  switch (status) {
    case 'in_progress':
      return 'bg-amber-100 text-amber-700'
    case 'submitted':
      return 'bg-sky-100 text-sky-700'
    case 'scored':
      return 'bg-emerald-100 text-emerald-700'
    case 'draft':
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function recommendationTone(value: AssessmentRecord['summary']['recommendation']) {
  switch (value) {
    case 'strong_yes':
      return 'bg-emerald-100 text-emerald-700'
    case 'yes':
      return 'bg-blue-100 text-blue-700'
    case 'hold':
      return 'bg-amber-100 text-amber-700'
    case 'no':
      return 'bg-rose-100 text-rose-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function syncRecord(records: AssessmentRecord[], next: AssessmentRecord) {
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

export function CandidateAssessmentCenter() {
  const { language } = useLanguage()
  const [records, setRecords] = useState<AssessmentRecord[]>([])
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingPractice, setCreatingPractice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)
  const [practiceJobId, setPracticeJobId] = useState('')
  const [practiceResumeId, setPracticeResumeId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const copy = {
    loadFailed: pickLanguage(language, 'AI 面试中心加载失败。', 'Failed to load the AI interview center.'),
    assessmentsFailed: pickLanguage(language, '测评列表加载失败。', 'Failed to load assessments.'),
    applicationsFailed: pickLanguage(language, '投递岗位加载失败。', 'Failed to load applications.'),
    resumesFailed: pickLanguage(language, '简历列表加载失败。', 'Failed to load resumes.'),
    selectJob: pickLanguage(language, '请先选择一个已投递岗位。', 'Select an applied role first.'),
    createPracticeFailed: pickLanguage(language, '岗位自测创建失败。', 'Failed to create the practice interview.'),
    createPracticeSuccess: pickLanguage(
      language,
      '岗位自测题目已生成，你可以直接开始模拟作答。',
      'Practice interview questions are ready. You can start answering now.'
    ),
    saveDraftFailed: pickLanguage(language, '草稿保存失败。', 'Failed to save the draft.'),
    saveDraftSuccess: pickLanguage(language, '草稿已保存。', 'Draft saved.'),
    submitFailed: pickLanguage(language, '提交失败。', 'Failed to submit.'),
    submitPracticeSuccess: pickLanguage(
      language,
      '自测已完成评分，你可以在分析页对比自测和招聘方题目的结果。',
      'Practice scoring is complete. You can compare it with recruiter-assigned assessments in Analytics.'
    ),
    submitAssignedSuccess: pickLanguage(
      language,
      '已提交，系统已自动复评并同步结果给招聘方。',
      'Submitted. The system will finish scoring and sync the result back to the recruiter.'
    ),
    loading: pickLanguage(language, '正在加载 AI 面试中心...', 'Loading the AI interview center...'),
    title: pickLanguage(language, 'AI 面试中心', 'AI Interview Center'),
    heading: pickLanguage(
      language,
      '已投岗位可以先做自测，招聘方发来的题目也会在这里集中处理。',
      'Practice for applied roles here, and complete recruiter-assigned interviews in the same place.'
    ),
    description: pickLanguage(
      language,
      '题目切换改成横向排布，方便连续作答。提交后系统会自动评分，招聘方发来的题目还会回传给招聘方。',
      'Questions are laid out horizontally for easier answering. After submission, the system scores automatically and recruiter-assigned results are synced back.'
    ),
    refresh: pickLanguage(language, '刷新测评', 'Refresh Assessments'),
    total: pickLanguage(language, '题目总数', 'Total Assessments'),
    practice: pickLanguage(language, '岗位自测', 'Practice'),
    assigned: pickLanguage(language, '招聘方发题', 'Assigned'),
    completed: pickLanguage(language, '已完成评分', 'Scored'),
    practiceTitle: pickLanguage(language, '岗位自测', 'Practice Interview'),
    practiceDescription: pickLanguage(
      language,
      '只针对你已经投递过的岗位发起一次模拟 AI 面试，提前找找感觉。',
      'Launch a mock AI interview for a role you already applied to and warm up before the real one.'
    ),
    startPractice: pickLanguage(language, '开始一次岗位自测', 'Start Practice Interview'),
    generating: pickLanguage(language, '生成中...', 'Generating...'),
    selectAppliedJob: pickLanguage(language, '选择已投递岗位', 'Choose Applied Role'),
    noAppliedJobs: pickLanguage(language, '暂无已投递岗位', 'No applied roles yet'),
    selectResume: pickLanguage(language, '选择用于自测的简历', 'Choose Resume for Practice'),
    noResume: pickLanguage(language, '暂无简历', 'No resumes'),
    myAssessments: pickLanguage(language, '我的题目', 'My Assessments'),
    emptyAssessments: pickLanguage(
      language,
      '暂时还没有题目。你可以先发起一次岗位自测。',
      'No assessments yet. Start with a practice interview.'
    ),
    mockInterview: pickLanguage(language, '我的模拟面试', 'My Mock Interview'),
    unnamedCompany: pickLanguage(language, '未标注公司', 'Unspecified Company'),
    questions: pickLanguage(language, '道题', 'questions'),
    practiceFor: pickLanguage(language, '模拟岗位', 'Practice Role'),
    recruiterFrom: pickLanguage(language, '招聘方', 'Recruiter'),
    company: pickLanguage(language, '公司', 'Company'),
    saveDraft: pickLanguage(language, '保存草稿', 'Save Draft'),
    saving: pickLanguage(language, '保存中...', 'Saving...'),
    submit: pickLanguage(language, '提交并自动评分', 'Submit & Score'),
    submitting: pickLanguage(language, '提交中...', 'Submitting...'),
    questionLabel: pickLanguage(language, '第', 'Q'),
    answered: pickLanguage(language, '已作答', 'Answered'),
    unanswered: pickLanguage(language, '未作答', 'Pending'),
    currentQuestion: pickLanguage(language, '当前题目', 'Current Question'),
    nextQuestion: pickLanguage(language, '下一题', 'Next'),
    finalQuestion: pickLanguage(language, '已经是最后一题', 'Last Question'),
    answerPlaceholder: pickLanguage(
      language,
      '在这里直接作答，支持先写草稿再提交。',
      'Write your answer here. You can save a draft before submitting.'
    ),
    expandFeedback: pickLanguage(language, '展开题目要点与反馈', 'Expand Rubric & Feedback'),
    expectedPoints: pickLanguage(language, '考察要点', 'Expected Points'),
    feedback: pickLanguage(language, '系统反馈', 'System Feedback'),
    feedbackPlaceholder: pickLanguage(
      language,
      '提交评分后，这里会显示每道题的自动反馈。',
      'Automatic feedback for each question will appear here after scoring.'
    ),
    strengths: pickLanguage(language, '表现较好', 'What Went Well'),
    gaps: pickLanguage(language, '仍可补强', 'Needs Improvement'),
    none: pickLanguage(language, '暂无', 'None'),
    noActiveRecord: pickLanguage(language, '还没有待作答的题目。', 'No assessment is waiting for your answer.'),
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    setActiveQuestionIndex(0)
  }, [activeRecordId])

  useEffect(() => {
    if (applications.length === 0) {
      setPracticeJobId('')
      return
    }

    setPracticeJobId((current) => current || applications[0]?.jobId || '')
  }, [applications])

  useEffect(() => {
    if (!practiceJobId) {
      setPracticeResumeId('')
      return
    }

    const matchedApplication = applications.find((item) => item.jobId === practiceJobId)
    const fallbackResumeId = matchedApplication?.resumeId || resumes[0]?.id || ''
    setPracticeResumeId((current) =>
      resumes.some((resume) => resume.id === current) && current ? current : fallbackResumeId
    )
  }, [applications, practiceJobId, resumes])

  async function loadData() {
    try {
      setLoading(true)
      setError('')

      const [assessmentResponse, applicationResponse, resumeResponse] = await Promise.all([
        fetch('/api/assessments', {
          cache: 'no-store',
          headers: getAuthorizedHeaders(),
        }),
        fetch('/api/applications?scope=me', {
          cache: 'no-store',
          headers: getAuthorizedHeaders(),
        }),
        fetch('/api/resumes?scope=me', {
          cache: 'no-store',
          headers: getAuthorizedHeaders(),
        }),
      ])

      const assessmentPayload = (await assessmentResponse.json()) as AssessmentRecord[] | { error?: string }
      const applicationPayload = (await applicationResponse.json()) as ApplicationRecord[] | { error?: string }
      const resumePayload = (await resumeResponse.json()) as ResumeListItem[] | { error?: string }

      if (!assessmentResponse.ok || !Array.isArray(assessmentPayload)) {
        throw new Error(
          !Array.isArray(assessmentPayload) && assessmentPayload.error
            ? assessmentPayload.error
            : copy.assessmentsFailed
        )
      }

      if (!applicationResponse.ok || !Array.isArray(applicationPayload)) {
        throw new Error(
          !Array.isArray(applicationPayload) && applicationPayload.error
            ? applicationPayload.error
            : copy.applicationsFailed
        )
      }

      if (!resumeResponse.ok || !Array.isArray(resumePayload)) {
        throw new Error(
          !Array.isArray(resumePayload) && resumePayload.error
            ? resumePayload.error
            : copy.resumesFailed
        )
      }

      const sortedApplications = [...applicationPayload].sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      )

      setRecords(assessmentPayload)
      setApplications(sortedApplications)
      setResumes(resumePayload)
      setActiveRecordId((current) => current ?? assessmentPayload[0]?.id ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed)
    } finally {
      setLoading(false)
    }
  }

  const activeRecord = useMemo(
    () => records.find((item) => item.id === activeRecordId) ?? records[0] ?? null,
    [records, activeRecordId]
  )

  const activeQuestion = activeRecord?.questions[activeQuestionIndex] ?? null
  const activeAnswer =
    activeQuestion && activeRecord
      ? activeRecord.answers.find((answer) => answer.questionId === activeQuestion.id) ?? null
      : null
  const hasNextQuestion = activeRecord ? activeQuestionIndex < activeRecord.questions.length - 1 : false

  const practiceOptions = useMemo(() => {
    return applications.map((application) => ({
      value: application.jobId,
      label: `${application.jobTitle} · ${application.company}`,
      resumeId: application.resumeId,
    }))
  }, [applications])

  const stats = useMemo(() => {
    const practice = records.filter((item) => item.kind === 'practice').length
    const recruiterAssigned = records.filter((item) => item.kind === 'recruiter_assigned').length
    const completed = records.filter((item) => item.status === 'scored').length

    return {
      total: records.length,
      practice,
      recruiterAssigned,
      completed,
    }
  }, [records])

  function updateAnswer(questionId: string, value: string) {
    if (!activeRecord) {
      return
    }

    const nextRecord = {
      ...activeRecord,
      answers: activeRecord.answers.map((answer) =>
        answer.questionId === questionId
          ? {
              ...answer,
              answer: value,
            }
          : answer
      ),
    }

    setRecords((current) => syncRecord(current, nextRecord))
  }

  function goToNextQuestion() {
    if (!activeRecord) {
      return
    }

    setActiveQuestionIndex((current) => Math.min(current + 1, activeRecord.questions.length - 1))
  }

  async function createPracticeAssessment() {
    if (!practiceJobId) {
      setError(copy.selectJob)
      return
    }

    try {
      setCreatingPractice(true)
      setError('')
      setMessage('')

      const response = await fetch('/api/assessments', {
        method: 'POST',
        headers: getAuthorizedHeaders(true),
        body: JSON.stringify({
          mode: 'interview',
          jobId: practiceJobId,
          resumeId: practiceResumeId || null,
        }),
      })

      const payload = (await response.json()) as AssessmentRecord | { error?: string }
      if (!response.ok || !('id' in payload)) {
        throw new Error(
          'error' in payload && payload.error ? payload.error : copy.createPracticeFailed
        )
      }

      setRecords((current) => syncRecord(current, payload))
      setActiveRecordId(payload.id)
      setMessage(copy.createPracticeSuccess)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : copy.createPracticeFailed)
    } finally {
      setCreatingPractice(false)
    }
  }

  async function saveDraft() {
    if (!activeRecord) {
      return
    }

    try {
      setSaving(true)
      setError('')
      setMessage('')

      const response = await fetch(`/api/assessments/${activeRecord.id}`, {
        method: 'PATCH',
        headers: getAuthorizedHeaders(true),
        body: JSON.stringify({
          answers: activeRecord.answers,
          status: activeRecord.answers.some((item) => item.answer.trim()) ? 'in_progress' : 'draft',
        }),
      })

      const payload = (await response.json()) as AssessmentRecord | { error?: string }
      if (!response.ok || !('id' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : copy.saveDraftFailed)
      }

      setRecords((current) => syncRecord(current, payload))
      setMessage(copy.saveDraftSuccess)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveDraftFailed)
    } finally {
      setSaving(false)
    }
  }

  async function submitAssessment() {
    if (!activeRecord) {
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setMessage('')

      const response = await fetch(`/api/assessments/${activeRecord.id}/score`, {
        method: 'POST',
        headers: getAuthorizedHeaders(true),
        body: JSON.stringify({
          answers: activeRecord.answers,
        }),
      })

      const payload = (await response.json()) as AssessmentRecord | { error?: string }
      if (!response.ok || !('id' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : copy.submitFailed)
      }

      setRecords((current) => syncRecord(current, payload))
      setMessage(
        activeRecord.kind === 'practice' ? copy.submitPracticeSuccess : copy.submitAssignedSuccess
      )
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.submitFailed)
    } finally {
      setSubmitting(false)
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
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f7fbff)] p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
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
          <p className="text-sm text-slate-500">{copy.total}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.practice}</p>
          <p className="mt-2 text-3xl font-semibold text-violet-700">{stats.practice}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.assigned}</p>
          <p className="mt-2 text-3xl font-semibold text-sky-700">{stats.recruiterAssigned}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.completed}</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{stats.completed}</p>
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

      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{copy.practiceTitle}</h3>
            <p className="mt-1 text-sm text-slate-500">{copy.practiceDescription}</p>
          </div>
          <button
            onClick={() => void createPracticeAssessment()}
            className="btn-primary flex items-center gap-2"
            disabled={creatingPractice || applications.length === 0}
          >
            {creatingPractice ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            <span>{creatingPractice ? copy.generating : copy.startPractice}</span>
          </button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <p className="mb-2 text-sm font-medium text-slate-900">{copy.selectAppliedJob}</p>
            <select value={practiceJobId} onChange={(event) => setPracticeJobId(event.target.value)} className="input-field">
              {practiceOptions.length === 0 && <option value="">{copy.noAppliedJobs}</option>}
              {practiceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <p className="mb-2 text-sm font-medium text-slate-900">{copy.selectResume}</p>
            <select value={practiceResumeId} onChange={(event) => setPracticeResumeId(event.target.value)} className="input-field">
              {resumes.length === 0 && <option value="">{copy.noResume}</option>}
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.fileName} · {resume.score}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">{copy.myAssessments}</h3>

          {records.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
              {copy.emptyAssessments}
            </div>
          )}

          {records.map((record) => (
            <button
              key={record.id}
              onClick={() => setActiveRecordId(record.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                (activeRecordId ?? records[0]?.id) === record.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${record.kind === 'practice' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>
                  {assessmentKindLabel(record.kind, language)}
                </span>
                <span className={`rounded-full px-2 py-1 text-[11px] ${statusTone(record.status)}`}>
                  {assessmentStatusLabel(record.status, language)}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm font-medium text-slate-900">
                {record.jobTitle || record.title}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {record.company ||
                  (record.kind === 'practice' ? copy.mockInterview : copy.unnamedCompany)}{' '}
                · {record.questions.length} {copy.questions}
              </p>
            </button>
          ))}
        </div>

        <div className="card">
          {activeRecord && activeQuestion && activeAnswer ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-2xl font-semibold text-slate-900">
                      {activeRecord.jobTitle || activeRecord.title}
                    </h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${activeRecord.kind === 'practice' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>
                      {assessmentKindLabel(activeRecord.kind, language)}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(activeRecord.status)}`}>
                      {assessmentStatusLabel(activeRecord.status, language)}
                    </span>
                    {activeRecord.summary.overallScore !== null && (
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${recommendationTone(activeRecord.summary.recommendation)}`}>
                        {activeRecord.summary.overallScore} ·{' '}
                        {assessmentRecommendationLabel(activeRecord.summary.recommendation, language)}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {activeRecord.kind === 'practice'
                      ? `${copy.practiceFor}: ${activeRecord.company || pickLanguage(language, '目标公司', 'Target Company')}`
                      : `${copy.recruiterFrom}: ${activeRecord.recruiterName || pickLanguage(language, '未标注', 'Unknown')} · ${copy.company}: ${activeRecord.company || pickLanguage(language, '未标注', 'Unknown')}`}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{activeRecord.summary.summary}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => void saveDraft()} className="btn-secondary flex items-center gap-2" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>{saving ? copy.saving : copy.saveDraft}</span>
                  </button>
                  <button onClick={() => void submitAssessment()} className="btn-primary flex items-center gap-2" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span>{submitting ? copy.submitting : copy.submit}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="flex min-w-max gap-3">
                  {activeRecord.questions.map((question, index) => {
                    const answer = activeRecord.answers.find((item) => item.questionId === question.id)
                    const answered = Boolean(answer?.answer.trim())

                    return (
                      <button
                        key={question.id}
                        onClick={() => setActiveQuestionIndex(index)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          activeQuestionIndex === index
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {language === 'en' ? `${copy.questionLabel}${index + 1}` : `${copy.questionLabel}${index + 1} 题`}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] ${answered ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {answered ? copy.answered : copy.unanswered}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{copy.currentQuestion}</p>
                    <h4 className="mt-2 text-lg font-semibold leading-8 text-slate-900">
                      {activeQuestion.prompt}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={goToNextQuestion}
                    disabled={!hasNextQuestion}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <span>
                      {hasNextQuestion
                        ? language === 'en'
                          ? `${copy.nextQuestion} · Q${activeQuestionIndex + 2}`
                          : `${copy.nextQuestion} · 第 ${activeQuestionIndex + 2} 题`
                        : copy.finalQuestion}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  rows={10}
                  value={activeAnswer.answer}
                  onChange={(event) => updateAnswer(activeQuestion.id, event.target.value)}
                  className="input-field mt-4"
                  placeholder={copy.answerPlaceholder}
                />
              </div>

              <details className="rounded-2xl bg-slate-50 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
                  {copy.expandFeedback}
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </summary>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{copy.expectedPoints}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeQuestion.expectedPoints.map((point) => (
                        <span key={point} className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-900">{copy.feedback}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {activeAnswer.feedback || copy.feedbackPlaceholder}
                    </p>
                    {(activeAnswer.strengths.length > 0 || activeAnswer.gaps.length > 0) && (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs text-slate-500">{copy.strengths}</p>
                          <p className="mt-2 text-sm text-slate-700">
                            {activeAnswer.strengths.join(language === 'en' ? ', ' : '、') || copy.none}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs text-slate-500">{copy.gaps}</p>
                          <p className="mt-2 text-sm text-slate-700">
                            {activeAnswer.gaps.join(language === 'en' ? ', ' : '、') || copy.none}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-slate-500">{copy.noActiveRecord}</div>
          )}
        </div>
      </div>
    </div>
  )
}
