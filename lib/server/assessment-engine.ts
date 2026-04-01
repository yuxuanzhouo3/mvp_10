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
import { fetchJsonObjectFromChat } from '@/lib/server/fast-json-chat'
import {
  getDefaultFastTextModel,
  getDefaultTextModel,
  getOpenAIUrl,
  getProviderApiKey,
  shouldPreferDashScope,
} from '@/lib/server/openai-config'

const ASSESSMENT_GENERATION_TIMEOUT_MS = 6000
const ASSESSMENT_SCORING_TIMEOUT_MS = 12000
const DASHSCOPE_ASSESSMENT_GENERATION_TIMEOUT_MS = 5500

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function normalizeText(value: string) {
  return value.toLowerCase()
}

function shouldUseAiAssessmentGeneration() {
  return process.env.ENABLE_AI_ASSESSMENT_GENERATION?.trim() === '1'
}

function trimEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function getAssessmentGenerationModel() {
  return (
    trimEnvValue(process.env.OPENAI_ASSESSMENT_GENERATION_MODEL) ||
    (shouldPreferDashScope() ? getDefaultFastTextModel() : null) ||
    trimEnvValue(process.env.OPENAI_ASSESSMENT_MODEL) ||
    getDefaultTextModel()
  )
}

function estimateAnswerUnits(text: string) {
  const normalized = text.trim()

  if (!normalized) {
    return 0
  }

  const cjkChars = (normalized.match(/[\u4e00-\u9fff]/g) ?? []).length
  const latinWords = normalized
    .replace(/[\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length

  return latinWords + Math.ceil(cjkChars / 2)
}

function getEffectiveAnswerText(answer: Pick<AssessmentAnswer, 'answer' | 'transcript'>) {
  return answer.answer.trim()
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutLabel: string
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${timeoutLabel}超时，已回退到本地规则`)
    }

    throw error
  } finally {
    clearTimeout(timer)
  }
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
    candidateName: resume?.contact.name ?? '候选人',
    title: job?.title ?? resume?.profile.currentTitle ?? '通用 AI 岗位',
    company: job?.company ?? '目标公司',
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

function stripListMarker(value: string) {
  return value.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, '').trim()
}

function containsCjkText(value: string) {
  return /[\u4e00-\u9fff]/.test(value)
}

function buildIdealAnswer(question: {
  expectedPoints: string[]
  category: AssessmentQuestionCategory
  prompt: string
}) {
  const lead =
    question.category === 'technical'
      ? '优秀回答应体现清晰的技术判断'
      : question.category === 'problem_solving'
        ? '优秀回答应体现结构化拆解与推进能力'
        : question.category === 'communication'
          ? '优秀回答应体现表达清晰、共识推进和风险说明'
          : question.category === 'role_fit'
            ? '优秀回答应体现岗位匹配度与动机'
            : '优秀回答应体现清晰背景、关键动作和结果复盘'

  const points = dedupe(question.expectedPoints.map(stripListMarker)).slice(0, 5)
  return `${lead}，并覆盖 ${points.join('、')}。`
}

function buildHeuristicQuestions(job: JobRecord | null, resume: ResumeRecord | null, mode: AssessmentRecord['mode']) {
  const summary = roleSummary(job, resume)
  const primary = summary.skills[0] ?? 'Python'
  const secondary = summary.skills[1] ?? 'SQL'
  const tertiary = summary.skills[2] ?? '沟通表达'

  if (mode === 'written') {
    return [
      questionTemplate(
        crypto.randomUUID(),
        `请为一个与 ${summary.title} 相关、需要用到 ${primary} 和 ${secondary} 的任务写一份简短实施方案，说明架构、数据流和关键取舍。`,
        'technical',
        'medium',
        [primary, secondary, '架构设计', '数据流', '方案取舍'],
        `优秀回答应提出可落地的方案，解释为什么选择 ${primary} 和 ${secondary}，并说明验证方式、风险与取舍。`
      ),
      questionTemplate(
        crypto.randomUUID(),
        `${summary.company} 在一次发布后出现线上问题。请说明你会如何排查、止损并降低对用户的影响。`,
        'problem_solving',
        'medium',
        ['止损', '日志排查', '回滚策略', '监控', '沟通同步'],
        '优秀回答应优先控制影响，再逐步收集证据、判断是否回滚、定位根因，并同步相关方。'
      ),
      questionTemplate(
        crypto.randomUUID(),
        `如果要上线一个与 ${primary} 相关的新功能，你会使用什么检查清单来保证质量？`,
        'technical',
        'hard',
        [primary, '测试覆盖', '成功指标', '边界情况', '质量门槛'],
        '优秀回答应覆盖功能测试、边界条件、发布指标、质量门槛以及上线准备。'
      ),
      questionTemplate(
        crypto.randomUUID(),
        `如果要向没有技术背景的招聘方或业务方解释一个复杂的 ${primary} 技术决策，你会怎么说？`,
        'communication',
        'easy',
        ['表达清晰', '业务价值', '通俗语言', '风险', '下一步'],
        '优秀回答应减少术语，用业务价值解释方案，同时说明风险和后续动作。'
      ),
      questionTemplate(
        crypto.randomUUID(),
        `与其他工作年限相近的候选人相比，你为什么更适合 ${summary.title} 这个岗位？`,
        'role_fit',
        'medium',
        [primary, secondary, tertiary, '业务成果', '主人翁意识'],
        '优秀回答应把技能、过往成果和岗位需求连起来，体现担当意识与团队适配度。'
      ),
    ]
  }

  return [
    questionTemplate(
      crypto.randomUUID(),
      `请结合 ${summary.title} 这个机会做一个自我介绍，并说明为什么 ${summary.company} 应该关注你的背景。`,
      'role_fit',
      'easy',
      [primary, secondary, '相关经历', '量化成果', '岗位动机'],
      '优秀回答应概括相关经历、核心技能、可量化成果以及你对这个岗位的动机。'
    ),
    questionTemplate(
      crypto.randomUUID(),
      `请讲一个你使用 ${primary} 的项目。过程中最难的部分是什么，你是如何处理的？`,
      'technical',
      'medium',
      [primary, '问题背景', '解决方案', '结果', '权衡'],
      '优秀回答应交代背景、难点、技术决策、取舍过程以及可量化结果。'
    ),
    questionTemplate(
      crypto.randomUUID(),
      '请描述一次信息不完整但你仍然需要推进项目的经历。',
      'problem_solving',
      'medium',
      ['信息不完整', '优先级', '沟通同步', '决策', '结果'],
      '优秀回答应体现你在不确定条件下的结构化思考，以及从假设到结果的推进路径。'
    ),
    questionTemplate(
      crypto.randomUUID(),
      '当你和同事、招聘方或面试官存在风险判断或方案分歧时，你通常如何沟通？',
      'communication',
      'medium',
      ['表达清晰', '共情', '数据依据', '达成一致', '后续跟进'],
      '优秀回答应兼顾清晰表达、共情、证据支撑以及后续执行。'
    ),
    questionTemplate(
      crypto.randomUUID(),
      `如果你以 ${summary.title} 的身份加入团队，前 30 天你会如何规划？`,
      'behavioral',
      'hard',
      ['学习计划', '关键协作方', '快速成果', '指标', '主人翁意识'],
      '优秀回答应体现现实可行的融入计划、关键协作对象、可量化的短期成果以及主人翁意识。'
    ),
  ]
}

async function generateOpenAIQuestions(
  job: JobRecord | null,
  resume: ResumeRecord | null,
  mode: AssessmentRecord['mode']
) {
  const apiKey = getProviderApiKey()

  if (!apiKey) {
    return null
  }

  const summary = roleSummary(job, resume)
  const response = await fetchWithTimeout(getOpenAIUrl('/responses'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ASSESSMENT_MODEL || getDefaultTextModel(),
      store: false,
      input: [
        {
          role: 'system',
          content:
            'You create recruiting assessments for Chinese-speaking hiring teams. Keep questions role-relevant, safe, concise, and grounded only in supplied job and resume data. Return strict JSON only. All user-facing strings must be in natural Simplified Chinese, including title, generatedFrom, prompt, expectedPoints, and idealAnswer.',
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
  }, ASSESSMENT_GENERATION_TIMEOUT_MS, 'AI 题目生成')

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
        : `${mode === 'written' ? '笔试评估' : '面试评估'} - ${summary.title}`,
    generatedFrom:
      typeof parsed.generatedFrom === 'string' && parsed.generatedFrom.trim()
        ? parsed.generatedFrom.trim()
        : `基于 ${summary.title} 的岗位要求以及 ${summary.candidateName} 的当前资料生成。`,
    questions,
  }
}

async function generateDashScopeQuestions(
  job: JobRecord | null,
  resume: ResumeRecord | null,
  mode: AssessmentRecord['mode']
) {
  const apiKey = getProviderApiKey()

  if (!apiKey) {
    return null
  }

  const summary = roleSummary(job, resume)
  const parsed = await fetchJsonObjectFromChat({
    apiKey,
    model: getAssessmentGenerationModel(),
    timeoutMs: DASHSCOPE_ASSESSMENT_GENERATION_TIMEOUT_MS,
    timeoutLabel: 'AI 题目生成',
    messages: [
      {
        role: 'system',
        content:
          'You create concise recruiting assessments. Return one JSON object only. All user-facing strings must be natural Simplified Chinese. Keep each question tightly grounded in the supplied job and resume data.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'Generate 5 recruiter-ready assessment questions.',
          mode,
          constraints: {
            questionCount: 5,
            categories: ['technical', 'problem_solving', 'behavioral', 'communication', 'role_fit'],
            difficulties: ['easy', 'medium', 'hard'],
            expectedPointsRange: '3-5 short bullet items per question',
            outputFields: ['title', 'generatedFrom', 'questions.prompt', 'questions.category', 'questions.difficulty', 'questions.expectedPoints'],
          },
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
  })

  if (!parsed || !Array.isArray(parsed.questions)) {
    return null
  }

  const questions = parsed.questions
    .filter((item): item is Record<string, unknown> => isObject(item))
    .map((item) => {
      if (
        typeof item.prompt !== 'string' ||
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

      const expectedPoints = dedupe(
        item.expectedPoints
          .filter((value): value is string => typeof value === 'string')
          .map(stripListMarker)
          .filter(Boolean)
      ).slice(0, 5)

      if (expectedPoints.length < 3) {
        return null
      }

      return questionTemplate(
        crypto.randomUUID(),
        item.prompt.trim(),
        item.category,
        item.difficulty,
        expectedPoints,
        buildIdealAnswer({
          prompt: item.prompt,
          category: item.category,
          expectedPoints,
        })
      )
    })
    .filter((item): item is AssessmentQuestion => item !== null)

  if (questions.length !== 5) {
    return null
  }

  return {
    source: 'openai' as AssessmentSource,
    title:
      typeof parsed.title === 'string' && parsed.title.trim() && containsCjkText(parsed.title)
        ? parsed.title.trim()
        : `${mode === 'written' ? '笔试评估' : '面试评估'} - ${summary.title}`,
    generatedFrom:
      typeof parsed.generatedFrom === 'string' && parsed.generatedFrom.trim() && containsCjkText(parsed.generatedFrom)
        ? parsed.generatedFrom.trim()
        : `基于 ${summary.title} 的岗位要求以及 ${summary.candidateName} 的资料生成。`,
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

  if (shouldUseAiAssessmentGeneration()) {
    try {
      if (shouldPreferDashScope()) {
        const generated = await generateDashScopeQuestions(job, resume, mode)
        if (generated) {
          return generated
        }
      }

      const generated = await generateOpenAIQuestions(job, resume, mode)
      if (generated) {
        return generated
      }
    } catch (error) {
      console.error('Falling back to heuristic assessment generation:', error)
    }
  }

  return {
    source: 'heuristic' as AssessmentSource,
    title: `${mode === 'written' ? '笔试评估' : '面试评估'} - ${summary.title}`,
    generatedFrom: `基于 ${summary.title} 的岗位期待、${summary.candidateName} 的资料，以及重点技能 ${summary.skills.join('、') || '通用问题解决能力'} 生成。`,
    questions: fallbackQuestions,
  }
}

function scoreSingleAnswer(question: AssessmentQuestion, answer: string) {
  const normalizedAnswer = normalizeText(answer)
  const answerUnits = estimateAnswerUnits(answer)
  const matchedPoints = question.expectedPoints.filter((point) => normalizedAnswer.includes(normalizeText(point)))
  const coverage = question.expectedPoints.length === 0 ? 0 : matchedPoints.length / question.expectedPoints.length
  const structureSignals = ['because', 'therefore', 'tradeoff', 'result', 'impact', 'first', 'then', 'finally', '首先', '其次', '最后', '因此', '所以', '然后']
  const specificitySignals = ['example', 'metric', '%', 'users', 'latency', 'accuracy', 'revenue', '例如', '指标', '数据', '用户', '准确率', '时延', '提升', '降低', '增长']
  const structureHits = structureSignals.filter((signal) => normalizedAnswer.includes(signal)).length
  const specificityHits = specificitySignals.filter((signal) => normalizedAnswer.includes(signal)).length
  const completeness = clamp(answerUnits / 140, 0, 1)
  const structure = clamp(structureHits / 3, 0, 1)
  const specificity = clamp(specificityHits / 3, 0, 1)
  const weighted = coverage * 0.5 + completeness * 0.25 + structure * 0.15 + specificity * 0.1
  const score = Math.round(question.maxScore * clamp(weighted, 0, 1))
  const gaps = question.expectedPoints.filter((point) => !matchedPoints.includes(point)).slice(0, 3)

  const feedback =
    answerUnits === 0
      ? '这一题还没有提交有效答案。'
      : gaps.length === 0
        ? '回答较强，关键要点、细节和结构都比较完整。'
        : `回答方向是对的，但如果能更明确覆盖 ${gaps.join('、')}，整体会更强。`

  return {
    score,
    feedback,
    strengths: matchedPoints.slice(0, 3),
    gaps,
  }
}

async function scoreWithOpenAI(record: AssessmentRecord, answers: AssessmentAnswer[]) {
  const apiKey = getProviderApiKey()

  if (!apiKey) {
    return null
  }

  const response = await fetchWithTimeout(getOpenAIUrl('/responses'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ASSESSMENT_MODEL || getDefaultTextModel(),
      store: false,
      input: [
        {
          role: 'system',
          content:
            'You score recruiting assessments for Chinese-speaking hiring teams. Score fairly using only the prompt, expected points, and candidate answer. Return strict JSON only. All returned user-facing text must be natural Simplified Chinese, including summary, nextStep, feedback, strengths, and gaps.',
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
  }, ASSESSMENT_SCORING_TIMEOUT_MS, 'AI 评分')

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
          feedback: scored?.feedback ?? '暂未返回评分反馈。',
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
          (sum, answer) => sum + clamp(estimateAnswerUnits(getEffectiveAnswerText(answer)) / 1.6, 0, 100),
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
          const count = ['first', 'second', 'then', 'finally', 'because', 'therefore', '首先', '其次', '最后', '然后', '因此', '所以'].filter((item) => text.includes(item)).length
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
      ? '整体表现很强，候选人在岗位匹配和结构化表达上都给出了比较稳定的信号。'
      : recommendation === 'yes'
        ? '整体信号不错，方向基本正确，但仍有少量薄弱点需要补强。'
        : recommendation === 'hold'
          ? '结果偏中性，已经出现一些可用信号，但仍需要进一步追问验证。'
          : '当前回答还没有达到这套题和目标岗位的预期标准。'

  const nextStep =
    recommendation === 'strong_yes'
      ? '建议进入下一轮面试或直接推进决策。'
      : recommendation === 'yes'
        ? '建议进入下一步，并围绕薄弱点补充几道追问题。'
        : recommendation === 'hold'
          ? '建议先做一轮更聚焦的补充评估，再决定是否继续推进。'
          : '建议先暂缓推进，保留候选人或礼貌结束当前流程。'

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
