import { NextResponse } from 'next/server'

import { getApplicationById, updateApplication } from '@/lib/server/application-store'
import {
  isAuthErrorMessage,
  isPermissionErrorMessage,
  requireAuthenticatedUser,
} from '@/lib/server/auth-helpers'
import { createAssessmentDraft } from '@/lib/server/assessment-engine'
import { addAssessmentRecord, listAssessmentRecords } from '@/lib/server/assessment-store'
import { findRecruiterScreeningByJobAndResume } from '@/lib/server/recruiter-screening-store'
import { getJobById } from '@/lib/server/job-store'
import { getResumeRecordById, listResumeRecords } from '@/lib/server/resume-store'
import type {
  AssessmentAnswer,
  AssessmentDifficulty,
  AssessmentKind,
  AssessmentMode,
  AssessmentQuestion,
  AssessmentQuestionCategory,
  AssessmentRecord,
  AssessmentStatus,
} from '@/types/assessment'
import type { AppUser } from '@/types/auth'
import type { JobRecord } from '@/types/job'
import type { ResumeRecord } from '@/types/resume'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODES: AssessmentMode[] = ['written', 'interview']
const STATUSES: AssessmentStatus[] = ['draft', 'in_progress', 'submitted', 'scored']
const KINDS: AssessmentKind[] = ['practice', 'recruiter_assigned']
const QUESTION_CATEGORIES: AssessmentQuestionCategory[] = [
  'technical',
  'problem_solving',
  'behavioral',
  'communication',
  'role_fit',
]
const QUESTION_DIFFICULTIES: AssessmentDifficulty[] = ['easy', 'medium', 'hard']

function isMode(value: unknown): value is AssessmentMode {
  return typeof value === 'string' && MODES.includes(value as AssessmentMode)
}

function isStatus(value: unknown): value is AssessmentStatus {
  return typeof value === 'string' && STATUSES.includes(value as AssessmentStatus)
}

function isKind(value: unknown): value is AssessmentKind {
  return typeof value === 'string' && KINDS.includes(value as AssessmentKind)
}

function isQuestionCategory(value: unknown): value is AssessmentQuestionCategory {
  return typeof value === 'string' && QUESTION_CATEGORIES.includes(value as AssessmentQuestionCategory)
}

function isQuestionDifficulty(value: unknown): value is AssessmentDifficulty {
  return typeof value === 'string' && QUESTION_DIFFICULTIES.includes(value as AssessmentDifficulty)
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function canManageJob(user: Pick<AppUser, 'id' | 'role'>, job: JobRecord) {
  return user.role === 'admin' || !job.ownerUserId || job.ownerUserId === user.id
}

function canUseResumeForApplication(applicationUserId: string, applicationUserEmail: string, resume: ResumeRecord) {
  if (resume.ownerUserId) {
    return resume.ownerUserId === applicationUserId
  }

  const expectedEmail = normalizeEmail(applicationUserEmail)
  return [resume.ownerEmail, resume.contact.email].some((value) => normalizeEmail(value) === expectedEmail)
}

function statusForMessage(message: string) {
  if (isAuthErrorMessage(message)) {
    return 401
  }

  if (
    isPermissionErrorMessage(message) ||
    message === 'Only recruiters can assign assessments.' ||
    message === 'Only candidates can create practice assessments.'
  ) {
    return 403
  }

  if (
    message === 'Application not found.' ||
    message === 'Job not found.' ||
    message === 'Resume not found.'
  ) {
    return 404
  }

  if (
    message === 'Please choose a valid assessment mode.' ||
    message === 'Candidate has not linked a resume yet.' ||
    message === 'The selected resume does not belong to this candidate.' ||
    message === 'The selected resume does not belong to you.'
  ) {
    return 400
  }

  if (
    message === '当前 AI 出题不可用，请检查模型配置或稍后重试。' ||
    message === 'AI 出题失败，请稍后重试。'
  ) {
    return 503
  }

  return 500
}

function localizeAssessmentError(message: string) {
  switch (message) {
    case 'Authentication token is missing.':
      return '请先登录后再继续。'
    case 'Session is invalid or expired.':
      return '登录状态已失效，请重新登录。'
    case 'User does not have permission.':
      return '你没有权限执行这个操作。'
    case 'Please choose a valid assessment mode.':
      return '请选择有效的测评模式。'
    case 'Only recruiters can assign assessments.':
      return '只有招聘方可以给候选人发题。'
    case 'Only candidates can create practice assessments.':
      return '只有求职者可以创建岗位自测。'
    case 'Application not found.':
      return '候选人投递记录不存在。'
    case 'Job not found.':
      return '岗位不存在。'
    case 'Resume not found.':
      return '简历不存在。'
    case 'Candidate has not linked a resume yet.':
      return '当前候选人还没有绑定有效简历。'
    case 'The selected resume does not belong to this candidate.':
      return '当前选择的简历不属于这位候选人。'
    case 'The selected resume does not belong to you.':
      return '当前选择的简历不属于你。'
    case '当前 AI 出题不可用，请检查模型配置或稍后重试。':
    case 'AI 出题失败，请稍后重试。':
      return message
    default:
      return message
  }
}

async function resolveBestResumeForApplication(
  application: Awaited<ReturnType<typeof getApplicationById>>,
  preferredResumeId?: string | null
) {
  if (!application) {
    return null
  }

  const resumes = await listResumeRecords()
  const candidateResumes = resumes.filter((resume) =>
    canUseResumeForApplication(application.userId, application.userEmail, resume)
  )

  if (preferredResumeId) {
    const preferred = candidateResumes.find((resume) => resume.id === preferredResumeId)
    if (preferred) {
      return preferred
    }
  }

  if (application.resumeId) {
    const linked = candidateResumes.find((resume) => resume.id === application.resumeId)
    if (linked) {
      return linked
    }
  }

  return candidateResumes[0] ?? null
}

function buildEmptyAnswers(record: { questions: AssessmentRecord['questions'] }) {
  return record.questions.map((question) => ({
    questionId: question.id,
    answer: '',
    transcript: null,
    audioAsset: {
      fileName: null,
      mimeType: null,
      size: null,
      storedFileName: null,
      uploadedAt: null,
    },
    submittedAt: null,
    score: null,
    feedback: null,
    strengths: [],
    gaps: [],
  })) satisfies AssessmentAnswer[]
}

function buildSummary(kind: AssessmentKind) {
  if (kind === 'recruiter_assigned') {
    return {
      overallScore: null,
      recommendation: null,
      summary: '招聘方已分配 AI 测评，请候选人在规定时间内完成作答。',
      nextStep: '候选人提交后，系统会自动评分并把结果同步给招聘方。',
      sessionDurationSeconds: 0,
      completedAt: null,
      rubric: {
        technical: 0,
        communication: 0,
        structuredThinking: 0,
        roleFit: 0,
      },
    }
  }

  return {
    overallScore: null,
    recommendation: null,
    summary: '题目已生成，可以先保存草稿，再提交系统评分。',
    nextStep: '完成全部题目后提交，系统会自动给出结果。',
    sessionDurationSeconds: 0,
    completedAt: null,
    rubric: {
      technical: 0,
      communication: 0,
      structuredThinking: 0,
      roleFit: 0,
    },
  }
}

function normalizeQuestions(value: unknown) {
  if (!Array.isArray(value)) {
    return null
  }

  const questions = value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      if (
        typeof item.prompt !== 'string' ||
        typeof item.idealAnswer !== 'string' ||
        !isQuestionCategory(item.category) ||
        !isQuestionDifficulty(item.difficulty)
      ) {
        return null
      }

      const expectedPoints = Array.isArray(item.expectedPoints)
        ? item.expectedPoints
            .filter((point): point is string => typeof point === 'string')
            .map((point) => point.trim())
            .filter(Boolean)
            .slice(0, 5)
        : []

      const prompt = item.prompt.trim()
      const idealAnswer = item.idealAnswer.trim()

      if (!prompt || !idealAnswer || expectedPoints.length === 0) {
        return null
      }

      return {
        id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : crypto.randomUUID(),
        prompt,
        category: item.category,
        difficulty: item.difficulty,
        expectedPoints,
        idealAnswer,
        maxScore:
          typeof item.maxScore === 'number' && Number.isFinite(item.maxScore)
            ? Math.max(1, Math.round(item.maxScore))
            : 20,
      } satisfies AssessmentQuestion
    })
    .filter((item): item is AssessmentQuestion => item !== null)

  return questions.length > 0 ? questions : null
}

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode')
    const resumeId = url.searchParams.get('resumeId')
    const status = url.searchParams.get('status')
    const kind = url.searchParams.get('kind')
    const jobId = url.searchParams.get('jobId')
    const applicationId = url.searchParams.get('applicationId')

    let records = await listAssessmentRecords()

    if (user.role === 'candidate') {
      records = records.filter((record) => record.candidateUserId === user.id)
    } else if (user.role === 'recruiter') {
      records = records.filter((record) => record.recruiterUserId === user.id)
    }

    if (mode && isMode(mode)) {
      records = records.filter((record) => record.mode === mode)
    }

    if (resumeId) {
      records = records.filter((record) => record.resumeId === resumeId)
    }

    if (status && isStatus(status)) {
      records = records.filter((record) => record.status === status)
    }

    if (kind && isKind(kind)) {
      records = records.filter((record) => record.kind === kind)
    }

    if (jobId) {
      records = records.filter((record) => record.jobId === jobId)
    }

    if (applicationId) {
      records = records.filter((record) => record.applicationId === applicationId)
    }

    return NextResponse.json(records)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load assessments.'
    return NextResponse.json({ error: localizeAssessmentError(message) }, { status: statusForMessage(message) })
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const body = (await request.json()) as {
      mode?: unknown
      jobId?: unknown
      resumeId?: unknown
      applicationId?: unknown
      title?: unknown
      generatedFrom?: unknown
      questions?: unknown
      requireAi?: unknown
    }

    if (!isMode(body.mode)) {
      return NextResponse.json({ error: '请选择有效的测评模式。' }, { status: 400 })
    }

    const mode = body.mode
    const applicationId = typeof body.applicationId === 'string' && body.applicationId.trim() ? body.applicationId : null
    const resumeId = typeof body.resumeId === 'string' && body.resumeId.trim() ? body.resumeId : null
    const jobId = typeof body.jobId === 'string' && body.jobId.trim() ? body.jobId : null
    const customQuestions = normalizeQuestions(body.questions)
    const customTitle = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null
    const customGeneratedFrom =
      typeof body.generatedFrom === 'string' && body.generatedFrom.trim() ? body.generatedFrom.trim() : null
    const requireAi = body.requireAi === true

    if (applicationId) {
      if (user.role !== 'recruiter' && user.role !== 'admin') {
        return NextResponse.json({ error: '只有招聘方可以给候选人发题。' }, { status: 403 })
      }

      const application = await getApplicationById(applicationId)
      if (!application) {
        return NextResponse.json({ error: '候选人投递记录不存在。' }, { status: 404 })
      }

      const job = await getJobById(application.jobId)
      if (!job) {
        return NextResponse.json({ error: '岗位不存在。' }, { status: 404 })
      }

      if (!canManageJob(user, job)) {
        return NextResponse.json({ error: '你没有权限执行这个操作。' }, { status: 403 })
      }

      const resume = await resolveBestResumeForApplication(application, resumeId ?? application.resumeId ?? null)
      if (!resume) {
        return NextResponse.json({ error: '当前候选人还没有绑定有效简历。' }, { status: 400 })
      }

      const screening = await findRecruiterScreeningByJobAndResume(user.id, job.id, resume.id)
      const aiDraft =
        screening && (!requireAi || screening.source === 'openai')
          ? {
            source: screening.source,
            title: `AI 初筛测评 - ${job.title}`,
            generatedFrom: screening.generatedFrom,
            questions: screening.questions,
          }
          : await createAssessmentDraft(job, resume, mode, requireAi ? { requireAi: true } : undefined)
      const draft = customQuestions
        ? {
            source: aiDraft.source,
            title: customTitle ?? `自定义测评 - ${job.title}`,
            generatedFrom:
              customGeneratedFrom ??
              (requireAi
                ? `题目与参考答案先由 AI 基于 ${job.title} 岗位要求和候选人简历生成，招聘方可在发送前做少量润色。`
                : `由招聘方结合 ${job.title} 岗位要求手动编辑题目后发送。`),
            questions: customQuestions,
          }
        : {
            ...aiDraft,
            title: customTitle ?? aiDraft.title,
            generatedFrom: customGeneratedFrom ?? aiDraft.generatedFrom,
          }
      const now = new Date().toISOString()
      const record: AssessmentRecord = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        title: draft.title,
        kind: 'recruiter_assigned',
        mode,
        status: 'draft',
        source: draft.source,
        generatedFrom: draft.generatedFrom,
        applicationId: application.id,
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        resumeId: resume.id,
        candidateUserId: application.userId,
        candidateName: resume.contact.name ?? application.userName,
        candidateEmail: resume.contact.email ?? application.userEmail,
        recruiterUserId: user.id,
        recruiterName: user.name,
        assignedAt: now,
        questions: draft.questions,
        answers: buildEmptyAnswers(draft),
        summary: buildSummary('recruiter_assigned'),
      }

      await addAssessmentRecord(record)
      await updateApplication(application.id, (current) => ({
        ...current,
        stage: current.stage === 'applied' ? 'screening' : current.stage,
        resumeId: resume.id,
        notes: requireAi ? '已发送 AI 初筛题目，等待候选人作答。' : '已发送测评题目，等待候选人作答。',
        updatedAt: now,
      }))

      return NextResponse.json(record, { status: 201 })
    }

    if (user.role !== 'candidate' && user.role !== 'admin') {
      return NextResponse.json({ error: '只有求职者可以创建岗位自测。' }, { status: 403 })
    }

    const [job, resume] = await Promise.all([
      jobId ? getJobById(jobId) : Promise.resolve(null),
      resumeId ? getResumeRecordById(resumeId) : Promise.resolve(null),
    ])

    if (jobId && !job) {
      return NextResponse.json({ error: '岗位不存在。' }, { status: 404 })
    }

    if (resumeId && !resume) {
      return NextResponse.json({ error: '简历不存在。' }, { status: 404 })
    }

    if (resume && !canUseResumeForApplication(user.id, user.email, resume)) {
      return NextResponse.json({ error: '当前选择的简历不属于你。' }, { status: 403 })
    }

    const aiDraft = await createAssessmentDraft(job, resume, mode, requireAi ? { requireAi: true } : undefined)
    const draft = customQuestions
      ? {
          source: aiDraft.source,
          title: customTitle ?? aiDraft.title,
          generatedFrom: customGeneratedFrom ?? aiDraft.generatedFrom,
          questions: customQuestions,
        }
      : {
          ...aiDraft,
          title: customTitle ?? aiDraft.title,
          generatedFrom: customGeneratedFrom ?? aiDraft.generatedFrom,
        }
    const now = new Date().toISOString()
    const record: AssessmentRecord = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      title: draft.title,
      kind: 'practice',
      mode,
      status: 'draft',
      source: draft.source,
      generatedFrom: draft.generatedFrom,
      applicationId: null,
      jobId: job?.id ?? null,
      jobTitle: job?.title ?? null,
      company: job?.company ?? null,
      resumeId: resume?.id ?? null,
      candidateUserId: user.id,
      candidateName: resume?.contact.name ?? user.name,
      candidateEmail: resume?.contact.email ?? user.email,
      recruiterUserId: null,
      recruiterName: null,
      assignedAt: now,
      questions: draft.questions,
      answers: buildEmptyAnswers(draft),
      summary: buildSummary('practice'),
    }

    await addAssessmentRecord(record)
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create assessment.'
    return NextResponse.json({ error: localizeAssessmentError(message) }, { status: statusForMessage(message) })
  }
}
