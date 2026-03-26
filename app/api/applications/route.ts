import { NextResponse } from 'next/server'

import { requireAuthenticatedUser } from '@/lib/server/auth-helpers'
import { findApplicationByUserAndJob, listApplications, listApplicationsByJobId, listApplicationsByUserId, addApplication, updateApplication } from '@/lib/server/application-store'
import { findBestResumeForUser } from '@/lib/server/job-matching'
import { getJobById } from '@/lib/server/job-store'
import { listResumeRecords } from '@/lib/server/resume-store'
import type { ApplicationRecord, ApplicationStage } from '@/types/application'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STAGES: ApplicationStage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn']

function isStage(value: unknown): value is ApplicationStage {
  return typeof value === 'string' && STAGES.includes(value as ApplicationStage)
}

function isAuthError(message: string) {
  return message === 'Authentication token is missing.' || message === 'Session is invalid or expired.'
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope')
    const jobId = url.searchParams.get('jobId')

    if (scope === 'me') {
      const { user } = await requireAuthenticatedUser(request)
      const records = await listApplicationsByUserId(user.id)
      return NextResponse.json(records)
    }

    if (jobId) {
      const records = await listApplicationsByJobId(jobId)
      return NextResponse.json(records)
    }

    const records = await listApplications()
    return NextResponse.json(records)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load applications.'
    return NextResponse.json(
      { error: message },
      { status: isAuthError(message) ? 401 : 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const body = (await request.json()) as {
      jobId?: unknown
      matchScore?: unknown
    }

    if (typeof body.jobId !== 'string' || !body.jobId.trim()) {
      return NextResponse.json({ error: 'Job id is required.' }, { status: 400 })
    }

    const job = await getJobById(body.jobId)
    if (!job || job.status !== 'published') {
      return NextResponse.json({ error: 'Published job not found.' }, { status: 404 })
    }

    const existing = await findApplicationByUserAndJob(user.id, job.id)
    const now = new Date().toISOString()

    if (existing) {
      const reactivated = await updateApplication(existing.id, (record) => ({
        ...record,
        stage: 'applied',
        updatedAt: now,
        matchScore: typeof body.matchScore === 'number' ? Math.round(body.matchScore) : record.matchScore,
      }))

      return NextResponse.json(reactivated)
    }

    const resumes = await listResumeRecords()
    const bestResume = findBestResumeForUser(user, resumes)
    const record: ApplicationRecord = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      resumeId: bestResume?.id ?? null,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      stage: 'applied',
      matchScore: typeof body.matchScore === 'number' ? Math.round(body.matchScore) : 0,
      notes: '',
    }

    await addApplication(record)
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create application.'
    return NextResponse.json(
      { error: message },
      { status: isAuthError(message) ? 401 : 500 }
    )
  }
}
