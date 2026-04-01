import { NextResponse } from 'next/server'

import { evaluateAssessmentRecord } from '@/lib/server/assessment-engine'
import { syncAssessmentOutcome } from '@/lib/server/assessment-sync'
import { getAssessmentRecordById, updateAssessmentRecord } from '@/lib/server/assessment-store'
import type { AssessmentAnswer } from '@/types/assessment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAnswerArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value)
}

function normalizeAnswers(
  rawAnswers: Array<Record<string, unknown>>,
  existingAnswers: AssessmentAnswer[]
) {
  const existingMap = new Map(existingAnswers.map((answer) => [answer.questionId, answer]))

  return rawAnswers
    .filter((item) => typeof item.questionId === 'string')
    .map((item) => {
      const existing = existingMap.get(item.questionId as string)
      const rawAudioAsset =
        item.audioAsset && typeof item.audioAsset === 'object'
          ? (item.audioAsset as Record<string, unknown>)
          : null
      return {
        questionId: item.questionId as string,
        answer: typeof item.answer === 'string' ? item.answer : existing?.answer ?? '',
        transcript:
          typeof item.transcript === 'string'
            ? item.transcript
            : existing?.transcript ?? null,
        audioAsset: rawAudioAsset
          ? {
              fileName:
                typeof rawAudioAsset.fileName === 'string' ? rawAudioAsset.fileName : existing?.audioAsset.fileName ?? null,
              mimeType:
                typeof rawAudioAsset.mimeType === 'string'
                  ? rawAudioAsset.mimeType
                  : existing?.audioAsset.mimeType ?? null,
              size: typeof rawAudioAsset.size === 'number' ? rawAudioAsset.size : existing?.audioAsset.size ?? null,
              storedFileName:
                typeof rawAudioAsset.storedFileName === 'string'
                  ? rawAudioAsset.storedFileName
                  : existing?.audioAsset.storedFileName ?? null,
              uploadedAt:
                typeof rawAudioAsset.uploadedAt === 'string'
                  ? rawAudioAsset.uploadedAt
                  : existing?.audioAsset.uploadedAt ?? null,
            }
          : existing?.audioAsset ?? {
              fileName: null,
              mimeType: null,
              size: null,
              storedFileName: null,
              uploadedAt: null,
            },
        submittedAt: new Date().toISOString(),
        score: existing?.score ?? null,
        feedback: existing?.feedback ?? null,
        strengths: existing?.strengths ?? [],
        gaps: existing?.gaps ?? [],
      } satisfies AssessmentAnswer
    })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const existing = await getAssessmentRecordById(params.id)

    if (!existing) {
      return NextResponse.json({ error: '未找到对应的评估记录。' }, { status: 404 })
    }

    const body = (await request.json()) as {
      answers?: unknown
      sessionDurationSeconds?: unknown
    }

    const answers = isAnswerArray(body.answers)
      ? normalizeAnswers(body.answers, existing.answers)
      : existing.answers.map((answer) => ({
          ...answer,
          submittedAt: answer.submittedAt ?? new Date().toISOString(),
        }))

    const evaluation = await evaluateAssessmentRecord(
      existing,
      answers,
      typeof body.sessionDurationSeconds === 'number' ? Math.max(0, Math.round(body.sessionDurationSeconds)) : existing.summary.sessionDurationSeconds
    )

    const updated = await updateAssessmentRecord(params.id, (record) => ({
      ...record,
      updatedAt: new Date().toISOString(),
      source: evaluation.source,
      status: 'scored',
      answers: evaluation.answers,
      summary: evaluation.summary,
    }))

    if (!updated) {
      return NextResponse.json({ error: '未找到对应的评估记录。' }, { status: 404 })
    }

    await syncAssessmentOutcome(updated)

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : '评估评分失败。'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
