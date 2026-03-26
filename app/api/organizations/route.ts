import { NextResponse } from 'next/server'

import {
  analyzeOrganizationLeadText,
  buildManualOrganizationLead,
} from '@/lib/server/organization-analysis'
import {
  buildDefaultOrganizationCommunication,
  buildDefaultOrganizationWorkflow,
} from '@/lib/server/organization-defaults'
import { addOrganizationLead, listOrganizationLeads } from '@/lib/server/organization-store'
import type { OrganizationLead, OrganizationLeadSource } from '@/types/organization'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const records = await listOrganizationLeads()
  return NextResponse.json(records)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      companyName?: unknown
      publicText?: unknown
      source?: unknown
    }

    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : ''
    const publicText = typeof body.publicText === 'string' ? body.publicText.trim() : ''
    const source: OrganizationLeadSource =
      body.source === 'manual' || body.source === 'public_text' ? body.source : 'manual'

    if (!companyName && !publicText) {
      return NextResponse.json(
        { error: 'Provide a company name or paste public contact text.' },
        { status: 400 }
      )
    }

    const createdAt = new Date().toISOString()
    const id = crypto.randomUUID()
    const analysis =
      source === 'public_text' || publicText
        ? analyzeOrganizationLeadText(publicText, companyName || null)
        : buildManualOrganizationLead(companyName)

    const record: OrganizationLead = {
      id,
      createdAt,
      source: publicText ? 'public_text' : source,
      companyName: analysis.companyName,
      website: analysis.website,
      publicText: analysis.publicText,
      summary: analysis.summary,
      contact: analysis.contact,
      workflow: buildDefaultOrganizationWorkflow({
        contact: analysis.contact,
        createdAt,
      }),
      communication: buildDefaultOrganizationCommunication(),
    }

    await addOrganizationLead(record)
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Organization lead creation failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
