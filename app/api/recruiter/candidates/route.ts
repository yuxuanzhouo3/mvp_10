import { NextResponse } from 'next/server'

import { listApplicationsByJobId } from '@/lib/server/application-store'
import {
  isAuthErrorMessage,
  isPermissionErrorMessage,
  requireUserRoles,
} from '@/lib/server/auth-helpers'
import { listAssessmentRecords } from '@/lib/server/assessment-store'
import { getJobById } from '@/lib/server/job-store'
import { listRecruiterScreeningsByRecruiter } from '@/lib/server/recruiter-screening-store'
import { listResumeRecords, toResumeListItem } from '@/lib/server/resume-store'
import type { UserRole } from '@/types/auth'
import type { ResumeRecord } from '@/types/resume'
import type { RecruiterCandidateRecord } from '@/types/recruiter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeEmail(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function canManageJob(userId: string, role: UserRole, ownerUserId: string | null | undefined) {
  return role === 'admin' || !ownerUserId || ownerUserId === userId
}

function resumeBelongsToCandidate(resume: ResumeRecord, userId: string, email: string) {
  if (resume.ownerUserId) {
    return resume.ownerUserId === userId
  }

  const candidateEmail = normalizeEmail(email)
  return [resume.ownerEmail, resume.contact.email].some((value) => normalizeEmail(value) === candidateEmail)
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUserRoles(request, ['recruiter', 'admin'])
    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json({ error: 'Job id is required.' }, { status: 400 })
    }

    const job = await getJobById(jobId)
    if (!job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    }

    if (!canManageJob(user.id, user.role, job.ownerUserId)) {
      return NextResponse.json({ error: 'User does not have permission.' }, { status: 403 })
    }

    const [applications, resumes, screenings, assessments] = await Promise.all([
      listApplicationsByJobId(jobId),
      listResumeRecords(),
      listRecruiterScreeningsByRecruiter(user.id),
      listAssessmentRecords(),
    ])

    const screeningMap = new Map<string, (typeof screenings)[number]>()
    screenings
      .filter((record) => record.jobId === jobId)
      .forEach((record) => {
        const key = record.applicationId ?? `${record.jobId}:${record.resumeId}`
        if (!screeningMap.has(key)) {
          screeningMap.set(key, record)
        }
      })

    const assessmentMap = new Map<string, (typeof assessments)[number]>()
    assessments
      .filter(
        (record) =>
          record.jobId === jobId &&
          record.kind === 'recruiter_assigned' &&
          (user.role === 'admin' || record.recruiterUserId === user.id)
      )
      .forEach((record) => {
        const key = record.applicationId ?? `${record.jobId}:${record.resumeId}`
        if (!assessmentMap.has(key)) {
          assessmentMap.set(key, record)
        }
      })

    const payload: RecruiterCandidateRecord[] = applications.map((application) => {
      const availableResumes = resumes
        .filter((resume) => resumeBelongsToCandidate(resume, application.userId, application.userEmail))
        .map(toResumeListItem)
      const selectedResume =
        availableResumes.find((resume) => resume.id === application.resumeId) ?? availableResumes[0] ?? null
      const key = application.id
      const fallbackKey = `${application.jobId}:${selectedResume?.id ?? application.resumeId ?? ''}`

      return {
        application,
        selectedResume,
        availableResumes,
        screening: screeningMap.get(key) ?? screeningMap.get(fallbackKey) ?? null,
        latestAssessment: assessmentMap.get(key) ?? assessmentMap.get(fallbackKey) ?? null,
      }
    })

    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load recruiter candidates.'
    const status = isAuthErrorMessage(message) ? 401 : isPermissionErrorMessage(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
