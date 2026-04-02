import { NextResponse } from 'next/server'

import {
  isAuthErrorMessage,
  isPermissionErrorMessage,
  requireUserRoles,
} from '@/lib/server/auth-helpers'
import { getJobById, updateJob } from '@/lib/server/job-store'
import { normalizeCityLocation } from '@/lib/location'
import type { UserRole } from '@/types/auth'
import type { JobLocationMode, JobRecord, JobSeniority, JobStatus, JobType } from '@/types/job'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const JOB_TYPES: JobType[] = ['Full-time', 'Part-time', 'Contract', 'Internship']
const LOCATION_MODES: JobLocationMode[] = ['remote', 'hybrid', 'onsite']
const SENIORITIES: JobSeniority[] = ['entry', 'mid', 'senior', 'lead']
const STATUSES: JobStatus[] = ['draft', 'published', 'closed']

function isJobType(value: unknown): value is JobType {
  return typeof value === 'string' && JOB_TYPES.includes(value as JobType)
}

function isLocationMode(value: unknown): value is JobLocationMode {
  return typeof value === 'string' && LOCATION_MODES.includes(value as JobLocationMode)
}

function isSeniority(value: unknown): value is JobSeniority {
  return typeof value === 'string' && SENIORITIES.includes(value as JobSeniority)
}

function isStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && STATUSES.includes(value as JobStatus)
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeNullableString(value: unknown, fallback: string | null) {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function canManageJob(userId: string, role: UserRole, job: JobRecord) {
  return role === 'admin' || !job.ownerUserId || job.ownerUserId === userId
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const record = await getJobById(params.id)

    if (!record) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    }

    if (record.status === 'published') {
      return NextResponse.json(record)
    }

    const { user } = await requireUserRoles(request, ['recruiter', 'admin'])

    if (!canManageJob(user.id, user.role, record)) {
      return NextResponse.json({ error: 'User does not have permission.' }, { status: 403 })
    }

    return NextResponse.json(record)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load job.'
    const status = isAuthErrorMessage(message) ? 401 : isPermissionErrorMessage(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireUserRoles(request, ['recruiter', 'admin'])
    const existing = await getJobById(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    }

    if (!canManageJob(user.id, user.role, existing)) {
      return NextResponse.json({ error: 'User does not have permission.' }, { status: 403 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const updated = await updateJob(params.id, (record) => {
      const nextStatus = isStatus(body.status) ? body.status : record.status
      const now = new Date().toISOString()

      const nextRecord: JobRecord = {
        ...record,
        updatedAt: now,
        ownerUserId: record.ownerUserId ?? user.id,
        ownerName: record.ownerName ?? user.name,
        ownerEmail: record.ownerEmail ?? user.email,
        title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : record.title,
        company: typeof body.company === 'string' && body.company.trim() ? body.company.trim() : record.company,
        companyTagline:
          typeof body.companyTagline === 'string' ? body.companyTagline.trim() : record.companyTagline,
        status: nextStatus,
        contactEmail: normalizeNullableString(body.contactEmail, record.contactEmail),
        location:
          normalizeCityLocation(typeof body.location === 'string' ? body.location : null) ??
          record.location,
        locationMode: isLocationMode(body.locationMode) ? body.locationMode : record.locationMode,
        salaryMin:
          typeof body.salaryMin === 'number' || typeof body.salaryMin === 'string'
            ? Math.max(0, Math.round(Number(body.salaryMin)))
            : record.salaryMin,
        salaryMax:
          typeof body.salaryMax === 'number' || typeof body.salaryMax === 'string'
            ? Math.max(0, Math.round(Number(body.salaryMax)))
            : record.salaryMax,
        currency: body.currency === 'USD' ? 'USD' : body.currency === 'CNY' ? 'CNY' : record.currency,
        type: isJobType(body.type) ? body.type : record.type,
        postedAt: nextStatus === 'published' && record.status !== 'published' ? now : record.postedAt,
        industries: normalizeStringArray(body.industries, record.industries),
        requiredSkills: normalizeStringArray(body.requiredSkills, record.requiredSkills),
        preferredSkills: normalizeStringArray(body.preferredSkills, record.preferredSkills),
        minYearsExperience:
          typeof body.minYearsExperience === 'number' || typeof body.minYearsExperience === 'string'
            ? Math.max(0, Math.round(Number(body.minYearsExperience)))
            : record.minYearsExperience,
        seniority: isSeniority(body.seniority) ? body.seniority : record.seniority,
        description:
          typeof body.description === 'string' && body.description.trim()
            ? body.description.trim()
            : record.description,
        highlights: normalizeStringArray(body.highlights, record.highlights),
      }

      return nextRecord
    })

    if (!updated) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update job.'
    const status = isAuthErrorMessage(message) ? 401 : isPermissionErrorMessage(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
