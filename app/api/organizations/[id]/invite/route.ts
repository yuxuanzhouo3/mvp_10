import { NextResponse } from 'next/server'

import { sendOrganizationInviteEmail } from '@/lib/server/organization-email'
import {
  getOrganizationLeadById,
  updateOrganizationLead,
} from '@/lib/server/organization-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const record = await getOrganizationLeadById(params.id)

  if (!record) {
    return NextResponse.json({ error: 'Organization lead not found.' }, { status: 404 })
  }

  if (!record.contact.email) {
    return NextResponse.json(
      { error: 'Employer email is required before sending an onboarding invite.' },
      { status: 400 }
    )
  }

  const attemptedAt = new Date().toISOString()

  try {
    const delivery = await sendOrganizationInviteEmail(record)
    const updatedRecord = await updateOrganizationLead(params.id, (current) => ({
      ...current,
      workflow: {
        ...current.workflow,
        stage: delivery.mode === 'smtp' ? 'invited' : current.workflow.stage,
        recommendedNextAction:
          delivery.mode === 'smtp'
            ? 'Wait for the employer reply or schedule a product onboarding call.'
            : current.workflow.recommendedNextAction,
        lastUpdatedAt: attemptedAt,
      },
      communication: {
        ...current.communication,
        inviteEmailStatus: delivery.mode === 'smtp' ? 'sent' : 'preview',
        inviteEmailCount: current.communication.inviteEmailCount + 1,
        inviteEmailLastAttemptAt: attemptedAt,
        inviteEmailSentAt: delivery.mode === 'smtp' ? attemptedAt : current.communication.inviteEmailSentAt,
        inviteEmailLastError: null,
      },
    }))

    return NextResponse.json({
      record: updatedRecord,
      delivery,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invite email failed.'

    const updatedRecord = await updateOrganizationLead(params.id, (current) => ({
      ...current,
      communication: {
        ...current.communication,
        inviteEmailStatus: 'failed',
        inviteEmailCount: current.communication.inviteEmailCount + 1,
        inviteEmailLastAttemptAt: attemptedAt,
        inviteEmailLastError: message,
      },
    }))

    return NextResponse.json(
      {
        error: message,
        record: updatedRecord,
      },
      { status: 500 }
    )
  }
}
