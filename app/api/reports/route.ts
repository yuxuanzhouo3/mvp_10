import { NextResponse } from 'next/server'

import { addModerationReport, listModerationReports } from '@/lib/server/report-store'
import type { ModerationReport, ModerationSubjectType } from '@/types/report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUBJECT_TYPES: ModerationSubjectType[] = [
  'candidate',
  'employer',
  'interviewer',
  'job',
  'platform',
  'other',
]
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isSubjectType(value: unknown): value is ModerationSubjectType {
  return typeof value === 'string' && SUBJECT_TYPES.includes(value as ModerationSubjectType)
}

export async function GET() {
  const reports = await listModerationReports()
  return NextResponse.json(reports)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      subjectType?: unknown
      subjectId?: unknown
      reporterName?: unknown
      reporterEmail?: unknown
      reason?: unknown
      details?: unknown
    }

    if (typeof body.reason !== 'string' || !body.reason.trim()) {
      return NextResponse.json({ error: 'Report reason is required.' }, { status: 400 })
    }

    if (typeof body.details !== 'string' || !body.details.trim()) {
      return NextResponse.json({ error: 'Report details are required.' }, { status: 400 })
    }

    const reporterEmail =
      typeof body.reporterEmail === 'string' && body.reporterEmail.trim()
        ? body.reporterEmail.trim()
        : null

    if (reporterEmail && !EMAIL_PATTERN.test(reporterEmail)) {
      return NextResponse.json({ error: 'Please enter a valid reporter email.' }, { status: 400 })
    }

    const createdAt = new Date().toISOString()
    const report: ModerationReport = {
      id: crypto.randomUUID(),
      createdAt,
      updatedAt: createdAt,
      subjectType: isSubjectType(body.subjectType) ? body.subjectType : 'other',
      subjectId:
        typeof body.subjectId === 'string' && body.subjectId.trim() ? body.subjectId.trim() : null,
      reporterName:
        typeof body.reporterName === 'string' && body.reporterName.trim()
          ? body.reporterName.trim()
          : null,
      reporterEmail,
      reason: body.reason.trim(),
      details: body.details.trim(),
      status: 'open',
      resolutionNotes: '',
    }

    await addModerationReport(report)
    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Report creation failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
