import { NextResponse } from 'next/server'

import { getAssessmentRecordById, updateAssessmentRecord } from '@/lib/server/assessment-store'
import type {
  AssessmentAnswer,
  AssessmentDifficulty,
  AssessmentQuestion,
  AssessmentQuestionCategory,
  AssessmentStatus,
} from '@/types/assessment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES: AssessmentStatus[] = ['draft', 'in_progress', 'submitted', 'scored']
const QUESTION_CATEGORIES: AssessmentQuestionCategory[] = [
  'technical',
  'problem_solving',
  'behavioral',
  'communication',
  'role_fit',
]
const QUESTION_DIFFICULTIES: AssessmentDifficulty[] = ['easy', 'medium', 'hard']

function isStatus(value: unknown): value is AssessmentStatus {
  return typeof value === 'string' && STATUSES.includes(value as AssessmentStatus)
}

function isAnswerArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value)
}

function isQuestionArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value)
}

function isQuestionCategory(value: unknown): value is AssessmentQuestionCategory {
  return typeof value === 'string' && QUESTION_CATEGORIES.includes(value as AssessmentQuestionCategory)
}

function isQuestionDifficulty(value: unknown): value is AssessmentDifficulty {
  return typeof value === 'string' && QUESTION_DIFFICULTIES.includes(value as AssessmentDifficulty)
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

function normalizeQuestions(
  rawQuestions: Array<Record<string, unknown>>,
  previousQuestions: AssessmentQuestion[]
) {
  const previousMap = new Map(previousQuestions.map((question) => [question.id, question]))

  return rawQuestions
    .filter(
      (item) =>
        typeof item.id === 'string' &&
        typeof item.prompt === 'string' &&
        typeof item.idealAnswer === 'string' &&
        isQuestionCategory(item.category) &&
        isQuestionDifficulty(item.difficulty)
    )
    .map((item) => {
      const previous = previousMap.get(item.id as string)

      return {
        id: item.id as string,
        prompt: (item.prompt as string).trim(),
        category: item.category as AssessmentQuestionCategory,
        difficulty: item.difficulty as AssessmentDifficulty,
        expectedPoints: Array.isArray(item.expectedPoints)
          ? item.expectedPoints
              .filter((value): value is string => typeof value === 'string')
              .map((value) => value.trim())
              .filter(Boolean)
              .slice(0, 5)
          : previous?.expectedPoints ?? [],
        idealAnswer: (item.idealAnswer as string).trim(),
        maxScore:
          typeof item.maxScore === 'number' && Number.isFinite(item.maxScore)
            ? Math.max(1, Math.round(item.maxScore))
            : previous?.maxScore ?? 20,
      } satisfies AssessmentQuestion
    })
    .filter((question) => question.prompt.length > 0 && question.idealAnswer.length > 0)
}

function buildAnswersForQuestions(
  questions: AssessmentQuestion[],
  previousAnswers: AssessmentAnswer[]
) {
  const previousMap = new Map(previousAnswers.map((answer) => [answer.questionId, answer]))

  return questions.map((question) => {
    const previous = previousMap.get(question.id)

    if (previous) {
      return previous
    }

    return {
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
    } satisfies AssessmentAnswer
  })
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const record = await getAssessmentRecordById(params.id)

  if (!record) {
    return NextResponse.json({ error: '未找到对应的评估记录。' }, { status: 404 })
  }

  return NextResponse.json(record)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as {
      answers?: unknown
      questions?: unknown
      status?: unknown
      sessionDurationSeconds?: unknown
      title?: unknown
      generatedFrom?: unknown
    }

    const updated = await updateAssessmentRecord(params.id, (record) => {
      const nextQuestions = isQuestionArray(body.questions)
        ? normalizeQuestions(body.questions, record.questions)
        : record.questions
      const questionsUpdated = isQuestionArray(body.questions) && nextQuestions.length > 0
      const incomingAnswers = isAnswerArray(body.answers)
        ? normalizeAnswers(body.answers, record.answers)
        : record.answers
      const nextAnswers = questionsUpdated
        ? buildAnswersForQuestions(nextQuestions, incomingAnswers)
        : incomingAnswers

      return {
        ...record,
        updatedAt: new Date().toISOString(),
        title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : record.title,
        generatedFrom:
          typeof body.generatedFrom === 'string' && body.generatedFrom.trim()
            ? body.generatedFrom.trim()
            : record.generatedFrom,
        status: questionsUpdated ? 'draft' : isStatus(body.status) ? body.status : record.status,
        questions: questionsUpdated ? nextQuestions : record.questions,
        answers: nextAnswers,
        summary: questionsUpdated
          ? {
              ...record.summary,
              overallScore: null,
              recommendation: null,
              summary: '题目已替换为练习题库内容，可以继续填写答案后重新提交评分。',
              nextStep: '先完成这套新的练习题，再生成新的评估结论。',
              completedAt: null,
              sessionDurationSeconds:
                typeof body.sessionDurationSeconds === 'number'
                  ? Math.max(0, Math.round(body.sessionDurationSeconds))
                  : 0,
              rubric: {
                technical: 0,
                communication: 0,
                structuredThinking: 0,
                roleFit: 0,
              },
            }
          : {
              ...record.summary,
              sessionDurationSeconds:
                typeof body.sessionDurationSeconds === 'number'
                  ? Math.max(0, Math.round(body.sessionDurationSeconds))
                  : record.summary.sessionDurationSeconds,
            },
      }
    })

    if (!updated) {
      return NextResponse.json({ error: '未找到对应的评估记录。' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新评估失败。'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
