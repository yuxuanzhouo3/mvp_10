import { NextResponse } from 'next/server'

import { createAssessmentDraft } from '@/lib/server/assessment-engine'
import { addAssessmentRecord, listAssessmentRecords } from '@/lib/server/assessment-store'
import { getJobById } from '@/lib/server/job-store'
import { getResumeRecordById } from '@/lib/server/resume-store'
import type { AssessmentAnswer, AssessmentMode, AssessmentRecord, AssessmentStatus } from '@/types/assessment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODES: AssessmentMode[] = ['written', 'interview']
const STATUSES: AssessmentStatus[] = ['draft', 'in_progress', 'submitted', 'scored']

function isMode(value: unknown): value is AssessmentMode {
  return typeof value === 'string' && MODES.includes(value as AssessmentMode)
}

function isStatus(value: unknown): value is AssessmentStatus {
  return typeof value === 'string' && STATUSES.includes(value as AssessmentStatus)
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode')
    const resumeId = url.searchParams.get('resumeId')
    const status = url.searchParams.get('status')

    let records = await listAssessmentRecords()

    if (mode && isMode(mode)) {
      records = records.filter((record) => record.mode === mode)
    }

    if (resumeId) {
      records = records.filter((record) => record.resumeId === resumeId)
    }

    if (status && isStatus(status)) {
      records = records.filter((record) => record.status === status)
    }

    return NextResponse.json(records)
  } catch (error) {
    const message = error instanceof Error ? error.message : '加载评估列表失败。'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      mode?: unknown
      jobId?: unknown
      resumeId?: unknown
    }

    if (!isMode(body.mode)) {
      return NextResponse.json({ error: '请选择评估模式。' }, { status: 400 })
    }

    const [job, resume] = await Promise.all([
      typeof body.jobId === 'string' && body.jobId.trim() ? getJobById(body.jobId) : Promise.resolve(null),
      typeof body.resumeId === 'string' && body.resumeId.trim()
        ? getResumeRecordById(body.resumeId)
        : Promise.resolve(null),
    ])

    const draft = await createAssessmentDraft(job, resume, body.mode)
    const now = new Date().toISOString()
    const answers: AssessmentAnswer[] = draft.questions.map((question) => ({
      questionId: question.id,
      answer: '',
      transcript: null,
      audioAsset: {
        fileName: null,
        mimeType: null,
        size: null,
        storedFileName: null,
        uploadedAt: null,
      },
      submittedAt: null,
      score: null,
      feedback: null,
      strengths: [],
      gaps: [],
    }))

    const record: AssessmentRecord = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      title: draft.title,
      mode: body.mode,
      status: 'draft',
      source: draft.source,
      generatedFrom: draft.generatedFrom,
      jobId: job?.id ?? null,
      jobTitle: job?.title ?? null,
      company: job?.company ?? null,
      resumeId: resume?.id ?? null,
      candidateName: resume?.contact.name ?? null,
      candidateEmail: resume?.contact.email ?? null,
      questions: draft.questions,
      answers,
      summary: {
        overallScore: null,
        recommendation: null,
        summary: '题目已生成，可以直接填写答案，并在完成后提交评分。',
        nextStep: '先完成整套题，再提交生成 AI 评估结论。',
        sessionDurationSeconds: 0,
        completedAt: null,
        rubric: {
          technical: 0,
          communication: 0,
          structuredThinking: 0,
          roleFit: 0,
        },
      },
    }

    await addAssessmentRecord(record)
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成评估失败。'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
