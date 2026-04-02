import { NextResponse } from 'next/server'

import { getApplicationById, listApplicationsByJobId, updateApplication } from '@/lib/server/application-store'
import {
  isAuthErrorMessage,
  isPermissionErrorMessage,
  requireUserRoles,
} from '@/lib/server/auth-helpers'
import { getJobById } from '@/lib/server/job-store'
import { generateRecruiterScreeningRecord } from '@/lib/server/recruiter-screening'
import {
  findRecruiterScreeningByJobAndResume,
  listRecruiterScreeningsByRecruiter,
  saveRecruiterScreening,
} from '@/lib/server/recruiter-screening-store'
import { getResumeRecordById, listResumeRecords } from '@/lib/server/resume-store'
import type { AppUser, UserRole } from '@/types/auth'
import type { JobRecord } from '@/types/job'
import type { ResumeRecord } from '@/types/resume'
import type { RecruiterScreeningRecord } from '@/types/screening'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeEmail(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function canManageJob(userId: string, role: UserRole, ownerUserId: string | null | undefined) {
  return role === 'admin' || !ownerUserId || ownerUserId === userId
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

  if (isPermissionErrorMessage(message) || message === 'User does not have permission.') {
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
    message === 'Candidate has not linked a resume yet.' ||
    message === 'The selected resume does not belong to this candidate.' ||
    message === 'Application id is required.'
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

function localizeError(message: string) {
  switch (message) {
    case 'Authentication token is missing.':
      return '请先登录后再继续。'
    case 'Session is invalid or expired.':
      return '登录状态已失效，请重新登录。'
    case 'User does not have permission.':
      return '你没有权限执行这个操作。'
    case 'Application not found.':
      return '候选人投递记录不存在。'
    case 'Job not found.':
      return '岗位不存在。'
    case 'Resume not found.':
      return '候选人的有效简历不存在。'
    case 'Candidate has not linked a resume yet.':
      return '当前候选人还没有绑定简历。'
    case 'The selected resume does not belong to this candidate.':
      return '当前选择的简历不属于这位候选人。'
    case 'Application id is required.':
      return '请先选择候选人后再执行 AI 初筛。'
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

async function resolveScreeningContext(params: {
  user: AppUser
  applicationId?: string | null
  jobId?: string | null
  resumeId?: string | null
}) {
  if (params.applicationId) {
    const application = await getApplicationById(params.applicationId)

    if (!application) {
      throw new Error('Application not found.')
    }

    const job = await getJobById(application.jobId)

    if (!job) {
      throw new Error('Job not found.')
    }

    if (!canManageJob(params.user.id, params.user.role, job.ownerUserId)) {
      throw new Error('User does not have permission.')
    }

    const resume = await resolveBestResumeForApplication(application, params.resumeId ?? application.resumeId ?? null)
    if (!resume) {
      throw new Error('Candidate has not linked a resume yet.')
    }

    return { job, application, resume }
  }

  if (!params.jobId || !params.resumeId) {
    throw new Error('Application id is required.')
  }

  const job = await getJobById(params.jobId)
  if (!job) {
    throw new Error('Job not found.')
  }

  if (!canManageJob(params.user.id, params.user.role, job.ownerUserId)) {
    throw new Error('User does not have permission.')
  }

  const resume = await getResumeRecordById(params.resumeId)
  if (!resume) {
    throw new Error('Resume not found.')
  }

  const applications = await listApplicationsByJobId(job.id)
  const application =
    applications.find((item) => item.resumeId === resume.id) ??
    applications.find((item) => normalizeEmail(item.userEmail) === normalizeEmail(resume.contact.email))

  return { job, application: application ?? null, resume }
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUserRoles(request, ['recruiter', 'admin'])
    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')

    let records = await listRecruiterScreeningsByRecruiter(user.id)

    if (jobId) {
      records = records.filter((record) => record.jobId === jobId)
    }

    return NextResponse.json(records)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load recruiter screenings.'
    return NextResponse.json({ error: localizeError(message) }, { status: statusForMessage(message) })
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUserRoles(request, ['recruiter', 'admin'])
    const body = (await request.json()) as {
      applicationId?: unknown
      jobId?: unknown
      resumeId?: unknown
      requireAi?: unknown
    }

    const { job, application, resume } = await resolveScreeningContext({
      user,
      applicationId: typeof body.applicationId === 'string' && body.applicationId.trim() ? body.applicationId : null,
      jobId: typeof body.jobId === 'string' && body.jobId.trim() ? body.jobId : null,
      resumeId: typeof body.resumeId === 'string' && body.resumeId.trim() ? body.resumeId : null,
    })

    const existing = await findRecruiterScreeningByJobAndResume(user.id, job.id, resume.id)
    const record: RecruiterScreeningRecord = await generateRecruiterScreeningRecord({
      job,
      application,
      resume,
      recruiter: user,
      existingId: existing?.id ?? null,
      createdAt: existing?.createdAt,
      requireAiQuestions: body.requireAi === true,
    })

    await saveRecruiterScreening(record)

    if (application) {
      await updateApplication(application.id, (current) => ({
        ...current,
        stage: current.stage === 'applied' ? 'screening' : current.stage,
        resumeId: resume.id,
        notes: record.summary,
        updatedAt: new Date().toISOString(),
      }))
    }

    return NextResponse.json(record, { status: existing ? 200 : 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create recruiter screening.'
    return NextResponse.json({ error: localizeError(message) }, { status: statusForMessage(message) })
  }
}
