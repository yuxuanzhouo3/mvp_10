import { NextResponse } from 'next/server'

import { updateModerationReport } from '@/lib/server/report-store'
import type { ModerationReportStatus } from '@/types/report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES: ModerationReportStatus[] = ['open', 'reviewing', 'resolved', 'dismissed']

function isStatus(value: unknown): value is ModerationReportStatus {
  return typeof value === 'string' && STATUSES.includes(value as ModerationReportStatus)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as {
      status?: unknown
      resolutionNotes?: unknown
    }

    const updated = await updateModerationReport(params.id, (record) => ({
      ...record,
      status: isStatus(body.status) ? body.status : record.status,
      resolutionNotes:
        typeof body.resolutionNotes === 'string'
          ? body.resolutionNotes
          : record.resolutionNotes,
      updatedAt: new Date().toISOString(),
    }))

    if (!updated) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Report update failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
