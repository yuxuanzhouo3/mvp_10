import { NextResponse } from 'next/server'

import { getAssessmentRecordById, updateAssessmentRecord } from '@/lib/server/assessment-store'
import type { AssessmentAnswer, AssessmentStatus } from '@/types/assessment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES: AssessmentStatus[] = ['draft', 'in_progress', 'submitted', 'scored']

function isStatus(value: unknown): value is AssessmentStatus {
  return typeof value === 'string' && STATUSES.includes(value as AssessmentStatus)
}

function isAnswerArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value)
}

function normalizeAnswers(
  rawAnswers: Array<Record<string, unknown>>,
  previousAnswers: AssessmentAnswer[]
) {
  const previousMap = new Map(previousAnswers.map((answer) => [answer.questionId, answer]))

  return rawAnswers
    .filter((item) => typeof item.questionId === 'string')
    .map((item) => {
      const previous = previousMap.get(item.questionId as string)
      const rawAudioAsset =
        item.audioAsset && typeof item.audioAsset === 'object'
          ? (item.audioAsset as Record<string, unknown>)
          : null
      return {
        questionId: item.questionId as string,
        answer: typeof item.answer === 'string' ? item.answer : previous?.answer ?? '',
        transcript:
          typeof item.transcript === 'string'
            ? item.transcript
            : previous?.transcript ?? null,
        audioAsset: rawAudioAsset
          ? {
              fileName:
                typeof rawAudioAsset.fileName === 'string' ? rawAudioAsset.fileName : previous?.audioAsset.fileName ?? null,
              mimeType:
                typeof rawAudioAsset.mimeType === 'string'
                  ? rawAudioAsset.mimeType
                  : previous?.audioAsset.mimeType ?? null,
              size: typeof rawAudioAsset.size === 'number' ? rawAudioAsset.size : previous?.audioAsset.size ?? null,
              storedFileName:
                typeof rawAudioAsset.storedFileName === 'string'
                  ? rawAudioAsset.storedFileName
                  : previous?.audioAsset.storedFileName ?? null,
              uploadedAt:
                typeof rawAudioAsset.uploadedAt === 'string'
                  ? rawAudioAsset.uploadedAt
                  : previous?.audioAsset.uploadedAt ?? null,
            }
          : previous?.audioAsset ?? {
              fileName: null,
              mimeType: null,
              size: null,
              storedFileName: null,
              uploadedAt: null,
            },
        submittedAt:
          typeof item.submittedAt === 'string'
            ? item.submittedAt
            : previous?.submittedAt ?? null,
        score: previous?.score ?? null,
        feedback: previous?.feedback ?? null,
        strengths: previous?.strengths ?? [],
        gaps: previous?.gaps ?? [],
      } satisfies AssessmentAnswer
    })
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const record = await getAssessmentRecordById(params.id)

  if (!record) {
    return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 })
  }

  return NextResponse.json(record)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as {
      answers?: unknown
      status?: unknown
      sessionDurationSeconds?: unknown
      title?: unknown
    }

    const updated = await updateAssessmentRecord(params.id, (record) => ({
      ...record,
      updatedAt: new Date().toISOString(),
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : record.title,
      status: isStatus(body.status) ? body.status : record.status,
      answers: isAnswerArray(body.answers) ? normalizeAnswers(body.answers, record.answers) : record.answers,
      summary: {
        ...record.summary,
        sessionDurationSeconds:
          typeof body.sessionDurationSeconds === 'number'
            ? Math.max(0, Math.round(body.sessionDurationSeconds))
            : record.summary.sessionDurationSeconds,
      },
    }))

    if (!updated) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Assessment update failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
