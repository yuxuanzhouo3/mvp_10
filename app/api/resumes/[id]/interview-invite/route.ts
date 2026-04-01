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
    return NextResponse.json({ error: '未找到对应的简历记录。' }, { status: 404 })
  }

  if (!record.contact.email) {
    return NextResponse.json(
      { error: '发送面试邀请前需要先填写候选人邮箱。' },
      { status: 400 }
    )
  }

  if (!canSendInterviewInvite(record.workflow.stage)) {
    return NextResponse.json(
      { error: '当前候选人所处阶段不适合发送面试邀请。' },
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
            ? '等待候选人回复，确认面试时间，并继续通过邮件、微信或飞书跟进。'
            : '面试邀请预览稿已生成，请手动发送，并在完成后更新联系状态。',
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
                  title: '候选人已推进到面试阶段',
                  description: '招聘方已启动面试邀请流程。',
                  createdAt: attemptedAt,
                }),
              ]
            : []),
          createTimelineEvent({
            type: 'interview_invite_sent',
            actor: 'system',
            title:
              delivery.mode === 'smtp'
                ? '面试邀请邮件已发送'
                : '面试邀请预览稿已生成',
            description:
              delivery.mode === 'smtp'
                ? '系统已向候选人发送包含排期与可选联系方式的面试邀请。'
                : '当前未配置 SMTP，因此已生成预览稿，需手动发送。',
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
    const message = error instanceof Error ? error.message : '面试邀请发送失败。'

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
            title: '面试邀请发送失败',
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
