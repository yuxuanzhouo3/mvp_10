import type {
  AssessmentAnswer,
  AssessmentQuestion,
  AssessmentQuestionCategory,
  AssessmentRecommendation,
  AssessmentRecord,
  AssessmentRubric,
  AssessmentSource,
  AssessmentSummary,
} from '@/types/assessment'
import type { JobRecord } from '@/types/job'
import type { ResumeRecord } from '@/types/resume'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function normalizeText(value: string) {
  return value.toLowerCase()
}

function getEffectiveAnswerText(answer: Pick<AssessmentAnswer, 'answer' | 'transcript'>) {
  const directAnswer = answer.answer.trim()

  if (directAnswer) {
    return directAnswer
  }

  return answer.transcript?.trim() ?? ''
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractOutputText(payload: unknown) {
  if (!isObject(payload) || !Array.isArray(payload.output)) {
    return null
  }

  const chunks: string[] = []

  for (const item of payload.output) {
    if (!isObject(item) || !Array.isArray(item.content)) {
      continue
    }

    for (const contentItem of item.content) {
      if (!isObject(contentItem)) {
        continue
      }

      if (contentItem.type === 'output_text' && typeof contentItem.text === 'string') {
        chunks.push(contentItem.text)
      }
    }
  }

  const text = chunks.join('\n').trim()
  return text.length > 0 ? text : null
}

function roleSummary(job: JobRecord | null, resume: ResumeRecord | null) {
  const skills = dedupe([
    ...(job?.requiredSkills ?? []),
    ...(job?.preferredSkills ?? []),
    ...(resume?.profile.skills ?? []),
  ]).slice(0, 6)

  return {
    candidateName: resume?.contact.name ?? 'Candidate',
    title: job?.title ?? resume?.profile.currentTitle ?? 'General AI role',
    company: job?.company ?? 'your target company',
    skills,
    yearsExperience: resume?.profile.yearsExperience ?? job?.minYearsExperience ?? 0,
  }
}

function questionTemplate(
  id: string,
  prompt: string,
  category: AssessmentQuestionCategory,
  difficulty: AssessmentQuestion['difficulty'],
  expectedPoints: string[],
  idealAnswer: string
): AssessmentQuestion {
  return {
    id,
    prompt,
    category,
    difficulty,
    expectedPoints: dedupe(expectedPoints).slice(0, 5),
    idealAnswer,
    maxScore: 20,
  }
}

function buildHeuristicQuestions(job: JobRecord | null, resume: ResumeRecord | null, mode: AssessmentRecord['mode']) {
  const summary = roleSummary(job, resume)
  const primary = summary.skills[0] ?? 'Python'
  const secondary = summary.skills[1] ?? 'SQL'
  const tertiary = summary.skills[2] ?? 'communication'

  if (mode === 'written') {
    return [
      questionTemplate(
        crypto.randomUUID(),
        `Design a short implementation plan for a ${summary.title} task that uses ${primary} and ${secondary}. Explain architecture, data flow, and tradeoffs.`,
        'technical',
        'medium',
        [primary, secondary, 'tradeoff', 'architecture', 'data flow'],
        `A strong answer should propose a workable architecture, explain why ${primary} and ${secondary} are used, note tradeoffs, and mention validation or monitoring.`
      ),
      questionTemplate(
        crypto.randomUUID(),
        `A production issue appears after a release in ${summary.company}. Walk through how you would debug it and reduce user impact.`,
        'problem_solving',
        'medium',
        ['root cause', 'logs', 'rollback', 'monitoring', 'communication'],
        'A strong answer should prioritize impact containment, data collection, rollback criteria, root-cause analysis, and cross-team communication.'
      ),
      questionTemplate(
        crypto.randomUUID(),
        `Write the evaluation checklist you would use before shipping a feature related to ${primary}.`,
        'technical',
        'hard',
        [primary, 'test', 'metrics', 'edge cases', 'quality'],
        'A strong answer should cover functional tests, edge cases, success metrics, quality gates, and launch readiness.'
      ),
      questionTemplate(
        crypto.randomUUID(),
        `How would you explain a complex ${primary} decision to a recruiter or stakeholder with no technical background?`,
        'communication',
        'easy',
        ['clarity', 'business impact', 'simple language', 'risk', 'next steps'],
        'A strong answer should simplify jargon, connect the topic to business impact, and communicate risk and next steps clearly.'
      ),
      questionTemplate(
        crypto.randomUUID(),
        `Why do you fit a ${summary.title} role better than another candidate with similar years of experience?`,
        'role_fit',
        'medium',
        [primary, secondary, tertiary, 'impact', 'ownership'],
        'A strong answer should tie skills and past impact to the role, show ownership, and demonstrate awareness of team needs.'
      ),
    ]
  }

  return [
    questionTemplate(
      crypto.randomUUID(),
      `Please introduce yourself for this ${summary.title} opportunity and highlight why ${summary.company} should pay attention to your background.`,
      'role_fit',
      'easy',
      [primary, secondary, 'experience', 'impact', 'motivation'],
      'A strong answer should summarize relevant experience, core skills, measurable impact, and motivation for the role.'
    ),
    questionTemplate(
      crypto.randomUUID(),
      `Tell me about a project where you used ${primary}. What was difficult and how did you handle it?`,
      'technical',
      'medium',
      [primary, 'problem', 'solution', 'result', 'tradeoff'],
      'A strong answer should describe context, challenge, technical decision, tradeoffs, and measurable result.'
    ),
    questionTemplate(
      crypto.randomUUID(),
      `Describe a time you had incomplete information but still needed to move a project forward.`,
      'problem_solving',
      'medium',
      ['ambiguity', 'prioritization', 'communication', 'decision', 'result'],
      'A strong answer should show structured thinking under ambiguity and a clear path from assumptions to result.'
    ),
    questionTemplate(
      crypto.randomUUID(),
      `How do you communicate risk or disagreement with a teammate, recruiter, or interviewer?`,
      'communication',
      'medium',
      ['clarity', 'empathy', 'data', 'alignment', 'follow-up'],
      'A strong answer should balance clarity, empathy, evidence, and concrete follow-through.'
    ),
    questionTemplate(
      crypto.randomUUID(),
      `If you joined as ${summary.title}, what would your first 30 days look like?`,
      'behavioral',
      'hard',
      ['learning plan', 'stakeholders', 'quick wins', 'metrics', 'ownership'],
      'A strong answer should show a realistic ramp plan, stakeholder alignment, measurable wins, and ownership.'
    ),
  ]
}

async function generateOpenAIQuestions(
  job: JobRecord | null,
  resume: ResumeRecord | null,
  mode: AssessmentRecord['mode'],
  fallbackQuestions: AssessmentQuestion[]
) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return null
  }

  const summary = roleSummary(job, resume)
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ASSESSMENT_MODEL || 'gpt-5',
      store: false,
      input: [
        {
          role: 'system',
          content:
            'You create recruiting assessments. Keep questions role-relevant, safe, concise, and grounded only in supplied job and resume data. Return strict JSON only.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            mode,
            job: job
              ? {
                  title: job.title,
                  company: job.company,
                  requiredSkills: job.requiredSkills,
                  preferredSkills: job.preferredSkills,
                  description: job.description,
                }
              : null,
            resume: resume
              ? {
                  candidateName: resume.contact.name,
                  currentTitle: resume.profile.currentTitle,
                  skills: resume.profile.skills,
                  yearsExperience: resume.profile.yearsExperience,
                  highlights: resume.profile.highlights,
                }
              : null,
            target: summary,
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'assessment_question_set',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              generatedFrom: { type: 'string' },
              questions: {
                type: 'array',
                minItems: 5,
                maxItems: 5,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    prompt: { type: 'string' },
                    category: {
                      type: 'string',
                      enum: ['technical', 'problem_solving', 'behavioral', 'communication', 'role_fit'],
                    },
                    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                    expectedPoints: {
                      type: 'array',
                      minItems: 3,
                      maxItems: 5,
                      items: { type: 'string' },
                    },
                    idealAnswer: { type: 'string' },
                  },
                  required: ['prompt', 'category', 'difficulty', 'expectedPoints', 'idealAnswer'],
                },
              },
            },
            required: ['title', 'generatedFrom', 'questions'],
          },
        },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`)
  }

  const payload = (await response.json()) as unknown
  const outputText = extractOutputText(payload)

  if (!outputText) {
    throw new Error('OpenAI response did not include structured output text')
  }

  const parsed = JSON.parse(outputText) as Record<string, unknown>
  const questionsValue = Array.isArray(parsed.questions) ? parsed.questions : []
  const questions = questionsValue
    .filter((item): item is Record<string, unknown> => isObject(item))
    .map((item) => {
      if (
        typeof item.prompt !== 'string' ||
        typeof item.idealAnswer !== 'string' ||
        (item.category !== 'technical' &&
          item.category !== 'problem_solving' &&
          item.category !== 'behavioral' &&
          item.category !== 'communication' &&
          item.category !== 'role_fit') ||
        (item.difficulty !== 'easy' && item.difficulty !== 'medium' && item.difficulty !== 'hard') ||
        !Array.isArray(item.expectedPoints)
      ) {
        return null
      }

      return questionTemplate(
        crypto.randomUUID(),
        item.prompt,
        item.category,
        item.difficulty,
        item.expectedPoints.filter((value): value is string => typeof value === 'string'),
        item.idealAnswer
      )
    })
    .filter((item): item is AssessmentQuestion => item !== null)

  if (questions.length !== 5) {
    return null
  }

  return {
    source: 'openai' as AssessmentSource,
    title:
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : `${mode === 'written' ? 'Written Assessment' : 'Interview Session'} - ${summary.title}`,
    generatedFrom:
      typeof parsed.generatedFrom === 'string' && parsed.generatedFrom.trim()
        ? parsed.generatedFrom.trim()
        : `Generated from ${summary.title} requirements and ${summary.candidateName}'s current profile.`,
    questions,
  }
}

export async function createAssessmentDraft(
  job: JobRecord | null,
  resume: ResumeRecord | null,
  mode: AssessmentRecord['mode']
) {
  const summary = roleSummary(job, resume)
  const fallbackQuestions = buildHeuristicQuestions(job, resume, mode)

  try {
    const generated = await generateOpenAIQuestions(job, resume, mode, fallbackQuestions)
    if (generated) {
      return generated
    }
  } catch (error) {
    console.error('Falling back to heuristic assessment generation:', error)
  }

  return {
    source: 'heuristic' as AssessmentSource,
    title: `${mode === 'written' ? 'Written Assessment' : 'Interview Session'} - ${summary.title}`,
    generatedFrom: `Generated from ${summary.title} expectations, ${summary.candidateName}'s profile, and focus skills: ${summary.skills.join(', ') || 'general problem solving'}.`,
    questions: fallbackQuestions,
  }
}

function scoreSingleAnswer(question: AssessmentQuestion, answer: string) {
  const normalizedAnswer = normalizeText(answer)
  const words = answer.trim().split(/\s+/).filter(Boolean)
  const matchedPoints = question.expectedPoints.filter((point) => normalizedAnswer.includes(normalizeText(point)))
  const coverage = question.expectedPoints.length === 0 ? 0 : matchedPoints.length / question.expectedPoints.length
  const structureSignals = ['because', 'therefore', 'tradeoff', 'result', 'impact', 'first', 'then', 'finally']
  const specificitySignals = ['example', 'metric', '%', 'users', 'latency', 'accuracy', 'revenue']
  const structureHits = structureSignals.filter((signal) => normalizedAnswer.includes(signal)).length
  const specificityHits = specificitySignals.filter((signal) => normalizedAnswer.includes(signal)).length
  const completeness = clamp(words.length / 140, 0, 1)
  const structure = clamp(structureHits / 3, 0, 1)
  const specificity = clamp(specificityHits / 3, 0, 1)
  const weighted = coverage * 0.5 + completeness * 0.25 + structure * 0.15 + specificity * 0.1
  const score = Math.round(question.maxScore * clamp(weighted, 0, 1))
  const gaps = question.expectedPoints.filter((point) => !matchedPoints.includes(point)).slice(0, 3)

  const feedback =
    words.length === 0
      ? 'No answer was submitted for this question.'
      : gaps.length === 0
        ? 'Strong answer. It covered the expected points with enough detail and structure.'
        : `Solid start, but it would be stronger if it covered ${gaps.join(', ')} more explicitly.`

  return {
    score,
    feedback,
    strengths: matchedPoints.slice(0, 3),
    gaps,
  }
}

async function scoreWithOpenAI(record: AssessmentRecord, answers: AssessmentAnswer[]) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return null
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ASSESSMENT_MODEL || 'gpt-5',
      store: false,
      input: [
        {
          role: 'system',
          content:
            'You score recruiting assessments. Score fairly using the prompt, expected points, and candidate answer only. Return strict JSON only.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            title: record.title,
            mode: record.mode,
            questions: record.questions.map((question) => ({
              id: question.id,
              prompt: question.prompt,
              category: question.category,
              maxScore: question.maxScore,
              expectedPoints: question.expectedPoints,
              answer: getEffectiveAnswerText(answers.find((answer) => answer.questionId === question.id) ?? { answer: '', transcript: null }),
            })),
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'assessment_scoring',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: { type: 'string' },
              recommendation: { type: 'string', enum: ['strong_yes', 'yes', 'hold', 'no'] },
              nextStep: { type: 'string' },
              rubric: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  technical: { type: 'number', minimum: 0, maximum: 100 },
                  communication: { type: 'number', minimum: 0, maximum: 100 },
                  structuredThinking: { type: 'number', minimum: 0, maximum: 100 },
                  roleFit: { type: 'number', minimum: 0, maximum: 100 },
                },
                required: ['technical', 'communication', 'structuredThinking', 'roleFit'],
              },
              answers: {
                type: 'array',
                minItems: 5,
                maxItems: 5,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    questionId: { type: 'string' },
                    score: { type: 'number', minimum: 0, maximum: 20 },
                    feedback: { type: 'string' },
                    strengths: {
                      type: 'array',
                      items: { type: 'string' },
                      maxItems: 3,
                    },
                    gaps: {
                      type: 'array',
                      items: { type: 'string' },
                      maxItems: 3,
                    },
                  },
                  required: ['questionId', 'score', 'feedback', 'strengths', 'gaps'],
                },
              },
            },
            required: ['summary', 'recommendation', 'nextStep', 'rubric', 'answers'],
          },
        },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`)
  }

  const payload = (await response.json()) as unknown
  const outputText = extractOutputText(payload)

  if (!outputText) {
    throw new Error('OpenAI response did not include structured output text')
  }

  const parsed = JSON.parse(outputText) as Record<string, unknown>

  if (
    !Array.isArray(parsed.answers) ||
    !isObject(parsed.rubric) ||
    typeof parsed.summary !== 'string' ||
    typeof parsed.nextStep !== 'string' ||
    (parsed.recommendation !== 'strong_yes' &&
      parsed.recommendation !== 'yes' &&
      parsed.recommendation !== 'hold' &&
      parsed.recommendation !== 'no')
  ) {
    return null
  }

  const answerMap = new Map(
    parsed.answers
      .filter((item): item is Record<string, unknown> => isObject(item))
      .map((item) => [
        item.questionId,
        {
          score: typeof item.score === 'number' ? clamp(Math.round(item.score), 0, 20) : 0,
          feedback: typeof item.feedback === 'string' ? item.feedback : '',
          strengths: Array.isArray(item.strengths)
            ? item.strengths.filter((value): value is string => typeof value === 'string').slice(0, 3)
            : [],
          gaps: Array.isArray(item.gaps)
            ? item.gaps.filter((value): value is string => typeof value === 'string').slice(0, 3)
            : [],
        },
      ])
  )

  const rubric = parsed.rubric

  return {
    summary: parsed.summary,
    recommendation: parsed.recommendation,
    nextStep: parsed.nextStep,
    rubric: {
      technical: typeof rubric.technical === 'number' ? clamp(Math.round(rubric.technical), 0, 100) : 0,
      communication: typeof rubric.communication === 'number' ? clamp(Math.round(rubric.communication), 0, 100) : 0,
      structuredThinking:
        typeof rubric.structuredThinking === 'number'
          ? clamp(Math.round(rubric.structuredThinking), 0, 100)
          : 0,
      roleFit: typeof rubric.roleFit === 'number' ? clamp(Math.round(rubric.roleFit), 0, 100) : 0,
    } satisfies AssessmentRubric,
    answerMap,
  }
}

function recommendationFromScore(score: number): AssessmentRecommendation {
  if (score >= 85) return 'strong_yes'
  if (score >= 72) return 'yes'
  if (score >= 58) return 'hold'
  return 'no'
}

export async function evaluateAssessmentRecord(
  record: AssessmentRecord,
  answers: AssessmentAnswer[],
  sessionDurationSeconds: number
) {
  const normalizedAnswers = record.questions.map((question) => {
    const existing = answers.find((answer) => answer.questionId === question.id)
    return {
      questionId: question.id,
      answer: existing?.answer ?? '',
      transcript: existing?.transcript ?? null,
      audioAsset: existing?.audioAsset ?? {
        fileName: null,
        mimeType: null,
        size: null,
        storedFileName: null,
        uploadedAt: null,
      },
      submittedAt: existing?.submittedAt ?? new Date().toISOString(),
      score: null,
      feedback: null,
      strengths: [],
      gaps: [],
    } satisfies AssessmentAnswer
  })

  try {
    const aiEvaluation = await scoreWithOpenAI(record, normalizedAnswers)
    if (aiEvaluation) {
      const evaluatedAnswers = normalizedAnswers.map((answer) => {
        const scored = aiEvaluation.answerMap.get(answer.questionId)
        return {
          ...answer,
          score: scored?.score ?? 0,
          feedback: scored?.feedback ?? 'No feedback returned.',
          strengths: scored?.strengths ?? [],
          gaps: scored?.gaps ?? [],
        }
      })

      const overallScore = Math.round(
        (evaluatedAnswers.reduce((sum, answer) => sum + (answer.score ?? 0), 0) /
          Math.max(record.questions.reduce((sum, question) => sum + question.maxScore, 0), 1)) *
          100
      )

      return {
        source: 'openai' as AssessmentSource,
        answers: evaluatedAnswers,
        summary: {
          overallScore,
          recommendation: aiEvaluation.recommendation as AssessmentRecommendation,
          summary: aiEvaluation.summary,
          nextStep: aiEvaluation.nextStep,
          sessionDurationSeconds,
          completedAt: new Date().toISOString(),
          rubric: aiEvaluation.rubric,
        } satisfies AssessmentSummary,
      }
    }
  } catch (error) {
    console.error('Falling back to heuristic assessment scoring:', error)
  }

  const evaluatedAnswers = normalizedAnswers.map((answer) => {
    const question = record.questions.find((item) => item.id === answer.questionId)

    if (!question) {
      return answer
    }

    const scored = scoreSingleAnswer(question, getEffectiveAnswerText(answer))
    return {
      ...answer,
      score: scored.score,
      feedback: scored.feedback,
      strengths: scored.strengths,
      gaps: scored.gaps,
    }
  })

  const totalScore = evaluatedAnswers.reduce((sum, answer) => sum + (answer.score ?? 0), 0)
  const maxScore = record.questions.reduce((sum, question) => sum + question.maxScore, 0) || 1
  const overallScore = Math.round((totalScore / maxScore) * 100)

  const technicalQuestions = record.questions.filter((item) => item.category === 'technical' || item.category === 'problem_solving')
  const technicalIds = new Set(technicalQuestions.map((item) => item.id))
  const roleFitIds = new Set(record.questions.filter((item) => item.category === 'role_fit' || item.category === 'behavioral').map((item) => item.id))

  const averageFor = (ids: Set<string>) => {
    const relevant = evaluatedAnswers.filter((item) => ids.has(item.questionId))
    if (relevant.length === 0) {
      return 0
    }
    return Math.round(
      (relevant.reduce((sum, item) => sum + (item.score ?? 0), 0) /
        Math.max(
          record.questions.filter((item) => ids.has(item.id)).reduce((sum, item) => sum + item.maxScore, 0),
          1
        )) *
        100
    )
  }

  const rubric: AssessmentRubric = {
    technical: averageFor(technicalIds),
    communication: clamp(
      Math.round(
        evaluatedAnswers.reduce(
          (sum, answer) => sum + clamp(getEffectiveAnswerText(answer).split(/\s+/).filter(Boolean).length / 1.6, 0, 100),
          0
        ) /
          Math.max(evaluatedAnswers.length, 1)
      ),
      0,
      100
    ),
    structuredThinking: clamp(
      Math.round(
        evaluatedAnswers.reduce((sum, answer) => {
          const text = normalizeText(getEffectiveAnswerText(answer))
          const count = ['first', 'second', 'then', 'finally', 'because', 'therefore'].filter((item) => text.includes(item)).length
          return sum + clamp(count * 20, 0, 100)
        }, 0) / Math.max(evaluatedAnswers.length, 1)
      ),
      0,
      100
    ),
    roleFit: averageFor(roleFitIds),
  }

  const recommendation = recommendationFromScore(overallScore)
  const summary =
    recommendation === 'strong_yes'
      ? 'Strong performance across the question set. The candidate showed both role fit and structured reasoning.'
      : recommendation === 'yes'
        ? 'Good overall signal. The candidate is moving in the right direction with a few gaps to tighten.'
        : recommendation === 'hold'
          ? 'Mixed result. There are some usable signals, but the candidate needs follow-up validation.'
          : 'Current answers are below the expected bar for this role and question set.'

  const nextStep =
    recommendation === 'strong_yes'
      ? 'Advance to the next interview or decision round.'
      : recommendation === 'yes'
        ? 'Move forward with targeted follow-up questions.'
        : recommendation === 'hold'
          ? 'Run another focused assessment before making a decision.'
          : 'Keep the candidate in reserve or close the loop politely.'

  return {
    source: 'heuristic' as AssessmentSource,
    answers: evaluatedAnswers,
    summary: {
      overallScore,
      recommendation,
      summary,
      nextStep,
      sessionDurationSeconds,
      completedAt: new Date().toISOString(),
      rubric,
    } satisfies AssessmentSummary,
  }
}
