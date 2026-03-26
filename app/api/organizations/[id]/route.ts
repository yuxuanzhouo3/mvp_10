import { NextResponse } from 'next/server'

import { buildOrganizationNextAction } from '@/lib/server/organization-defaults'
import {
  getOrganizationLeadById,
  updateOrganizationLead,
} from '@/lib/server/organization-store'
import type {
  OrganizationContactInfo,
  OrganizationLead,
  OrganizationStage,
} from '@/types/organization'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STAGES: OrganizationStage[] = [
  'new',
  'qualified',
  'invited',
  'responded',
  'onboarded',
  'rejected',
]
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isStage(value: unknown): value is OrganizationStage {
  return typeof value === 'string' && STAGES.includes(value as OrganizationStage)
}

function normalizeNullableString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isContactPatch(
  value: unknown
): value is Partial<Record<keyof OrganizationContactInfo, unknown>> {
  return typeof value === 'object' && value !== null
}

function buildSummary(record: OrganizationLead) {
  const channels = [
    record.contact.email ? 'email' : null,
    record.contact.phone ? 'phone' : null,
    record.website ? 'website' : null,
  ]
    .filter(Boolean)
    .join(', ')

  return `${record.companyName} lead is currently in ${record.workflow.stage} with ${channels || 'limited public contact details'}.`
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const record = await getOrganizationLeadById(params.id)

  if (!record) {
    return NextResponse.json({ error: 'Organization lead not found.' }, { status: 404 })
  }

  return NextResponse.json(record)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as {
      companyName?: unknown
      website?: unknown
      stage?: unknown
      notes?: unknown
      recommendedNextAction?: unknown
      contact?: unknown
      publicText?: unknown
    }

    const updatedRecord = await updateOrganizationLead(params.id, (record) => {
      const contactPatch = isContactPatch(body.contact) ? body.contact : null
      const nextContact: OrganizationContactInfo = {
        contactName:
          contactPatch && 'contactName' in contactPatch
            ? normalizeNullableString(contactPatch.contactName)
            : record.contact.contactName,
        email:
          contactPatch && 'email' in contactPatch
            ? normalizeNullableString(contactPatch.email)
            : record.contact.email,
        phone:
          contactPatch && 'phone' in contactPatch
            ? normalizeNullableString(contactPatch.phone)
            : record.contact.phone,
        location:
          contactPatch && 'location' in contactPatch
            ? normalizeNullableString(contactPatch.location)
            : record.contact.location,
      }

      if (nextContact.email && !EMAIL_PATTERN.test(nextContact.email)) {
        throw new Error('Please enter a valid employer email address.')
      }

      const nextRecord: OrganizationLead = {
        ...record,
        companyName:
          typeof body.companyName === 'string' && body.companyName.trim()
            ? body.companyName.trim()
            : record.companyName,
        website:
          typeof body.website === 'string' && body.website.trim()
            ? body.website.trim()
            : body.website === ''
              ? null
              : record.website,
        publicText:
          typeof body.publicText === 'string' ? body.publicText : record.publicText,
        contact: nextContact,
        workflow: {
          ...record.workflow,
          stage: isStage(body.stage) ? body.stage : record.workflow.stage,
          notes: typeof body.notes === 'string' ? body.notes : record.workflow.notes,
          recommendedNextAction:
            typeof body.recommendedNextAction === 'string'
              ? body.recommendedNextAction
              : buildOrganizationNextAction(nextContact),
          lastUpdatedAt: new Date().toISOString(),
        },
      }

      return {
        ...nextRecord,
        summary: buildSummary(nextRecord),
      }
    })

    if (!updatedRecord) {
      return NextResponse.json({ error: 'Organization lead not found.' }, { status: 404 })
    }

    return NextResponse.json(updatedRecord)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Organization lead update failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
