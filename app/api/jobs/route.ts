import { NextResponse } from 'next/server'

import {
  isAuthErrorMessage,
  isPermissionErrorMessage,
  requireUserRoles,
} from '@/lib/server/auth-helpers'
import { addJob, listJobs, listJobsByOwner, listPublishedJobs } from '@/lib/server/job-store'
import { normalizeCityLocation } from '@/lib/location'
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

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeNullableString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode')
    const scope = url.searchParams.get('scope')

    if (scope === 'mine') {
      const { user } = await requireUserRoles(request, ['recruiter', 'admin'])
      const records = user.role === 'admin' ? await listJobs() : await listJobsByOwner(user.id)
      return NextResponse.json(records)
    }

    if (mode === 'published') {
      return NextResponse.json(await listPublishedJobs())
    }

    const { user } = await requireUserRoles(request, ['recruiter', 'admin'])
    const records = user.role === 'admin' ? await listJobs() : await listJobsByOwner(user.id)
    return NextResponse.json(records)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load jobs.'
    const status = isAuthErrorMessage(message) ? 401 : isPermissionErrorMessage(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUserRoles(request, ['recruiter', 'admin'])
    const body = (await request.json()) as Record<string, unknown>

    if (typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'Job title is required.' }, { status: 400 })
    }

    if (typeof body.company !== 'string' || !body.company.trim()) {
      return NextResponse.json({ error: 'Company name is required.' }, { status: 400 })
    }

    if (typeof body.description !== 'string' || !body.description.trim()) {
      return NextResponse.json({ error: 'Job description is required.' }, { status: 400 })
    }

    if (!isJobType(body.type)) {
      return NextResponse.json({ error: 'Valid job type is required.' }, { status: 400 })
    }

    if (!isLocationMode(body.locationMode)) {
      return NextResponse.json({ error: 'Valid location mode is required.' }, { status: 400 })
    }

    if (!isSeniority(body.seniority)) {
      return NextResponse.json({ error: 'Valid seniority is required.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const status = isStatus(body.status) ? body.status : 'draft'
    const salaryMin = typeof body.salaryMin === 'number' ? body.salaryMin : Number(body.salaryMin ?? 0)
    const salaryMax = typeof body.salaryMax === 'number' ? body.salaryMax : Number(body.salaryMax ?? 0)
    const minYearsExperience =
      typeof body.minYearsExperience === 'number'
        ? body.minYearsExperience
        : Number(body.minYearsExperience ?? 0)

    const record: JobRecord = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ownerUserId: user.id,
      ownerName: user.name,
      ownerEmail: user.email,
      title: body.title.trim(),
      company: body.company.trim(),
      companyTagline: typeof body.companyTagline === 'string' ? body.companyTagline.trim() : '',
      status,
      contactEmail: normalizeNullableString(body.contactEmail) ?? user.email,
      location: normalizeCityLocation(typeof body.location === 'string' ? body.location : null) ?? '远程',
      locationMode: body.locationMode,
      salaryMin: Number.isFinite(salaryMin) ? Math.max(0, Math.round(salaryMin)) : 0,
      salaryMax: Number.isFinite(salaryMax) ? Math.max(0, Math.round(salaryMax)) : 0,
      currency: body.currency === 'USD' ? 'USD' : 'CNY',
      type: body.type,
      postedAt: now,
      industries: normalizeStringArray(body.industries),
      requiredSkills: normalizeStringArray(body.requiredSkills),
      preferredSkills: normalizeStringArray(body.preferredSkills),
      minYearsExperience: Number.isFinite(minYearsExperience) ? Math.max(0, Math.round(minYearsExperience)) : 0,
      seniority: body.seniority,
      description: body.description.trim(),
      highlights: normalizeStringArray(body.highlights),
    }

    await addJob(record)
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create job.'
    const status = isAuthErrorMessage(message) ? 401 : isPermissionErrorMessage(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
