import { NextResponse } from 'next/server'

import { getApplicationById, updateApplication } from '@/lib/server/application-store'
import type { ApplicationStage } from '@/types/application'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STAGES: ApplicationStage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn']

function isStage(value: unknown): value is ApplicationStage {
  return typeof value === 'string' && STAGES.includes(value as ApplicationStage)
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const record = await getApplicationById(params.id)

  if (!record) {
    return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
  }

  return NextResponse.json(record)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as {
      stage?: unknown
      notes?: unknown
    }

    const updated = await updateApplication(params.id, (record) => ({
      ...record,
      stage: isStage(body.stage) ? body.stage : record.stage,
      notes: typeof body.notes === 'string' ? body.notes : record.notes,
      updatedAt: new Date().toISOString(),
    }))

    if (!updated) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Application update failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
