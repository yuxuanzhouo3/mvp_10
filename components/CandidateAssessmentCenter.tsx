'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, Loader2, PlayCircle, Save, Send, Sparkles } from 'lucide-react'

import { getStoredAuthToken } from './AuthProvider'
import type { ApplicationRecord } from '@/types/application'
import type { AssessmentRecord, AssessmentRecommendation } from '@/types/assessment'
import type { ResumeListItem } from '@/types/resume'

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

function statusLabel(status: AssessmentRecord['status']) {
  switch (status) {
    case 'draft':
      return '待作答'
    case 'in_progress':
      return '作答中'
    case 'submitted':
      return '已提交'
    case 'scored':
      return '已评分'
    default:
      return status
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

function recommendationLabel(value: AssessmentRecommendation | null) {
  switch (value) {
    case 'strong_yes':
      return '强烈推荐'
    case 'yes':
      return '推荐'
    case 'hold':
      return '待定'
    case 'no':
      return '不推荐'
    default:
      return '待评估'
  }
}

function recommendationTone(value: AssessmentRecommendation | null) {
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

function kindLabel(kind: AssessmentRecord['kind']) {
  return kind === 'practice' ? '岗位自测' : '招聘方发题'
}

function kindTone(kind: AssessmentRecord['kind']) {
  return kind === 'practice' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
}

function syncRecord(records: AssessmentRecord[], next: AssessmentRecord) {
  const index = records.findIndex((item) => item.id === next.id)
  if (index === -1) {
    return [next, ...records]
  }

  const updated = [...records]
  updated[index] = next
  return updated.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

export function CandidateAssessmentCenter() {
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
        throw new Error(!Array.isArray(assessmentPayload) && assessmentPayload.error ? assessmentPayload.error : '测评列表加载失败。')
      }

      if (!applicationResponse.ok || !Array.isArray(applicationPayload)) {
        throw new Error(!Array.isArray(applicationPayload) && applicationPayload.error ? applicationPayload.error : '投递岗位加载失败。')
      }

      if (!resumeResponse.ok || !Array.isArray(resumePayload)) {
        throw new Error(!Array.isArray(resumePayload) && resumePayload.error ? resumePayload.error : '简历列表加载失败。')
      }

      const sortedApplications = [...applicationPayload].sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      )

      setRecords(assessmentPayload)
      setApplications(sortedApplications)
      setResumes(resumePayload)
      setActiveRecordId((current) => current ?? assessmentPayload[0]?.id ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'AI 面试中心加载失败。')
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

  async function createPracticeAssessment() {
    if (!practiceJobId) {
      setError('请先选择一个已投递岗位。')
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
        throw new Error('error' in payload && payload.error ? payload.error : '岗位自测创建失败。')
      }

      setRecords((current) => syncRecord(current, payload))
      setActiveRecordId(payload.id)
      setMessage('岗位自测题目已生成，你可以直接开始模拟作答。')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '岗位自测创建失败。')
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
        throw new Error('error' in payload && payload.error ? payload.error : '草稿保存失败。')
      }

      setRecords((current) => syncRecord(current, payload))
      setMessage('草稿已保存。')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '草稿保存失败。')
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
        throw new Error('error' in payload && payload.error ? payload.error : '提交失败。')
      }

      setRecords((current) => syncRecord(current, payload))
      setMessage(
        activeRecord.kind === 'practice'
          ? '自测已完成评分，你可以在分析页对比自测和招聘方题目的结果。'
          : '已提交，系统已自动复评并同步结果给招聘方。'
      )
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败。')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">正在加载 AI 面试中心...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f7fbff)] p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700">
            <Sparkles className="h-4 w-4" />
            <span>AI 面试中心</span>
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">已投岗位可以先做自测，招聘方发来的题目也会在这里集中处理。</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            题目切换改成横向排布，方便连续作答。提交后系统会自动评分，招聘方发来的题目还会回传给招聘方。
          </p>
        </div>
        <button onClick={() => void loadData()} className="btn-secondary">
          刷新测评
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">题目总数</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">岗位自测</p>
          <p className="mt-2 text-3xl font-semibold text-violet-700">{stats.practice}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">招聘方发题</p>
          <p className="mt-2 text-3xl font-semibold text-sky-700">{stats.recruiterAssigned}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">已完成评分</p>
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
            <h3 className="text-lg font-semibold text-slate-900">岗位自测</h3>
            <p className="mt-1 text-sm text-slate-500">只针对你已经投递过的岗位发起一次模拟 AI 面试，提前找找感觉。</p>
          </div>
          <button onClick={() => void createPracticeAssessment()} className="btn-primary flex items-center gap-2" disabled={creatingPractice || applications.length === 0}>
            {creatingPractice ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            <span>{creatingPractice ? '生成中...' : '开始一次岗位自测'}</span>
          </button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <p className="mb-2 text-sm font-medium text-slate-900">选择已投递岗位</p>
            <select value={practiceJobId} onChange={(event) => setPracticeJobId(event.target.value)} className="input-field">
              {practiceOptions.length === 0 && <option value="">暂无已投递岗位</option>}
              {practiceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <p className="mb-2 text-sm font-medium text-slate-900">选择用于自测的简历</p>
            <select value={practiceResumeId} onChange={(event) => setPracticeResumeId(event.target.value)} className="input-field">
              {resumes.length === 0 && <option value="">暂无简历</option>}
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.fileName} · {resume.score} 分
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">我的题目</h3>

          {records.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
              暂时还没有题目。你可以先发起一次岗位自测。
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
                <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${kindTone(record.kind)}`}>
                  {kindLabel(record.kind)}
                </span>
                <span className={`rounded-full px-2 py-1 text-[11px] ${statusTone(record.status)}`}>
                  {statusLabel(record.status)}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm font-medium text-slate-900">{record.jobTitle || record.title}</p>
              <p className="mt-2 text-xs text-slate-500">
                {record.company || (record.kind === 'practice' ? '我的模拟面试' : '未标注公司')} · {record.questions.length} 道题
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
                    <h3 className="text-2xl font-semibold text-slate-900">{activeRecord.jobTitle || activeRecord.title}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${kindTone(activeRecord.kind)}`}>
                      {kindLabel(activeRecord.kind)}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(activeRecord.status)}`}>
                      {statusLabel(activeRecord.status)}
                    </span>
                    {activeRecord.summary.overallScore !== null && (
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${recommendationTone(activeRecord.summary.recommendation)}`}>
                        {activeRecord.summary.overallScore} 分 / {recommendationLabel(activeRecord.summary.recommendation)}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {activeRecord.kind === 'practice'
                      ? `模拟岗位：${activeRecord.company || '目标公司'}`
                      : `招聘方：${activeRecord.recruiterName || '未标注'}，公司：${activeRecord.company || '未标注'}`}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{activeRecord.summary.summary}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => void saveDraft()} className="btn-secondary flex items-center gap-2" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>{saving ? '保存中...' : '保存草稿'}</span>
                  </button>
                  <button onClick={() => void submitAssessment()} className="btn-primary flex items-center gap-2" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span>{submitting ? '提交中...' : '提交并自动评分'}</span>
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
                          <span className="text-sm font-medium">第 {index + 1} 题</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] ${answered ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {answered ? '已作答' : '未作答'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-medium text-slate-500">当前题目</p>
                <h4 className="mt-2 text-lg font-semibold leading-8 text-slate-900">{activeQuestion.prompt}</h4>
                <textarea
                  rows={10}
                  value={activeAnswer.answer}
                  onChange={(event) => updateAnswer(activeQuestion.id, event.target.value)}
                  className="input-field mt-4"
                  placeholder="在这里直接作答，支持先写草稿再提交。"
                />
              </div>

              <details className="rounded-2xl bg-slate-50 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
                  展开题目要点与反馈
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </summary>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">考察要点</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeQuestion.expectedPoints.map((point) => (
                        <span key={point} className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-900">系统反馈</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {activeAnswer.feedback || '提交评分后，这里会显示每道题的自动反馈。'}
                    </p>
                    {(activeAnswer.strengths.length > 0 || activeAnswer.gaps.length > 0) && (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs text-slate-500">表现较好</p>
                          <p className="mt-2 text-sm text-slate-700">{activeAnswer.strengths.join('、') || '暂无'}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs text-slate-500">仍可补强</p>
                          <p className="mt-2 text-sm text-slate-700">{activeAnswer.gaps.join('、') || '暂无'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-slate-500">还没有待作答的题目。</div>
          )}
        </div>
      </div>
    </div>
  )
}
