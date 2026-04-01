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
  { value: 'new', label: '新候选人' },
  { value: 'screening', label: '筛选中' },
  { value: 'interview', label: '面试中' },
  { value: 'offer', label: 'Offer 阶段' },
  { value: 'hired', label: '已录用' },
  { value: 'rejected', label: '未通过' },
]

const REVIEW_OPTIONS: { value: CandidateReviewStatus; label: string }[] = [
  { value: 'pending', label: '待评审' },
  { value: 'reviewed', label: '已评审' },
]

const OUTREACH_OPTIONS: { value: CandidateOutreachStatus; label: string }[] = [
  { value: 'pending', label: '待联系' },
  { value: 'ready', label: '可联系' },
  { value: 'contacted', label: '已联系' },
  { value: 'responded', label: '已回复' },
]

const TASK_STATUS_OPTIONS: { value: CandidateTaskStatus; label: string }[] = [
  { value: 'todo', label: '待处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'blocked', label: '受阻' },
]

const TASK_CHANNEL_OPTIONS: { value: CandidateTaskChannel; label: string }[] = [
  { value: 'manual', label: '手动' },
  { value: 'email', label: '邮件' },
  { value: 'phone', label: '电话' },
  { value: 'wechat', label: 'WeChat' },
  { value: 'feishu', label: 'Feishu' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'assessment', label: '测评' },
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

function getPriorityLabel(priority: ResumeInsight['priority']) {
  switch (priority) {
    case 'high':
      return '高优先级'
    case 'medium':
      return '中优先级'
    case 'low':
      return '低优先级'
    default:
      return priority
  }
}

function getStageLabel(stage: CandidateStage) {
  return STAGE_OPTIONS.find((option) => option.value === stage)?.label ?? stage
}

function getReviewStatusLabel(status: CandidateReviewStatus) {
  return REVIEW_OPTIONS.find((option) => option.value === status)?.label ?? status
}

function getOutreachStatusLabel(status: CandidateOutreachStatus) {
  return OUTREACH_OPTIONS.find((option) => option.value === status)?.label ?? status
}

function getTaskStatusLabel(status: CandidateTaskStatus) {
  return TASK_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
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
      return '联系方式核验'
    case 'first_outreach':
      return '首次触达'
    case 'screening_decision':
      return '筛选决策'
    case 'interview':
      return '面试推进'
    case 'offer':
      return 'Offer 跟进'
    case 'custom':
    default:
      return '自定义'
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

function getDeliveryStatusLabel(status: 'not_sent' | 'preview' | 'sent' | 'failed') {
  switch (status) {
    case 'sent':
      return '已发送'
    case 'preview':
      return '预览稿'
    case 'failed':
      return '发送失败'
    case 'not_sent':
    default:
      return '未发送'
  }
}

function getTimelineActorLabel(actor: CandidateTimelineEvent['actor']) {
  switch (actor) {
    case 'system':
      return '系统'
    case 'recruiter':
      return '招聘方'
    case 'candidate':
      return '候选人'
    default:
      return actor
  }
}

function getCompositionLabel(name: string) {
  switch (name) {
    case 'Technical Skills':
      return '技术技能'
    case 'Experience':
      return '经验经历'
    case 'Education':
      return '教育背景'
    case 'Projects':
      return '项目实践'
    default:
      return name
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

function ProtectedTechnicalText({
  value,
  fallback = '暂无',
}: {
  value: string | null | undefined
  fallback?: string
}) {
  const text = typeof value === 'string' && value.trim() ? value.trim() : fallback
  const lang = /[A-Za-z]/.test(text) ? 'en' : undefined

  return (
    <span className="notranslate" translate="no" lang={lang}>
      {text}
    </span>
  )
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

  const marketDemandSummary = useMemo(() => {
    const skills = activeResume?.skillAnalysis ?? []

    if (skills.length === 0) {
      return null
    }

    const highestDemand = [...skills].sort((left, right) => right.demand - left.demand)[0] ?? null
    const bestFit = [...skills].sort(
      (left, right) => right.match + right.demand + right.level - (left.match + left.demand + left.level)
    )[0] ?? null
    const upskillPriority = [...skills].sort(
      (left, right) => right.demand - right.level - (left.demand - left.level)
    )[0] ?? null
    const averageDemand = Math.round(skills.reduce((sum, skill) => sum + skill.demand, 0) / skills.length)
    const marketReadySkills = skills.filter((skill) => skill.match >= 75 && skill.demand >= 70).length

    return {
      averageDemand,
      highestDemand,
      bestFit,
      upskillPriority,
      marketReadySkills,
      demandRanking: [...skills].sort((left, right) => right.demand - left.demand).slice(0, 4),
    }
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
        throw new Error('加载简历历史失败。')
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
      setError(fetchError instanceof Error ? fetchError.message : '加载简历历史失败。')
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
        throw new Error('error' in data && data.error ? data.error : '加载简历详情失败。')
      }

      setActiveResume(data)
      setShowFullText(false)
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : '加载简历详情失败。')
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
        throw new Error('error' in data && data.error ? data.error : '简历上传失败。')
      }

      applyRecordUpdate(data)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '简历上传失败。')
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
        throw new Error('error' in data && data.error ? data.error : '保存联系信息失败。')
      }

      applyRecordUpdate(data)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存联系信息失败。')
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
        throw new Error('error' in data && data.error ? data.error : '保存流程信息失败。')
      }

      applyRecordUpdate(data)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存流程信息失败。')
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
        throw new Error('error' in data && data.error ? data.error : '保存任务看板失败。')
      }

      applyRecordUpdate(data)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存任务看板失败。')
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

        throw new Error('error' in data && data.error ? data.error : '发送回执邮件失败。')
      }

      if ('record' in data && data.record && 'id' in data.record) {
        applyRecordUpdate(data.record)
      }

      if ('delivery' in data && data.delivery) {
        setReceiptFeedback(
          data.delivery.mode === 'preview'
            ? `${data.delivery.message}\n\n预览正文：\n${data.delivery.text}`
            : data.delivery.message
        )
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '发送回执邮件失败。')
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

        throw new Error('error' in data && data.error ? data.error : '发送面试邀请失败。')
      }

      if ('record' in data && data.record && 'id' in data.record) {
        applyRecordUpdate(data.record)
      }

      if ('delivery' in data && data.delivery) {
        setInterviewInviteFeedback(
          data.delivery.mode === 'preview'
            ? `${data.delivery.message}\n\n预览正文：\n${data.delivery.text}`
            : data.delivery.message
        )
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '发送面试邀请失败。')
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
          <h1 className="text-3xl font-bold text-gray-900">简历分析</h1>
          <p className="text-gray-600 mt-2">
            上传简历后即可查看候选人画像、技能拆解、市场需求分析与后续跟进建议。
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            {activeResume?.source === 'openai' ? 'OpenAI 分析' : '规则分析'}
          </span>
          <button
            onClick={() => void loadRecentResumes()}
            className="btn-secondary flex items-center space-x-2"
            disabled={loadingHistory}
          >
            <RefreshCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            <span>刷新队列</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">候选人数</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{queueStats.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">待联系</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{queueStats.readyToContact}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">面试中</p>
          <p className="text-2xl font-bold text-violet-700 mt-1">{queueStats.interviewing}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Offer 阶段</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{queueStats.offers}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="text-center">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">上传候选人简历</h3>
                <p className="text-gray-600 mb-4">
                  支持 `PDF`、`DOCX`、`TXT`、`MD`。新上传的简历会保存在本地，并加入候选人队列。
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
                  <span>{loading ? '上传并分析中...' : '选择简历文件'}</span>
                </label>
                {uploadedFile && (
                  <p className="text-sm text-gray-500 mt-4">
                    当前文件：{uploadedFile.name}（{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB）
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
              <span className="text-sm text-gray-500">正在加载候选人详情...</span>
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
                      {getStageLabel(activeResume.workflow.stage)}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {getReviewStatusLabel(activeResume.workflow.reviewStatus)}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {getOutreachStatusLabel(activeResume.workflow.outreachStatus)}
                    </span>
                  </div>
                </div>

                {!activeResume.contact.email && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-800">
                      这份简历里没有成功识别出邮箱。你可以在下方手动补充，方便后续联系候选人。
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">可编辑联系信息</h4>
                  <button
                    onClick={saveContact}
                    className="btn-secondary flex items-center space-x-2"
                    disabled={!activeContact || savingContact}
                  >
                    {savingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>{savingContact ? '保存中...' : '保存联系信息'}</span>
                  </button>
                </div>

                {activeContact && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-gray-50">
                      <label className="flex items-center text-sm text-gray-500 mb-2">
                        <User className="h-4 w-4 mr-2" />
                        姓名
                      </label>
                      <input
                        type="text"
                        value={activeContact.name ?? ''}
                        onChange={(event) => handleContactFieldChange('name', event.target.value)}
                        className="input-field"
                        placeholder="候选人姓名"
                      />
                    </div>
                    <div className="p-4 rounded-lg bg-gray-50">
                      <label className="flex items-center text-sm text-gray-500 mb-2">
                        <Mail className="h-4 w-4 mr-2" />
                        邮箱
                      </label>
                      <input
                        type="email"
                        value={activeContact.email ?? ''}
                        onChange={(event) => handleContactFieldChange('email', event.target.value)}
                        className="input-field"
                        placeholder="candidate@example.com"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        建议填写邮箱，用于发送回执、测评链接和面试安排。
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-gray-50">
                      <label className="flex items-center text-sm text-gray-500 mb-2">
                        <Phone className="h-4 w-4 mr-2" />
                        电话
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
                        地点
                      </label>
                      <input
                        type="text"
                        value={activeContact.location ?? ''}
                        onChange={(event) => handleContactFieldChange('location', event.target.value)}
                        className="input-field"
                        placeholder="例如：上海"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">筛选总结</h3>
                <p className="text-sm text-gray-600 mb-4">{activeResume.summary}</p>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">提取结果</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <p className="text-gray-700">
                      <span className="font-medium text-gray-900">岗位方向：</span>{' '}
                      <ProtectedTechnicalText value={activeResume.profile.currentTitle} fallback="未明确识别" />
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium text-gray-900">工作年限：</span>{' '}
                      {activeResume.profile.yearsExperience
                        ? `${activeResume.profile.yearsExperience} 年`
                        : '未明确识别'}
                    </p>
                    <p className="text-gray-700 md:col-span-2">
                      <span className="font-medium text-gray-900">核心技能：</span>{' '}
                      {activeResume.profile.skills.length > 0
                        ? activeResume.profile.skills.map((skill, index) => (
                            <span key={`${skill}-${index}`}>
                              {index > 0 ? ', ' : ''}
                              <ProtectedTechnicalText value={skill} />
                            </span>
                          ))
                        : '暂未识别到明确技能关键词'}
                    </p>
                    <p className="text-gray-700 md:col-span-2">
                      <span className="font-medium text-gray-900">教育背景：</span>{' '}
                      {activeResume.profile.education.length > 0
                        ? activeResume.profile.education.join(' | ')
                        : '未识别到清晰的教育信息'}
                    </p>
                    <p className="text-gray-700 md:col-span-2">
                      <span className="font-medium text-gray-900">亮点摘要：</span>{' '}
                      {activeResume.profile.highlights.length > 0
                        ? activeResume.profile.highlights.join(' | ')
                        : '暂未提取到明显亮点'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">流程管理</h3>
                  <button
                    onClick={saveWorkflow}
                    className="btn-primary flex items-center space-x-2"
                    disabled={!activeWorkflow || savingWorkflow}
                  >
                    {savingWorkflow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>{savingWorkflow ? '保存中...' : '保存流程'}</span>
                  </button>
                </div>
                {activeWorkflow && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">阶段</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">评审状态</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">联系进度</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">建议下一步动作</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">招聘备注</label>
                      <textarea
                        value={activeWorkflow.notes}
                        onChange={(event) => handleWorkflowFieldChange('notes', event.target.value)}
                        rows={4}
                        className="input-field"
                        placeholder="补充沟通结果、下一轮面试安排或人工评审备注..."
                      />
                    </div>

                    <p className="text-xs text-gray-500">
                      最近更新时间：{new Date(activeResume.workflow.lastUpdatedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">流程时间线</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      每一次录入、流转和备注更新，都会记录在这里。
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
                            <p>{getTimelineActorLabel(event.actor)}</p>
                            <p>{new Date(event.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 && (
                    <p className="text-sm text-gray-500">候选人进入流程后，这里会开始记录关键节点。</p>
                  )}
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">技能分析</h3>
                <div className="space-y-4">
                  {activeResume.skillAnalysis.map((skill) => (
                    <div key={skill.skill} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">
                            <ProtectedTechnicalText value={skill.skill} />
                          </span>
                          <span className="text-sm text-gray-600">匹配度 {skill.match}%</span>
                        </div>
                        <div className="flex space-x-4 text-sm text-gray-600">
                          <span>候选人水平：{skill.level}%</span>
                          <span>市场需求：{skill.demand}%</span>
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
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">市场需求分析</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      对照当前技能画像，快速判断哪些能力最热门、最匹配、最值得优先补强。
                    </p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-primary-500" />
                </div>

                {marketDemandSummary ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl bg-blue-50 p-4">
                        <p className="text-xs text-blue-700">热门技能</p>
                        <p className="mt-1 text-lg font-semibold text-blue-900">
                          <ProtectedTechnicalText value={marketDemandSummary.highestDemand?.skill} />
                        </p>
                        <p className="mt-1 text-sm text-blue-800">
                          市场需求 {marketDemandSummary.highestDemand?.demand ?? 0}%
                        </p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-4">
                        <p className="text-xs text-emerald-700">平均市场需求</p>
                        <p className="mt-1 text-lg font-semibold text-emerald-900">
                          {marketDemandSummary.averageDemand}%
                        </p>
                        <p className="mt-1 text-sm text-emerald-800">
                          {marketDemandSummary.marketReadySkills} 项技能已具备市场竞争力
                        </p>
                      </div>
                      <div className="rounded-xl bg-violet-50 p-4">
                        <p className="text-xs text-violet-700">最强市场匹配</p>
                        <p className="mt-1 text-lg font-semibold text-violet-900">
                          <ProtectedTechnicalText value={marketDemandSummary.bestFit?.skill} />
                        </p>
                        <p className="mt-1 text-sm text-violet-800">
                          匹配 {marketDemandSummary.bestFit?.match ?? 0}% / 需求 {marketDemandSummary.bestFit?.demand ?? 0}%
                        </p>
                      </div>
                      <div className="rounded-xl bg-amber-50 p-4">
                        <p className="text-xs text-amber-700">下一步补强</p>
                        <p className="mt-1 text-lg font-semibold text-amber-900">
                          <ProtectedTechnicalText value={marketDemandSummary.upskillPriority?.skill} />
                        </p>
                        <p className="mt-1 text-sm text-amber-800">
                          当前水平 {marketDemandSummary.upskillPriority?.level ?? 0}% / 市场需求 {marketDemandSummary.upskillPriority?.demand ?? 0}%
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {marketDemandSummary.demandRanking.map((skill) => (
                        <div key={`market-${skill.skill}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-gray-900">
                                <ProtectedTechnicalText value={skill.skill} />
                              </p>
                              <p className="text-sm text-gray-500">
                                候选人水平 {skill.level}% / 当前匹配 {skill.match}%
                              </p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700">
                              需求 {skill.demand}%
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            <div>
                              <div className="mb-1 flex justify-between text-xs text-gray-500">
                                <span>市场热度</span>
                                <span>{skill.demand}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-gray-200">
                                <div className="h-2 rounded-full bg-blue-500" style={{ width: `${skill.demand}%` }}></div>
                              </div>
                            </div>
                            <div>
                              <div className="mb-1 flex justify-between text-xs text-gray-500">
                                <span>候选人储备</span>
                                <span>{skill.level}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-gray-200">
                                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${skill.level}%` }}></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">上传并解析简历后，这里会显示市场需求分析。</p>
                )}
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">AI 洞察</h3>
                <div className="space-y-4">
                  {activeResume.insights.map((insight, index) => (
                    <div key={index} className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">{insight.title}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(insight.priority)}`}>
                            {getPriorityLabel(insight.priority)}
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
                <h3 className="text-lg font-semibold text-gray-900">任务看板</h3>
                <p className="text-sm text-gray-500 mt-1">
                  统一跟踪联系、筛选、面试跟进等招聘动作。
                </p>
              </div>
              <button
                onClick={saveTasks}
                className="btn-secondary flex items-center space-x-2"
                disabled={!activeResume || savingTasks}
              >
                {savingTasks ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{savingTasks ? '保存中...' : '保存任务'}</span>
              </button>
            </div>
            {activeResume ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-gray-500">未完成</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">{taskStats.open}</p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="text-gray-500">已完成</p>
                    <p className="mt-1 text-xl font-semibold text-green-700">{taskStats.done}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3">
                    <p className="text-gray-500">受阻</p>
                    <p className="mt-1 text-xl font-semibold text-red-700">{taskStats.blocked}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-gray-500">总数</p>
                    <p className="mt-1 text-xl font-semibold text-blue-700">{taskStats.total}</p>
                  </div>
                </div>

                <button
                  onClick={addTask}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>新增自定义任务</span>
                </button>

                <div className="space-y-4">
                  {activeTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTaskStatusColor(task.status)}`}>
                            {getTaskStatusLabel(task.status)}
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
                            <span>删除</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">任务标题</label>
                          <input
                            type="text"
                            value={task.title}
                            onChange={(event) => handleTaskFieldChange(task.id, 'title', event.target.value)}
                            className="input-field"
                            placeholder="填写一个招聘动作..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">任务描述</label>
                          <textarea
                            value={task.description ?? ''}
                            onChange={(event) =>
                              handleTaskFieldChange(task.id, 'description', event.target.value || null)
                            }
                            rows={3}
                            className="input-field"
                            placeholder="说明下一步需要做什么。"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">渠道</label>
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">负责人</label>
                            <input
                              type="text"
                              value={task.owner ?? ''}
                              onChange={(event) =>
                                handleTaskFieldChange(task.id, 'owner', event.target.value || null)
                              }
                              className="input-field"
                              placeholder="招聘负责人或面试官姓名"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">截止时间</label>
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
                            更新于 {new Date(task.updatedAt).toLocaleString()}
                          </p>
                          {task.dueAt && (
                            <p className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              截止于 {new Date(task.dueAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeTasks.length === 0 && (
                    <p className="text-sm text-gray-500">候选人保存后，这里会展示可跟进任务。</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">请选择一位候选人后再管理任务。</p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">回执邮件</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDeliveryStatusColor(receiptStatus)}`}>
                {getDeliveryStatusLabel(receiptStatus)}
              </span>
            </div>
            {activeResume ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  候选人邮箱可用后，就可以发送回执邮件；如果 `SMTP` 尚未配置，系统会先生成一份预览稿。
                </p>
                <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
                  <p>尝试次数：{activeResume.communication.receiptEmailCount}</p>
                  <p>
                    最近尝试：{' '}
                    {activeResume.communication.receiptEmailLastAttemptAt
                      ? new Date(activeResume.communication.receiptEmailLastAttemptAt).toLocaleString()
                      : '暂无'}
                  </p>
                  <p>
                    最近发送：{' '}
                    {activeResume.communication.receiptEmailSentAt
                      ? new Date(activeResume.communication.receiptEmailSentAt).toLocaleString()
                      : '尚未发送'}
                  </p>
                </div>
                <button
                  onClick={sendReceipt}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                  disabled={!activeResume.contact.email || sendingReceipt}
                >
                  {sendingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  <span>{sendingReceipt ? '发送中...' : '发送回执邮件'}</span>
                </button>
                {!activeResume.contact.email && (
                  <p className="text-xs text-amber-700">发送前请先补充候选人邮箱。</p>
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
              <p className="text-sm text-gray-500">请选择一位候选人后再发送回执邮件。</p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">面试邀请</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDeliveryStatusColor(interviewInviteStatus)}`}>
                {getDeliveryStatusLabel(interviewInviteStatus)}
              </span>
            </div>
            {activeResume ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  筛选完成后可以直接发送面试邀请，系统会同步推进候选人阶段并更新联系时间线。
                </p>
                <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
                  <p>当前阶段：{getStageLabel(activeResume.workflow.stage)}</p>
                  <p>尝试次数：{activeResume.communication.interviewInviteEmailCount}</p>
                  <p>
                    最近尝试：{' '}
                    {activeResume.communication.interviewInviteEmailLastAttemptAt
                      ? new Date(activeResume.communication.interviewInviteEmailLastAttemptAt).toLocaleString()
                      : '暂无'}
                  </p>
                  <p>
                    最近发送：{' '}
                    {activeResume.communication.interviewInviteEmailSentAt
                      ? new Date(activeResume.communication.interviewInviteEmailSentAt).toLocaleString()
                      : '尚未发送'}
                  </p>
                </div>
                <button
                  onClick={sendInterviewInvite}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                  disabled={!activeResume.contact.email || !canSendInterviewInvite || sendingInterviewInvite}
                >
                  {sendingInterviewInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  <span>{sendingInterviewInvite ? '发送中...' : '发送面试邀请'}</span>
                </button>
                {!activeResume.contact.email && (
                  <p className="text-xs text-amber-700">发送前请先补充候选人邮箱。</p>
                )}
                {activeResume.contact.email && !canSendInterviewInvite && (
                  <p className="text-xs text-amber-700">
                    只有处于新候选人、筛选中或面试中的候选人，才可以发送面试邀请。
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
              <p className="text-sm text-gray-500">请选择一位候选人后再发送面试邀请。</p>
            )}
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">候选人评分</h3>
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
              <p className="text-sm text-gray-600 mt-2">当前筛选就绪度</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">简历构成</h3>
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
                    <span className="text-gray-700">{getCompositionLabel(item.name)}</span>
                  </div>
                  <span className="font-medium text-gray-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">简历预览</h3>
              {activeResume && (
                <button
                  onClick={() => setShowFullText((current) => !current)}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1"
                >
                  {showFullText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span>{showFullText ? '收起' : '展开'}</span>
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
                  <span>导出分析快照</span>
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">上传一份简历后，这里会显示提取出的原文内容。</p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">候选人队列</h3>
              {loadingHistory && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </div>
            <div className="space-y-3">
              {recentResumes.length === 0 && !loadingHistory && (
                <p className="text-sm text-gray-500">暂时还没有已保存的候选人。</p>
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
                      {getStageLabel(resume.workflow.stage)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {resume.contact.email || '未识别到邮箱'} · 评分 {resume.score}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {resume.workflow.recommendedNextAction}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {resume.tasks.filter((task) => task.status !== 'done').length} 个未完成任务
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
