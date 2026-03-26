import { NextResponse } from 'next/server'

import { getAssessmentRecordById, saveAssessmentAudioFile, updateAssessmentRecord } from '@/lib/server/assessment-store'
import { transcribeAssessmentAudio } from '@/lib/server/assessment-transcription'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const record = await getAssessmentRecordById(params.id)

    if (!record) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 })
    }

    const formData = await request.formData()
    const questionId = formData.get('questionId')
    const audio = formData.get('audio')

    if (typeof questionId !== 'string' || !questionId.trim()) {
      return NextResponse.json({ error: 'questionId is required.' }, { status: 400 })
    }

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Audio file is required.' }, { status: 400 })
    }

    const question = record.questions.find((item) => item.id === questionId)

    if (!question) {
      return NextResponse.json({ error: 'Assessment question not found.' }, { status: 404 })
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio file exceeds the 25MB transcription limit.' }, { status: 400 })
    }

    const buffer = Buffer.from(await audio.arrayBuffer())
    const savedFile = await saveAssessmentAudioFile(params.id, questionId, audio.name || 'audio.webm', buffer)
    const uploadedAt = new Date().toISOString()
    let transcript: string | null = null
    let warning: string | null = null

    try {
      transcript = await transcribeAssessmentAudio(audio)
    } catch (error) {
      warning = error instanceof Error ? error.message : 'Audio was saved, but transcription is currently unavailable.'
    }

    const updated = await updateAssessmentRecord(params.id, (current) => ({
      ...current,
      updatedAt: uploadedAt,
      status: current.status === 'draft' ? 'in_progress' : current.status === 'scored' ? 'in_progress' : current.status,
      answers: current.answers.map((answer) =>
        answer.questionId === questionId
          ? {
              ...answer,
              answer: transcript && !answer.answer.trim() ? transcript : answer.answer,
              transcript,
              audioAsset: {
                fileName: audio.name || 'audio.webm',
                mimeType: audio.type || 'audio/webm',
                size: audio.size,
                storedFileName: savedFile.storedFileName,
                uploadedAt,
              },
              submittedAt: uploadedAt,
              score: null,
              feedback: null,
              strengths: [],
              gaps: [],
            }
          : answer
      ),
    }))

    if (!updated) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 })
    }

    return NextResponse.json({
      record: updated,
      transcript,
      questionId,
      warning,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audio transcription failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
