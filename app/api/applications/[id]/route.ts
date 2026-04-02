import { NextResponse } from 'next/server'

import { getApplicationById, updateApplication } from '@/lib/server/application-store'
import {
  isAuthErrorMessage,
  isPermissionErrorMessage,
  requireAuthenticatedUser,
} from '@/lib/server/auth-helpers'
import { getJobById } from '@/lib/server/job-store'
import { getResumeRecordById } from '@/lib/server/resume-store'
import type { ApplicationStage } from '@/types/application'
import type { AppUser, UserRole } from '@/types/auth'
import type { JobRecord } from '@/types/job'
import type { ResumeRecord } from '@/types/resume'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STAGES: ApplicationStage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn']

function isStage(value: unknown): value is ApplicationStage {
  return typeof value === 'string' && STAGES.includes(value as ApplicationStage)
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

async function getAccessContext(user: AppUser, applicationId: string) {
  const application = await getApplicationById(applicationId)

  if (!application) {
    return { application: null, job: null }
  }

  const job = await getJobById(application.jobId)
  return { application, job }
}

function canAccessApplication(user: AppUser, ownerUserId: string, job: JobRecord | null) {
  if (user.role === 'admin') {
    return true
  }

  if (user.role === 'candidate') {
    return user.id === ownerUserId
  }

  return job ? canManageJob(user, job) : false
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { application, job } = await getAccessContext(user, params.id)

    if (!application) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
    }

    if (!canAccessApplication(user, application.userId, job)) {
      return NextResponse.json({ error: 'User does not have permission.' }, { status: 403 })
    }

    return NextResponse.json(application)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load application.'
    const status = isAuthErrorMessage(message) ? 401 : isPermissionErrorMessage(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { application: existing, job } = await getAccessContext(user, params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
    }

    if (!canAccessApplication(user, existing.userId, job)) {
      return NextResponse.json({ error: 'User does not have permission.' }, { status: 403 })
    }

    const body = (await request.json()) as {
      stage?: unknown
      notes?: unknown
      resumeId?: unknown
    }

    if (user.role === 'candidate') {
      if (body.resumeId !== undefined) {
        return NextResponse.json({ error: 'Candidates cannot change the linked resume here.' }, { status: 403 })
      }

      if (body.notes !== undefined) {
        return NextResponse.json({ error: 'Candidates cannot edit recruiter notes.' }, { status: 403 })
      }

      if (body.stage !== undefined && body.stage !== 'withdrawn') {
        return NextResponse.json({ error: 'Candidates can only withdraw their application.' }, { status: 403 })
      }
    }

    let nextResumeId = existing.resumeId

    if (typeof body.resumeId === 'string' && body.resumeId.trim()) {
      const resume = await getResumeRecordById(body.resumeId)

      if (!resume) {
        return NextResponse.json({ error: 'Selected resume not found.' }, { status: 404 })
      }

      if (!canUseResumeForApplication(existing.userId, existing.userEmail, resume)) {
        return NextResponse.json({ error: 'The selected resume does not belong to this candidate.' }, { status: 400 })
      }

      nextResumeId = resume.id
    }

    const updated = await updateApplication(params.id, (record) => ({
      ...record,
      stage: isStage(body.stage) ? body.stage : record.stage,
      notes: typeof body.notes === 'string' ? body.notes : record.notes,
      resumeId: nextResumeId,
      updatedAt: new Date().toISOString(),
    }))

    if (!updated) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Application update failed.'
    const status = isAuthErrorMessage(message) ? 401 : isPermissionErrorMessage(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
