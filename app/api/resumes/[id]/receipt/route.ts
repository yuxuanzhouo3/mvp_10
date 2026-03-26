import { NextResponse } from 'next/server'

import { createTimelineEvent, syncCandidateTasks } from '@/lib/server/resume-defaults'
import { getResumeRecordById, updateResumeRecord } from '@/lib/server/resume-store'
import { sendReceiptEmail } from '@/lib/server/receipt-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const record = await getResumeRecordById(params.id)

  if (!record) {
    return NextResponse.json({ error: 'Resume record not found.' }, { status: 404 })
  }

  if (!record.contact.email) {
    return NextResponse.json(
      { error: 'Candidate email is required before sending a receipt.' },
      { status: 400 }
    )
  }

  const attemptedAt = new Date().toISOString()

  try {
    const delivery = await sendReceiptEmail(record)
    const updatedRecord = await updateResumeRecord(params.id, (current) => {
      const workflow = {
        ...current.workflow,
        outreachStatus: delivery.mode === 'smtp' ? 'contacted' : current.workflow.outreachStatus,
        recommendedNextAction:
          delivery.mode === 'smtp'
            ? 'Wait for candidate reply, then arrange screening, WeChat, or Feishu interview follow-up.'
            : current.workflow.recommendedNextAction,
        lastUpdatedAt: attemptedAt,
      }
      const communication = {
        ...current.communication,
        receiptEmailStatus: delivery.mode === 'smtp' ? ('sent' as const) : ('preview' as const),
        receiptEmailCount: current.communication.receiptEmailCount + 1,
        receiptEmailLastAttemptAt: attemptedAt,
        receiptEmailSentAt: delivery.mode === 'smtp' ? attemptedAt : current.communication.receiptEmailSentAt,
        receiptEmailLastError: null,
      }
      const baseRecord = {
        ...current,
        workflow,
        communication,
      }

      return {
        ...baseRecord,
        tasks: syncCandidateTasks(baseRecord, current.tasks),
        timeline: [
          ...current.timeline,
          createTimelineEvent({
            type: 'receipt_sent',
            actor: 'system',
            title: delivery.mode === 'smtp' ? 'Candidate receipt email sent' : 'Candidate receipt email preview generated',
            description:
              delivery.mode === 'smtp'
                ? 'The platform sent the candidate an acknowledgement email.'
                : 'SMTP is not configured, so a preview was generated for manual outreach.',
            createdAt: attemptedAt,
          }),
        ],
      }
    })

    return NextResponse.json({
      record: updatedRecord,
      delivery,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Receipt email failed.'

    const updatedRecord = await updateResumeRecord(params.id, (current) => {
      const communication = {
        ...current.communication,
        receiptEmailStatus: 'failed' as const,
        receiptEmailCount: current.communication.receiptEmailCount + 1,
        receiptEmailLastAttemptAt: attemptedAt,
        receiptEmailLastError: message,
      }
      const baseRecord = {
        ...current,
        communication,
      }

      return {
        ...baseRecord,
        tasks: syncCandidateTasks(baseRecord, current.tasks),
        timeline: [
          ...current.timeline,
          createTimelineEvent({
            type: 'receipt_failed',
            actor: 'system',
            title: 'Candidate receipt delivery failed',
            description: message,
            createdAt: attemptedAt,
          }),
        ],
      }
    })

    return NextResponse.json(
      {
        error: message,
        record: updatedRecord,
      },
      { status: 500 }
    )
  }
}
