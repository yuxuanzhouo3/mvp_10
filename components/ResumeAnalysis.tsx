'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  History,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  TrendingUp,
  Upload,
  User,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import type {
  CandidateOutreachStatus,
  CandidateReviewStatus,
  CandidateStage,
  CandidateTask,
  CandidateTaskChannel,
  CandidateTaskKind,
  CandidateTaskStatus,
  CandidateTimelineEvent,
  ResumeContactInfo,
  ResumeInsight,
  ResumeListItem,
  ResumeRecord,
  ResumeWorkflow,
} from '@/types/resume'

const STAGE_OPTIONS: { value: CandidateStage; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
]

const REVIEW_OPTIONS: { value: CandidateReviewStatus; label: string }[] = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'reviewed', label: 'Reviewed' },
]

const OUTREACH_OPTIONS: { value: CandidateOutreachStatus; label: string }[] = [
  { value: 'pending', label: 'Pending Contact' },
  { value: 'ready', label: 'Ready to Contact' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'responded', label: 'Responded' },
]

const TASK_STATUS_OPTIONS: { value: CandidateTaskStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
]

const TASK_CHANNEL_OPTIONS: { value: CandidateTaskChannel; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'wechat', label: 'WeChat' },
  { value: 'feishu', label: 'Feishu' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'assessment', label: 'Assessment' },
]

function toListItem(record: ResumeRecord): ResumeListItem {
  return {
    id: record.id,
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    createdAt: record.createdAt,
    storedFileName: record.storedFileName,
    score: record.score,
    summary: record.summary,
    source: record.source,
    contact: record.contact,
    profile: record.profile,
    skillAnalysis: record.skillAnalysis,
    insights: record.insights,
    composition: record.composition,
    workflow: record.workflow,
    communication: record.communication,
    tasks: record.tasks,
    timeline: record.timeline,
    textPreview: record.extractedText.slice(0, 280).trim(),
  }
}

function getPriorityColor(priority: ResumeInsight['priority']) {
  switch (priority) {
    case 'high':
      return 'text-red-600 bg-red-100'
    case 'medium':
      return 'text-yellow-600 bg-yellow-100'
    case 'low':
      return 'text-green-600 bg-green-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

function getInsightIcon(type: ResumeInsight['type']) {
  switch (type) {
    case 'strength':
      return <CheckCircle className="h-5 w-5 text-green-500" />
    case 'improvement':
      return <TrendingUp className="h-5 w-5 text-blue-500" />
    case 'warning':
      return <AlertCircle className="h-5 w-5 text-yellow-500" />
    default:
      return <FileText className="h-5 w-5 text-gray-500" />
  }
}

function getStageColor(stage: CandidateStage) {
  switch (stage) {
    case 'new':
      return 'bg-slate-100 text-slate-700'
    case 'screening':
      return 'bg-blue-100 text-blue-700'
    case 'interview':
      return 'bg-violet-100 text-violet-700'
    case 'offer':
      return 'bg-amber-100 text-amber-700'
    case 'hired':
      return 'bg-green-100 text-green-700'
    case 'rejected':
      return 'bg-rose-100 text-rose-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function getTaskStatusColor(status: CandidateTaskStatus) {
  switch (status) {
    case 'done':
      return 'bg-green-100 text-green-700'
    case 'in_progress':
      return 'bg-blue-100 text-blue-700'
    case 'blocked':
      return 'bg-red-100 text-red-700'
    case 'todo':
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function getTaskKindLabel(kind: CandidateTaskKind) {
  switch (kind) {
    case 'contact_verification':
      return 'Contact'
    case 'first_outreach':
      return 'Outreach'
    case 'screening_decision':
      return 'Screening'
    case 'interview':
      return 'Interview'
    case 'offer':
      return 'Offer'
    case 'custom':
    default:
      return 'Custom'
  }
}

function getTimelineColor(type: CandidateTimelineEvent['type']) {
  switch (type) {
    case 'resume_uploaded':
      return 'bg-slate-500'
    case 'contact_updated':
      return 'bg-blue-500'
    case 'workflow_updated':
      return 'bg-violet-500'
    case 'receipt_sent':
      return 'bg-green-500'
    case 'receipt_failed':
      return 'bg-red-500'
    case 'interview_invite_sent':
      return 'bg-violet-500'
    case 'interview_invite_failed':
      return 'bg-rose-500'
    case 'task_created':
      return 'bg-sky-500'
    case 'task_updated':
      return 'bg-amber-500'
    case 'note_added':
      return 'bg-indigo-500'
    default:
      return 'bg-gray-400'
  }
}

function getDeliveryStatusColor(status: 'not_sent' | 'preview' | 'sent' | 'failed') {
  switch (status) {
    case 'sent':
      return 'bg-green-100 text-green-700'
    case 'preview':
      return 'bg-blue-100 text-blue-700'
    case 'failed':
      return 'bg-red-100 text-red-700'
    case 'not_sent':
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function toDateTimeInputValue(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60000)
  return localDate.toISOString().slice(0, 16)
}

function fromDateTimeInputValue(value: string) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function buildEmptyTask(): CandidateTask {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    kind: 'custom',
    title: '',
    description: null,
    status: 'todo',
    channel: 'manual',
    owner: null,
    dueAt: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }
}

export function ResumeAnalysis() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [activeResume, setActiveResume] = useState<ResumeRecord | null>(null)
  const [recentResumes, setRecentResumes] = useState<ResumeListItem[]>([])
  const [contactDraft, setContactDraft] = useState<ResumeContactInfo | null>(null)
  const [workflowDraft, setWorkflowDraft] = useState<ResumeWorkflow | null>(null)
  const [taskDraft, setTaskDraft] = useState<CandidateTask[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [savingWorkflow, setSavingWorkflow] = useState(false)
  const [savingTasks, setSavingTasks] = useState(false)
  const [sendingReceipt, setSendingReceipt] = useState(false)
  const [sendingInterviewInvite, setSendingInterviewInvite] = useState(false)
  const [receiptFeedback, setReceiptFeedback] = useState('')
  const [interviewInviteFeedback, setInterviewInviteFeedback] = useState('')
  const [showFullText, setShowFullText] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadRecentResumes()
  }, [])

  useEffect(() => {
    setContactDraft(activeResume?.contact ?? null)
  }, [activeResume])

  useEffect(() => {
    setWorkflowDraft(activeResume?.workflow ?? null)
  }, [activeResume])

  useEffect(() => {
    setTaskDraft(activeResume?.tasks ?? [])
  }, [activeResume])

  useEffect(() => {
    setReceiptFeedback('')
    setInterviewInviteFeedback('')
  }, [activeResume?.id])

  const queueStats = useMemo(() => {
    return {
      total: recentResumes.length,
      readyToContact: recentResumes.filter((item) => item.workflow.outreachStatus === 'ready').length,
      interviewing: recentResumes.filter((item) => item.workflow.stage === 'interview').length,
      offers: recentResumes.filter((item) => item.workflow.stage === 'offer').length,
    }
  }, [recentResumes])

  const taskStats = useMemo(() => {
    const tasks = taskDraft

    return {
      total: tasks.length,
      open: tasks.filter((task) => task.status !== 'done').length,
      done: tasks.filter((task) => task.status === 'done').length,
      blocked: tasks.filter((task) => task.status === 'blocked').length,
    }
  }, [taskDraft])

  const timeline = useMemo(() => {
    return [...(activeResume?.timeline ?? [])].sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    })
  }, [activeResume])

  function applyRecordUpdate(record: ResumeRecord) {
    setShowFullText(false)
    setReceiptFeedback('')
    setInterviewInviteFeedback('')
    setActiveResume(record)
    setRecentResumes((current) => {
      const next = [toListItem(record), ...current.filter((item) => item.id !== record.id)]
      return next.slice(0, 12)
    })
  }

  async function loadRecentResumes(preferredId?: string) {
    try {
      setLoadingHistory(true)
      const response = await fetch('/api/resumes', { cache: 'no-store' })
      const data = (await response.json()) as ResumeListItem[]

      if (!response.ok) {
        throw new Error('Failed to load resume history.')
      }

      setRecentResumes(data)

      const targetId = preferredId ?? activeResume?.id ?? data[0]?.id
      if (targetId && targetId !== activeResume?.id) {
        await loadResumeDetail(targetId)
      } else if (!targetId) {
        setActiveResume(null)
      }
    } catch (fetchError) {
      console.error(fetchError)
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load resume history.')
    } finally {
      setLoadingHistory(false)
    }
  }

  async function loadResumeDetail(id: string) {
    try {
      setLoadingDetail(true)
      setError('')

      const response = await fetch(`/api/resumes/${id}`, { cache: 'no-store' })
      const data = (await response.json()) as ResumeRecord | { error?: string }

      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to load resume detail.')
      }

      setActiveResume(data)
      setShowFullText(false)
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'Failed to load resume detail.')
    } finally {
      setLoadingDetail(false)
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setUploadedFile(file)
    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('resume', file)

      const response = await fetch('/api/resumes', {
        method: 'POST',
        body: formData,
      })

      const data = (await response.json()) as ResumeRecord | { error?: string }

      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Resume upload failed.')
      }

      await loadRecentResumes(data.id)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Resume upload failed.')
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  function handleWorkflowFieldChange<K extends keyof ResumeWorkflow>(field: K, value: ResumeWorkflow[K]) {
    setWorkflowDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        [field]: value,
      }
    })
  }

  function handleContactFieldChange<K extends keyof ResumeContactInfo>(
    field: K,
    value: ResumeContactInfo[K]
  ) {
    setContactDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        [field]: value,
      }
    })
  }

  function handleTaskFieldChange<K extends keyof CandidateTask>(id: string, field: K, value: CandidateTask[K]) {
    setTaskDraft((current) =>
      current.map((task) => {
        if (task.id !== id) {
          return task
        }

        const updatedAt = new Date().toISOString()
        const nextTask = {
          ...task,
          [field]: value,
          updatedAt,
        }

        if (field === 'status') {
          return {
            ...nextTask,
            completedAt: value === 'done' ? task.completedAt ?? updatedAt : null,
          }
        }

        return {
          ...nextTask,
        }
      })
    )
  }

  function addTask() {
    setTaskDraft((current) => [...current, buildEmptyTask()])
  }

  function removeTask(id: string) {
    setTaskDraft((current) => current.filter((task) => task.id !== id))
  }

  async function saveContact() {
    if (!activeResume || !contactDraft) {
      return
    }

    try {
      setSavingContact(true)
      setError('')

      const response = await fetch(`/api/resumes/${activeResume.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contact: contactDraft,
        }),
      })

      const data = (await response.json()) as ResumeRecord | { error?: string }

      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to save contact info.')
      }

      applyRecordUpdate(data)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save contact info.')
    } finally {
      setSavingContact(false)
    }
  }

  async function saveWorkflow() {
    if (!activeResume || !workflowDraft) {
      return
    }

    try {
      setSavingWorkflow(true)
      setError('')

      const response = await fetch(`/api/resumes/${activeResume.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stage: workflowDraft.stage,
          reviewStatus: workflowDraft.reviewStatus,
          outreachStatus: workflowDraft.outreachStatus,
          notes: workflowDraft.notes,
          recommendedNextAction: workflowDraft.recommendedNextAction,
        }),
      })

      const data = (await response.json()) as ResumeRecord | { error?: string }

      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to save workflow.')
      }

      applyRecordUpdate(data)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save workflow.')
    } finally {
      setSavingWorkflow(false)
    }
  }

  async function saveTasks() {
    if (!activeResume) {
      return
    }

    try {
      setSavingTasks(true)
      setError('')

      const response = await fetch(`/api/resumes/${activeResume.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks: taskDraft.filter((task) => task.title.trim().length > 0),
        }),
      })

      const data = (await response.json()) as ResumeRecord | { error?: string }

      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to save task board.')
      }

      applyRecordUpdate(data)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save task board.')
    } finally {
      setSavingTasks(false)
    }
  }

  async function sendReceipt() {
    if (!activeResume || !activeResume.contact.email) {
      return
    }

    try {
      setSendingReceipt(true)
      setError('')
      setReceiptFeedback('')

      const response = await fetch(`/api/resumes/${activeResume.id}/receipt`, {
        method: 'POST',
      })

      const data = (await response.json()) as
        | {
            record?: ResumeRecord | null
            delivery?: {
              mode: 'smtp' | 'preview'
              message: string
              text: string
            }
            error?: string
          }
        | { error?: string }

      if (!response.ok) {
        if (data && typeof data === 'object' && 'record' in data && data.record && 'id' in data.record) {
          applyRecordUpdate(data.record)
        }

        throw new Error('error' in data && data.error ? data.error : 'Failed to send receipt email.')
      }

      if ('record' in data && data.record && 'id' in data.record) {
        applyRecordUpdate(data.record)
      }

      if ('delivery' in data && data.delivery) {
        setReceiptFeedback(
          data.delivery.mode === 'preview'
            ? `${data.delivery.message} Preview: ${data.delivery.text}`
            : data.delivery.message
        )
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send receipt email.')
    } finally {
      setSendingReceipt(false)
    }
  }

  async function sendInterviewInvite() {
    if (!activeResume || !activeResume.contact.email) {
      return
    }

    try {
      setSendingInterviewInvite(true)
      setError('')
      setInterviewInviteFeedback('')

      const response = await fetch(`/api/resumes/${activeResume.id}/interview-invite`, {
        method: 'POST',
      })

      const data = (await response.json()) as
        | {
            record?: ResumeRecord | null
            delivery?: {
              mode: 'smtp' | 'preview'
              message: string
              text: string
            }
            error?: string
          }
        | { error?: string }

      if (!response.ok) {
        if (data && typeof data === 'object' && 'record' in data && data.record && 'id' in data.record) {
          applyRecordUpdate(data.record)
        }

        throw new Error('error' in data && data.error ? data.error : 'Failed to send interview invite.')
      }

      if ('record' in data && data.record && 'id' in data.record) {
        applyRecordUpdate(data.record)
      }

      if ('delivery' in data && data.delivery) {
        setInterviewInviteFeedback(
          data.delivery.mode === 'preview'
            ? `${data.delivery.message} Preview: ${data.delivery.text}`
            : data.delivery.message
        )
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send interview invite.')
    } finally {
      setSendingInterviewInvite(false)
    }
  }

  const score = activeResume?.score ?? 0
  const circumference = 2 * Math.PI * 36
  const scoreOffset = circumference * (1 - score / 100)
  const activeContact = contactDraft
  const activeWorkflow = workflowDraft
  const activeTasks = taskDraft
  const receiptStatus = activeResume?.communication.receiptEmailStatus ?? 'not_sent'
  const interviewInviteStatus = activeResume?.communication.interviewInviteEmailStatus ?? 'not_sent'
  const canSendInterviewInvite =
    activeResume?.workflow.stage === 'new' ||
    activeResume?.workflow.stage === 'screening' ||
    activeResume?.workflow.stage === 'interview'

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Candidate Intake Desk</h1>
          <p className="text-gray-600 mt-2">
            Upload resumes, store candidates, review AI summaries, and move each person through your intake workflow.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            {activeResume?.source === 'openai' ? 'OpenAI analysis' : 'Heuristic analysis'}
          </span>
          <button
            onClick={() => void loadRecentResumes()}
            className="btn-secondary flex items-center space-x-2"
            disabled={loadingHistory}
          >
            <RefreshCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Candidates</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{queueStats.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Ready to Contact</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{queueStats.readyToContact}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Interviewing</p>
          <p className="text-2xl font-bold text-violet-700 mt-1">{queueStats.interviewing}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Offers</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{queueStats.offers}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="text-center">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload candidate resume</h3>
                <p className="text-gray-600 mb-4">
                  Supported formats: PDF, DOCX, TXT, MD. New resumes are stored locally and added to the candidate queue.
                </p>
                <label className="btn-primary cursor-pointer inline-flex items-center space-x-2">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={loading}
                  />
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span>{loading ? 'Uploading and analyzing...' : 'Choose Resume'}</span>
                </label>
                {uploadedFile && (
                  <p className="text-sm text-gray-500 mt-4">
                    Current file: {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          </div>

          {loadingDetail && (
            <div className="card flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400 mr-3" />
              <span className="text-sm text-gray-500">Loading candidate detail...</span>
            </div>
          )}

          {!loadingDetail && activeResume && (
            <div key={activeResume.id} className="space-y-6">
              <div className="card">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {activeResume.contact.name || activeResume.fileName}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{activeResume.fileName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStageColor(activeResume.workflow.stage)}`}>
                      {activeResume.workflow.stage}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {activeResume.workflow.reviewStatus}
                    </span>
                  </div>
                </div>

                {!activeResume.contact.email && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-800">
                      No email was extracted from this resume. You can fill it manually below so the candidate can be contacted later.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">Editable contact info</h4>
                  <button
                    onClick={saveContact}
                    className="btn-secondary flex items-center space-x-2"
                    disabled={!activeContact || savingContact}
                  >
                    {savingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>{savingContact ? 'Saving...' : 'Save Contact'}</span>
                  </button>
                </div>

                {activeContact && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-gray-50">
                      <label className="flex items-center text-sm text-gray-500 mb-2">
                        <User className="h-4 w-4 mr-2" />
                        Name
                      </label>
                      <input
                        type="text"
                        value={activeContact.name ?? ''}
                        onChange={(event) => handleContactFieldChange('name', event.target.value)}
                        className="input-field"
                        placeholder="Candidate name"
                      />
                    </div>
                    <div className="p-4 rounded-lg bg-gray-50">
                      <label className="flex items-center text-sm text-gray-500 mb-2">
                        <Mail className="h-4 w-4 mr-2" />
                        Email
                      </label>
                      <input
                        type="email"
                        value={activeContact.email ?? ''}
                        onChange={(event) => handleContactFieldChange('email', event.target.value)}
                        className="input-field"
                        placeholder="candidate@example.com"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Recommended for receipt emails, assessment links, and interview scheduling.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-gray-50">
                      <label className="flex items-center text-sm text-gray-500 mb-2">
                        <Phone className="h-4 w-4 mr-2" />
                        Phone
                      </label>
                      <input
                        type="text"
                        value={activeContact.phone ?? ''}
                        onChange={(event) => handleContactFieldChange('phone', event.target.value)}
                        className="input-field"
                        placeholder="+86 13800138000"
                      />
                    </div>
                    <div className="p-4 rounded-lg bg-gray-50">
                      <label className="flex items-center text-sm text-gray-500 mb-2">
                        <MapPin className="h-4 w-4 mr-2" />
                        Location
                      </label>
                      <input
                        type="text"
                        value={activeContact.location ?? ''}
                        onChange={(event) => handleContactFieldChange('location', event.target.value)}
                        className="input-field"
                        placeholder="Shanghai, China"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Screening Summary</h3>
                <p className="text-sm text-gray-600 mb-4">{activeResume.summary}</p>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">Extracted profile</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <p className="text-gray-700">
                      <span className="font-medium text-gray-900">Title:</span>{' '}
                      {activeResume.profile.currentTitle || 'Not clearly found'}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium text-gray-900">Experience:</span>{' '}
                      {activeResume.profile.yearsExperience
                        ? `${activeResume.profile.yearsExperience} years`
                        : 'Not clearly found'}
                    </p>
                    <p className="text-gray-700 md:col-span-2">
                      <span className="font-medium text-gray-900">Skills:</span>{' '}
                      {activeResume.profile.skills.length > 0
                        ? activeResume.profile.skills.join(', ')
                        : 'No strong keywords detected yet'}
                    </p>
                    <p className="text-gray-700 md:col-span-2">
                      <span className="font-medium text-gray-900">Education:</span>{' '}
                      {activeResume.profile.education.length > 0
                        ? activeResume.profile.education.join(' | ')
                        : 'No clear education block detected'}
                    </p>
                    <p className="text-gray-700 md:col-span-2">
                      <span className="font-medium text-gray-900">Highlights:</span>{' '}
                      {activeResume.profile.highlights.length > 0
                        ? activeResume.profile.highlights.join(' | ')
                        : 'No clear highlights extracted'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Workflow Control</h3>
                  <button
                    onClick={saveWorkflow}
                    className="btn-primary flex items-center space-x-2"
                    disabled={!activeWorkflow || savingWorkflow}
                  >
                    {savingWorkflow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>{savingWorkflow ? 'Saving...' : 'Save Workflow'}</span>
                  </button>
                </div>
                {activeWorkflow && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Stage</label>
                        <select
                          value={activeWorkflow.stage}
                          onChange={(event) =>
                            handleWorkflowFieldChange('stage', event.target.value as CandidateStage)
                          }
                          className="input-field"
                        >
                          {STAGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Review</label>
                        <select
                          value={activeWorkflow.reviewStatus}
                          onChange={(event) =>
                            handleWorkflowFieldChange('reviewStatus', event.target.value as CandidateReviewStatus)
                          }
                          className="input-field"
                        >
                          {REVIEW_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Outreach</label>
                        <select
                          value={activeWorkflow.outreachStatus}
                          onChange={(event) =>
                            handleWorkflowFieldChange(
                              'outreachStatus',
                              event.target.value as CandidateOutreachStatus
                            )
                          }
                          className="input-field"
                        >
                          {OUTREACH_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Recommended next action</label>
                      <input
                        type="text"
                        value={activeWorkflow.recommendedNextAction}
                        onChange={(event) =>
                          handleWorkflowFieldChange('recommendedNextAction', event.target.value)
                        }
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Recruiter notes</label>
                      <textarea
                        value={activeWorkflow.notes}
                        onChange={(event) => handleWorkflowFieldChange('notes', event.target.value)}
                        rows={4}
                        className="input-field"
                        placeholder="Add call outcome, next interview note, or manual review remarks..."
                      />
                    </div>

                    <p className="text-xs text-gray-500">
                      Last updated {new Date(activeResume.workflow.lastUpdatedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Process Timeline</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Every intake action, workflow move, and recruiter note leaves a trace here.
                    </p>
                  </div>
                  <History className="h-5 w-5 text-gray-400" />
                </div>
                <div className="space-y-4">
                  {timeline.map((event) => (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className={`mt-1 h-3 w-3 rounded-full ${getTimelineColor(event.type)}`}></div>
                      <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{event.title}</p>
                            {event.description && (
                              <p className="mt-1 text-sm text-gray-600">{event.description}</p>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            <p>{event.actor}</p>
                            <p>{new Date(event.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 && (
                    <p className="text-sm text-gray-500">Timeline events will appear once the candidate enters the workflow.</p>
                  )}
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills Analysis</h3>
                <div className="space-y-4">
                  {activeResume.skillAnalysis.map((skill) => (
                    <div key={skill.skill} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{skill.skill}</span>
                          <span className="text-sm text-gray-600">{skill.match}% match</span>
                        </div>
                        <div className="flex space-x-4 text-sm text-gray-600">
                          <span>Candidate level: {skill.level}%</span>
                          <span>Market demand: {skill.demand}%</span>
                        </div>
                        <div className="mt-2 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${skill.match}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Insights</h3>
                <div className="space-y-4">
                  {activeResume.insights.map((insight, index) => (
                    <div key={index} className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">{insight.title}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(insight.priority)}`}>
                            {insight.priority} priority
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{insight.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Task Board</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Track recruiter actions across outreach, screening, and interview follow-up.
                </p>
              </div>
              <button
                onClick={saveTasks}
                className="btn-secondary flex items-center space-x-2"
                disabled={!activeResume || savingTasks}
              >
                {savingTasks ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{savingTasks ? 'Saving...' : 'Save Tasks'}</span>
              </button>
            </div>
            {activeResume ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-gray-500">Open</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">{taskStats.open}</p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="text-gray-500">Done</p>
                    <p className="mt-1 text-xl font-semibold text-green-700">{taskStats.done}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3">
                    <p className="text-gray-500">Blocked</p>
                    <p className="mt-1 text-xl font-semibold text-red-700">{taskStats.blocked}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-gray-500">Total</p>
                    <p className="mt-1 text-xl font-semibold text-blue-700">{taskStats.total}</p>
                  </div>
                </div>

                <button
                  onClick={addTask}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Custom Task</span>
                </button>

                <div className="space-y-4">
                  {activeTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTaskStatusColor(task.status)}`}>
                            {TASK_STATUS_OPTIONS.find((option) => option.value === task.status)?.label ?? task.status}
                          </span>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {getTaskKindLabel(task.kind)}
                          </span>
                        </div>
                        {task.kind === 'custom' && (
                          <button
                            onClick={() => removeTask(task.id)}
                            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Task title</label>
                          <input
                            type="text"
                            value={task.title}
                            onChange={(event) => handleTaskFieldChange(task.id, 'title', event.target.value)}
                            className="input-field"
                            placeholder="Add a recruiter action..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                          <textarea
                            value={task.description ?? ''}
                            onChange={(event) =>
                              handleTaskFieldChange(task.id, 'description', event.target.value || null)
                            }
                            rows={3}
                            className="input-field"
                            placeholder="Clarify what needs to happen next."
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                            <select
                              value={task.status}
                              onChange={(event) =>
                                handleTaskFieldChange(task.id, 'status', event.target.value as CandidateTaskStatus)
                              }
                              className="input-field"
                            >
                              {TASK_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
                            <select
                              value={task.channel}
                              onChange={(event) =>
                                handleTaskFieldChange(task.id, 'channel', event.target.value as CandidateTaskChannel)
                              }
                              className="input-field"
                            >
                              {TASK_CHANNEL_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Owner</label>
                            <input
                              type="text"
                              value={task.owner ?? ''}
                              onChange={(event) =>
                                handleTaskFieldChange(task.id, 'owner', event.target.value || null)
                              }
                              className="input-field"
                              placeholder="Recruiter or interviewer name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Due at</label>
                            <input
                              type="datetime-local"
                              value={toDateTimeInputValue(task.dueAt)}
                              onChange={(event) =>
                                handleTaskFieldChange(task.id, 'dueAt', fromDateTimeInputValue(event.target.value))
                              }
                              className="input-field"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <p className="flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            Updated {new Date(task.updatedAt).toLocaleString()}
                          </p>
                          {task.dueAt && (
                            <p className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Due {new Date(task.dueAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeTasks.length === 0 && (
                    <p className="text-sm text-gray-500">Tasks will appear here once the candidate is stored.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Select a candidate to manage workflow tasks.</p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Receipt Email</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDeliveryStatusColor(receiptStatus)}`}>
                {receiptStatus}
              </span>
            </div>
            {activeResume ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Send a receipt email once the candidate email is available. If SMTP is not configured, the app will generate a preview instead.
                </p>
                <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
                  <p>Attempts: {activeResume.communication.receiptEmailCount}</p>
                  <p>
                    Last attempt:{' '}
                    {activeResume.communication.receiptEmailLastAttemptAt
                      ? new Date(activeResume.communication.receiptEmailLastAttemptAt).toLocaleString()
                      : 'Never'}
                  </p>
                  <p>
                    Last sent:{' '}
                    {activeResume.communication.receiptEmailSentAt
                      ? new Date(activeResume.communication.receiptEmailSentAt).toLocaleString()
                      : 'Not sent yet'}
                  </p>
                </div>
                <button
                  onClick={sendReceipt}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                  disabled={!activeResume.contact.email || sendingReceipt}
                >
                  {sendingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  <span>{sendingReceipt ? 'Sending...' : 'Send Receipt Email'}</span>
                </button>
                {!activeResume.contact.email && (
                  <p className="text-xs text-amber-700">Add an email address first before sending the receipt.</p>
                )}
                {activeResume.communication.receiptEmailLastError && (
                  <p className="text-xs text-red-600">{activeResume.communication.receiptEmailLastError}</p>
                )}
                {receiptFeedback && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                    <p className="text-xs text-blue-800 whitespace-pre-line">{receiptFeedback}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Select a candidate to send a receipt email.</p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Interview Invite</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDeliveryStatusColor(interviewInviteStatus)}`}>
                {interviewInviteStatus}
              </span>
            </div>
            {activeResume ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Send the interview invitation after screening is complete. The platform will move the candidate into the interview stage and keep the outreach timeline updated.
                </p>
                <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
                  <p>Current stage: {activeResume.workflow.stage}</p>
                  <p>Attempts: {activeResume.communication.interviewInviteEmailCount}</p>
                  <p>
                    Last attempt:{' '}
                    {activeResume.communication.interviewInviteEmailLastAttemptAt
                      ? new Date(activeResume.communication.interviewInviteEmailLastAttemptAt).toLocaleString()
                      : 'Never'}
                  </p>
                  <p>
                    Last sent:{' '}
                    {activeResume.communication.interviewInviteEmailSentAt
                      ? new Date(activeResume.communication.interviewInviteEmailSentAt).toLocaleString()
                      : 'Not sent yet'}
                  </p>
                </div>
                <button
                  onClick={sendInterviewInvite}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                  disabled={!activeResume.contact.email || !canSendInterviewInvite || sendingInterviewInvite}
                >
                  {sendingInterviewInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  <span>{sendingInterviewInvite ? 'Sending...' : 'Send Interview Invite'}</span>
                </button>
                {!activeResume.contact.email && (
                  <p className="text-xs text-amber-700">Add an email address first before sending the interview invite.</p>
                )}
                {activeResume.contact.email && !canSendInterviewInvite && (
                  <p className="text-xs text-amber-700">
                    Interview invites are available for candidates in the new, screening, or interview stages only.
                  </p>
                )}
                {activeResume.communication.interviewInviteEmailLastError && (
                  <p className="text-xs text-red-600">{activeResume.communication.interviewInviteEmailLastError}</p>
                )}
                {interviewInviteFeedback && (
                  <div className="rounded-lg bg-violet-50 border border-violet-200 p-3">
                    <p className="text-xs text-violet-800 whitespace-pre-line">{interviewInviteFeedback}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Select a candidate to send an interview invite.</p>
            )}
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Candidate Score</h3>
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-gray-200"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={`${scoreOffset}`}
                    className="text-primary-600"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">{score}%</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">Current screening readiness</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resume Composition</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeResume?.composition ?? []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(activeResume?.composition ?? []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {(activeResume?.composition ?? []).map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-700">{item.name}</span>
                  </div>
                  <span className="font-medium text-gray-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Resume Preview</h3>
              {activeResume && (
                <button
                  onClick={() => setShowFullText((current) => !current)}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1"
                >
                  {showFullText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span>{showFullText ? 'Collapse' : 'Expand'}</span>
                </button>
              )}
            </div>
            {activeResume ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {showFullText ? activeResume.extractedText : activeResume.extractedText.slice(0, 900)}
                    {!showFullText && activeResume.extractedText.length > 900 ? '...' : ''}
                  </p>
                </div>
                <button className="w-full btn-secondary flex items-center justify-center space-x-2">
                  <Download className="h-4 w-4" />
                  <span>Export Analysis Snapshot</span>
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Upload a resume to inspect the extracted text.</p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Candidate Queue</h3>
              {loadingHistory && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </div>
            <div className="space-y-3">
              {recentResumes.length === 0 && !loadingHistory && (
                <p className="text-sm text-gray-500">No candidates stored yet.</p>
              )}
              {recentResumes.map((resume) => (
                <button
                  key={resume.id}
                  onClick={() => void loadResumeDetail(resume.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    activeResume?.id === resume.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {resume.contact.name || resume.fileName}
                    </p>
                    <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${getStageColor(resume.workflow.stage)}`}>
                      {resume.workflow.stage}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {resume.contact.email || 'No email found'} - Score {resume.score}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {resume.workflow.recommendedNextAction}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {resume.tasks.filter((task) => task.status !== 'done').length} open tasks
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
