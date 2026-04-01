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
    return NextResponse.json({ error: '未找到对应的简历记录。' }, { status: 404 })
  }

  if (!record.contact.email) {
    return NextResponse.json(
      { error: '发送回执前需要先填写候选人邮箱。' },
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
            ? '等待候选人回复后，再安排筛选沟通、微信或飞书跟进。'
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
            title: delivery.mode === 'smtp' ? '候选人回执邮件已发送' : '候选人回执邮件预览稿已生成',
            description:
              delivery.mode === 'smtp'
                ? '系统已向候选人发送简历回执邮件。'
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
    const message = error instanceof Error ? error.message : '回执邮件发送失败。'

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
            title: '候选人回执邮件发送失败',
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
