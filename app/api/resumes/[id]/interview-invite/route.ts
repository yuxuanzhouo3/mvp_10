import { NextResponse } from 'next/server'

import { sendInterviewInviteEmail } from '@/lib/server/interview-invite-email'
import { createTimelineEvent, syncCandidateTasks } from '@/lib/server/resume-defaults'
import { getResumeRecordById, updateResumeRecord } from '@/lib/server/resume-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function canSendInterviewInvite(stage: string) {
  return stage === 'new' || stage === 'screening' || stage === 'interview'
}

function nextStage(currentStage: string) {
  if (currentStage === 'new' || currentStage === 'screening') {
    return 'interview' as const
  }

  return 'interview' as const
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const record = await getResumeRecordById(params.id)

  if (!record) {
    return NextResponse.json({ error: 'Resume record not found.' }, { status: 404 })
  }

  if (!record.contact.email) {
    return NextResponse.json(
      { error: 'Candidate email is required before sending an interview invite.' },
      { status: 400 }
    )
  }

  if (!canSendInterviewInvite(record.workflow.stage)) {
    return NextResponse.json(
      { error: 'This candidate is not in a stage that should receive an interview invite.' },
      { status: 400 }
    )
  }

  const attemptedAt = new Date().toISOString()

  try {
    const delivery = await sendInterviewInviteEmail(record)
    const updatedRecord = await updateResumeRecord(params.id, (current) => {
      const stage = nextStage(current.workflow.stage)
      const workflow = {
        ...current.workflow,
        stage,
        reviewStatus: 'reviewed' as const,
        outreachStatus: delivery.mode === 'smtp' ? ('contacted' as const) : current.workflow.outreachStatus,
        recommendedNextAction:
          delivery.mode === 'smtp'
            ? 'Wait for the candidate reply, confirm the interview slot, and continue follow-up in email, WeChat, or Feishu.'
            : 'Interview invite preview generated. Deliver it manually, then mark the candidate as contacted.',
        lastUpdatedAt: attemptedAt,
      }
      const communication = {
        ...current.communication,
        interviewInviteEmailStatus: delivery.mode === 'smtp' ? ('sent' as const) : ('preview' as const),
        interviewInviteEmailCount: current.communication.interviewInviteEmailCount + 1,
        interviewInviteEmailLastAttemptAt: attemptedAt,
        interviewInviteEmailSentAt:
          delivery.mode === 'smtp' ? attemptedAt : current.communication.interviewInviteEmailSentAt,
        interviewInviteEmailLastError: null,
      }
      const nextRecord = {
        ...current,
        workflow,
        communication,
      }

      return {
        ...nextRecord,
        tasks: syncCandidateTasks(nextRecord, current.tasks),
        timeline: [
          ...current.timeline,
          ...(current.workflow.stage !== stage
            ? [
                createTimelineEvent({
                  type: 'workflow_updated',
                  actor: 'system',
                  title: 'Candidate moved to interview stage',
                  description: 'The recruiter initiated the interview outreach step.',
                  createdAt: attemptedAt,
                }),
              ]
            : []),
          createTimelineEvent({
            type: 'interview_invite_sent',
            actor: 'system',
            title:
              delivery.mode === 'smtp'
                ? 'Interview invite email sent'
                : 'Interview invite preview generated',
            description:
              delivery.mode === 'smtp'
                ? 'The platform emailed the candidate with scheduling and opt-in contact options.'
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
    const message = error instanceof Error ? error.message : 'Interview invite failed.'

    const updatedRecord = await updateResumeRecord(params.id, (current) => {
      const communication = {
        ...current.communication,
        interviewInviteEmailStatus: 'failed' as const,
        interviewInviteEmailCount: current.communication.interviewInviteEmailCount + 1,
        interviewInviteEmailLastAttemptAt: attemptedAt,
        interviewInviteEmailLastError: message,
      }
      const nextRecord = {
        ...current,
        communication,
      }

      return {
        ...nextRecord,
        tasks: syncCandidateTasks(nextRecord, current.tasks),
        timeline: [
          ...current.timeline,
          createTimelineEvent({
            type: 'interview_invite_failed',
            actor: 'system',
            title: 'Interview invite delivery failed',
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
