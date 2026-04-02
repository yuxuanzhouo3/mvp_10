import { NextResponse } from 'next/server'

import {
  addApplication,
  findApplicationByUserAndJob,
  listApplications,
  listApplicationsByJobId,
  listApplicationsByUserId,
  updateApplication,
} from '@/lib/server/application-store'
import {
  isAuthErrorMessage,
  isPermissionErrorMessage,
  requireAuthenticatedUser,
  requireUserRoles,
} from '@/lib/server/auth-helpers'
import { findBestResumeForUser } from '@/lib/server/job-matching'
import { getJobById, listJobsByOwner } from '@/lib/server/job-store'
import { listResumeRecordsByOwner } from '@/lib/server/resume-store'
import type { ApplicationRecord } from '@/types/application'
import type { AppUser, UserRole } from '@/types/auth'
import type { JobRecord } from '@/types/job'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function canManageJob(user: Pick<AppUser, 'id' | 'role'>, job: JobRecord) {
  return user.role === 'admin' || !job.ownerUserId || job.ownerUserId === user.id
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

    const { user } = await requireUserRoles(request, ['recruiter', 'admin'])

    if (jobId) {
      const job = await getJobById(jobId)

      if (!job) {
        return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
      }

      if (!canManageJob(user, job)) {
        return NextResponse.json({ error: 'User does not have permission.' }, { status: 403 })
      }

      return NextResponse.json(await listApplicationsByJobId(jobId))
    }

    if (user.role === 'admin') {
      return NextResponse.json(await listApplications())
    }

    const jobs = await listJobsByOwner(user.id)
    const jobIds = new Set(jobs.map((job) => job.id))
    const records = await listApplications()
    return NextResponse.json(records.filter((record) => jobIds.has(record.jobId)))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load applications.'
    const status = isAuthErrorMessage(message) ? 401 : isPermissionErrorMessage(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const body = (await request.json()) as {
      jobId?: unknown
      matchScore?: unknown
    }

    if (user.role !== 'candidate') {
      return NextResponse.json({ error: 'Only candidates can apply for jobs.' }, { status: 403 })
    }

    if (typeof body.jobId !== 'string' || !body.jobId.trim()) {
      return NextResponse.json({ error: 'Job id is required.' }, { status: 400 })
    }

    const job = await getJobById(body.jobId)
    if (!job || job.status !== 'published') {
      return NextResponse.json({ error: 'Published job not found.' }, { status: 404 })
    }

    const resumes = await listResumeRecordsByOwner(user.id)
    const bestResume = findBestResumeForUser(user, resumes)

    if (!bestResume) {
      return NextResponse.json({ error: 'Please upload your resume before applying.' }, { status: 400 })
    }

    const existing = await findApplicationByUserAndJob(user.id, job.id)
    const now = new Date().toISOString()
    const nextMatchScore = typeof body.matchScore === 'number' ? Math.round(body.matchScore) : 0

    if (existing) {
      const reactivated = await updateApplication(existing.id, (record) => ({
        ...record,
        stage: 'applied',
        updatedAt: now,
        resumeId: bestResume.id,
        matchScore: nextMatchScore || record.matchScore,
      }))

      return NextResponse.json(reactivated)
    }

    const record: ApplicationRecord = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      resumeId: bestResume.id,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      stage: 'applied',
      matchScore: nextMatchScore,
      notes: '',
    }

    await addApplication(record)
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create application.'
    const status = isAuthErrorMessage(message) ? 401 : isPermissionErrorMessage(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
