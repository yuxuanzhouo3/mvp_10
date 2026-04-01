'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Lightbulb,
  Loader2,
  MessageSquare,
  Save,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Video,
} from 'lucide-react'

import type {
  AssessmentAnswer,
  AssessmentMode,
  AssessmentQuestion,
  AssessmentQuestionCategory,
  AssessmentRecord,
  AssessmentRecommendation,
  AssessmentRubric,
} from '@/types/assessment'
import type { JobRecord } from '@/types/job'
import type { ResumeListItem } from '@/types/resume'

interface PracticePack {
  id: string
  title: string
  mode: AssessmentMode
  description: string
  generatedFrom: string
  focus: string[]
  questions: AssessmentQuestion[]
}

interface LiveAnswerFeedback {
  estimatedScore: number
  readinessLabel: string
  coveragePercent: number
  completionPercent: number
  contentUnits: number
  matchedPoints: string[]
  missingPoints: string[]
  coachingTips: string[]
}

function buildPracticeQuestion(
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
    expectedPoints,
    idealAnswer,
    maxScore: 20,
  }
}

const PRACTICE_PACK_LIBRARY: PracticePack[] = [
  {
    id: 'interview-foundation-pack',
    title: '面试基础题库',
    mode: 'interview',
    description: '覆盖自我介绍、项目复盘、沟通与 30 天计划，适合第一轮模拟。',
    generatedFrom: '面向中文招聘场景整理的面试基础题库，覆盖自我介绍、项目复盘和首轮面试准备。',
    focus: ['自我介绍', '项目复盘', '沟通表达', '岗位匹配'],
    questions: [
      buildPracticeQuestion(
        'interview-foundation-q1',
        '请做一个 90 秒的自我介绍，重点说明你和这个岗位最相关的经历。',
        'role_fit',
        'easy',
        ['岗位相关经历', '核心技能', '量化结果', '动机'],
        '优秀回答应快速说明背景、核心技能、可量化成绩，以及为什么想做这个岗位。'
      ),
      buildPracticeQuestion(
        'interview-foundation-q2',
        '讲一个你亲自推动落地的项目。背景是什么，你做了什么，结果如何？',
        'behavioral',
        'medium',
        ['背景', '职责', '决策', '结果', '复盘'],
        '优秀回答应交代背景、个人职责、关键决策、量化结果和复盘。'
      ),
      buildPracticeQuestion(
        'interview-foundation-q3',
        '当需求不清晰、信息不完整时，你通常如何推进工作？',
        'problem_solving',
        'medium',
        ['澄清问题', '优先级', '假设', '同步沟通', '结果'],
        '优秀回答应体现结构化拆解、优先级意识和及时同步。'
      ),
      buildPracticeQuestion(
        'interview-foundation-q4',
        '如果你和面试官或同事对方案有分歧，你会怎么表达并推动达成一致？',
        'communication',
        'medium',
        ['尊重', '证据', '取舍', '共识', '跟进'],
        '优秀回答应平衡尊重、事实依据、方案取舍和后续执行。'
      ),
      buildPracticeQuestion(
        'interview-foundation-q5',
        '如果你明天入职，你的前 30 天会怎么学习业务、建立关系并交付价值？',
        'behavioral',
        'hard',
        ['学习计划', '关键人', '快速成果', '指标', '风险'],
        '优秀回答应有可执行的入职计划、对关键关系人的识别和短期成果设计。'
      ),
    ],
  },
  {
    id: 'interview-technical-pack',
    title: '技术深挖题库',
    mode: 'interview',
    description: '更适合第二轮技术面，强调方案设计、排障和权衡表达。',
    generatedFrom: '面向技术二面的深挖题库，重点覆盖系统设计、排障和技术权衡。',
    focus: ['系统设计', '问题排查', '权衡', '技术表达'],
    questions: [
      buildPracticeQuestion(
        'interview-technical-q1',
        '请选一个你熟悉的项目，讲清楚核心架构、关键模块和数据流。',
        'technical',
        'medium',
        ['架构', '模块', '数据流', '关键决策', '收益'],
        '优秀回答应能从整体到细节说明系统架构、关键模块和设计收益。'
      ),
      buildPracticeQuestion(
        'interview-technical-q2',
        '线上出现严重问题时，你通常怎么定位、止损并推动修复？',
        'problem_solving',
        'medium',
        ['止损', '日志', '假设验证', '沟通', '复盘'],
        '优秀回答应优先控制影响，再逐步定位根因并沉淀复盘。'
      ),
      buildPracticeQuestion(
        'interview-technical-q3',
        '说一个你做技术取舍的例子。为什么放弃了另一个方案？',
        'technical',
        'hard',
        ['候选方案', '约束', '权衡', '风险', '结果'],
        '优秀回答应体现对约束、风险和业务目标的综合判断。'
      ),
      buildPracticeQuestion(
        'interview-technical-q4',
        '你会怎么向非技术同学解释一个复杂技术方案的收益和风险？',
        'communication',
        'medium',
        ['简化语言', '业务收益', '风险', '边界', '下一步'],
        '优秀回答应避免堆术语，并让业务方能理解价值和风险。'
      ),
      buildPracticeQuestion(
        'interview-technical-q5',
        '如果让你接手一个陌生系统，你会如何在两周内建立判断并提出改进建议？',
        'role_fit',
        'hard',
        ['现状摸底', '关键指标', '风险清单', '优先级', '建议'],
        '优秀回答应体现快速上手、抓住重点和可落地建议。'
      ),
    ],
  },
  {
    id: 'written-delivery-pack',
    title: '笔试交付题库',
    mode: 'written',
    description: '适合笔试演练，覆盖方案设计、质量把关和结构化表达。',
    generatedFrom: '面向笔试和书面作答的练习题库，重点覆盖实施方案、质量检查和结构化表达。',
    focus: ['实现方案', '测试清单', '结构化表达', '交付质量'],
    questions: [
      buildPracticeQuestion(
        'written-delivery-q1',
        '为一个核心功能写出实现方案，说明模块拆分、数据流和潜在风险。',
        'technical',
        'medium',
        ['模块拆分', '数据流', '风险', '权衡', '验证'],
        '优秀回答应结构清晰，涵盖模块、数据流、风险和验证方式。'
      ),
      buildPracticeQuestion(
        'written-delivery-q2',
        '如果你要给这个功能写测试计划，你会覆盖哪些关键场景？',
        'technical',
        'medium',
        ['主流程', '边界', '异常', '性能', '回归'],
        '优秀回答应覆盖主流程、边界条件、异常处理和回归策略。'
      ),
      buildPracticeQuestion(
        'written-delivery-q3',
        '请描述一次你在信息不全的情况下做判断的过程。',
        'problem_solving',
        'medium',
        ['问题定义', '假设', '验证', '沟通', '结果'],
        '优秀回答应体现推理过程、验证动作和结果反馈。'
      ),
      buildPracticeQuestion(
        'written-delivery-q4',
        '如何把一个复杂方案写成让招聘方快速看懂的短文？',
        'communication',
        'easy',
        ['结论先行', '背景', '关键动作', '结果', '简洁'],
        '优秀回答应做到结论清楚、层次明确、信息密度高。'
      ),
      buildPracticeQuestion(
        'written-delivery-q5',
        '请说明你为什么适合这个岗位，并列出前三个最强竞争点。',
        'role_fit',
        'medium',
        ['岗位相关性', '技能', '成果', '成长性', '动机'],
        '优秀回答应围绕岗位需求组织亮点，而不是泛泛自夸。'
      ),
    ],
  },
]

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(1, '0')}:${(seconds % 60)
    .toString()
    .padStart(2, '0')}`
}

function recommendationLabel(value: AssessmentRecommendation | null) {
  switch (value) {
    case 'strong_yes':
      return '强烈推荐'
    case 'yes':
      return '推荐'
    case 'hold':
      return '待定'
    case 'no':
      return '不推荐'
    default:
      return '待评分'
  }
}

function recommendationColor(value: AssessmentRecommendation | null) {
  switch (value) {
    case 'strong_yes':
      return 'bg-emerald-100 text-emerald-700'
    case 'yes':
      return 'bg-blue-100 text-blue-700'
    case 'hold':
      return 'bg-amber-100 text-amber-700'
    case 'no':
      return 'bg-rose-100 text-rose-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function statusColor(status: AssessmentRecord['status']) {
  switch (status) {
    case 'scored':
      return 'bg-emerald-100 text-emerald-700'
    case 'submitted':
      return 'bg-blue-100 text-blue-700'
    case 'in_progress':
      return 'bg-amber-100 text-amber-700'
    case 'draft':
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function statusLabel(status: AssessmentRecord['status']) {
  switch (status) {
    case 'scored':
      return '已评分'
    case 'submitted':
      return '已提交'
    case 'in_progress':
      return '进行中'
    case 'draft':
    default:
      return '草稿'
  }
}

function sourceLabel(source: AssessmentRecord['source']) {
  switch (source) {
    case 'openai':
      return 'OpenAI'
    case 'heuristic':
    default:
      return '本地规则'
  }
}

function modeLabel(mode: AssessmentMode) {
  return mode === 'written' ? '笔试评估' : '面试评估'
}

function answerEditorLabel(mode: AssessmentMode) {
  return mode === 'written' ? '候选人答案' : '面试记录'
}

function answerEditorPlaceholder(mode: AssessmentMode) {
  return mode === 'written'
    ? '直接填写你的书面答案，建议按背景、方案、验证与结果展开。'
    : '在这里记录候选人的回答、追问要点和你的面试观察。'
}

function difficultyLabel(value: string) {
  switch (value) {
    case 'easy':
      return '简单'
    case 'medium':
      return '中等'
    case 'hard':
      return '困难'
    default:
      return value
  }
}

function categoryLabel(value: string) {
  switch (value) {
    case 'technical':
      return '技术能力'
    case 'problem_solving':
      return '解决问题'
    case 'behavioral':
      return '行为表现'
    case 'communication':
      return '沟通表达'
    case 'role_fit':
      return '岗位匹配'
    default:
      return value
  }
}

function localizeAssessmentTitle(title: string) {
  return title
    .replace(/^Interview Session - /, '面试评估 - ')
    .replace(/^Written Assessment - /, '笔试评估 - ')
}

function syncRecord(records: AssessmentRecord[], next: AssessmentRecord) {
  const index = records.findIndex((item) => item.id === next.id)
  if (index === -1) {
    return [next, ...records]
  }

  const updated = [...records]
  updated[index] = next
  return updated.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

function answerText(answer: Pick<AssessmentAnswer, 'answer' | 'transcript'> | null | undefined) {
  return answer?.answer.trim() ?? ''
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
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

function readinessLabel(score: number) {
  if (score >= 85) return '已接近完成'
  if (score >= 70) return '方向正确'
  if (score >= 50) return '还需补强'
  return '建议重构回答'
}

function buildLiveAnswerFeedback(
  question: AssessmentQuestion,
  answer: Pick<AssessmentAnswer, 'answer' | 'transcript'> | null | undefined
): LiveAnswerFeedback {
  const text = answerText(answer)
  const normalized = text.toLowerCase()
  const contentUnits = estimateAnswerUnits(text)
  const matchedPoints = question.expectedPoints.filter((point) => normalized.includes(point.toLowerCase()))
  const missingPoints = question.expectedPoints.filter((point) => !matchedPoints.includes(point))
  const coverage = question.expectedPoints.length === 0 ? 0 : matchedPoints.length / question.expectedPoints.length
  const completion = Math.min(contentUnits / (question.difficulty === 'hard' ? 130 : question.difficulty === 'medium' ? 95 : 65), 1)
  const structureSignals = ['首先', '其次', '最后', '第一', '第二', '然后', '因此', '所以', 'because', 'therefore', 'finally', 'tradeoff']
  const evidenceSignals = ['例如', '比如', '提升', '降低', '增长', '数据', '指标', '用户', '准确率', '时延', 'users', '%', 'latency', 'accuracy', 'metric']
  const structureHits = structureSignals.filter((signal) => normalized.includes(signal.toLowerCase())).length
  const evidenceHits = evidenceSignals.filter((signal) => normalized.includes(signal.toLowerCase())).length
  const weighted =
    coverage * 0.52 +
    completion * 0.18 +
    Math.min(structureHits / 3, 1) * 0.15 +
    Math.min(evidenceHits / 3, 1) * 0.15
  const estimatedScore = Math.round(question.maxScore * Math.min(Math.max(weighted, 0), 1))
  const coachingTips: string[] = []

  if (contentUnits < 40) {
    coachingTips.push('答案偏短，建议补上背景、动作和结果。')
  }
  if (missingPoints.length > 0) {
    coachingTips.push(`还没明确覆盖：${missingPoints.slice(0, 3).join('、')}。`)
  }
  if (structureHits === 0) {
    coachingTips.push('可用“首先/其次/最后”增强结构感。')
  }
  if (evidenceHits === 0) {
    coachingTips.push('补一个量化结果或具体例子，可信度会更高。')
  }

  return {
    estimatedScore,
    readinessLabel: readinessLabel(Math.round((estimatedScore / Math.max(question.maxScore, 1)) * 100)),
    coveragePercent: Math.round(coverage * 100),
    completionPercent: Math.round(completion * 100),
    contentUnits,
    matchedPoints,
    missingPoints,
    coachingTips: coachingTips.slice(0, 3),
  }
}

function clonePracticePack(pack: PracticePack) {
  return {
    ...pack,
    questions: pack.questions.map((question) => ({
      ...question,
      id: crypto.randomUUID(),
      expectedPoints: [...question.expectedPoints],
    })),
  }
}

export function InterviewSimulator() {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [records, setRecords] = useState<AssessmentRecord[]>([])
  const [mode, setMode] = useState<AssessmentMode>('interview')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [applyingPackId, setApplyingPackId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const activeRecord = useMemo(
    () => records.find((item) => item.id === activeRecordId) ?? null,
    [records, activeRecordId]
  )

  const scoredRecords = useMemo(
    () => records.filter((item) => item.status === 'scored' && item.summary.overallScore !== null),
    [records]
  )

  const practicePacks = useMemo(() => {
    const libraryPacks = PRACTICE_PACK_LIBRARY.filter((pack) => pack.mode === mode)
    const historicalPacks = records
      .filter((record) => record.mode === mode)
      .slice(0, 3)
      .map((record) => ({
        id: `history-${record.id}`,
        title: `历史练习包：${localizeAssessmentTitle(record.title)}`,
        mode: record.mode,
        description: '从最近的练习记录中复用整套题目，适合反复练习同一岗位方向。',
        generatedFrom: `从 ${localizeAssessmentTitle(record.title)} 复制而来，用于同岗位方向的重复练习。`,
        focus: Array.from(new Set(record.questions.flatMap((question) => question.expectedPoints))).slice(0, 4),
        questions: record.questions,
      }))

    return [...libraryPacks, ...historicalPacks]
  }, [mode, records])

  const stats = useMemo(() => {
    const averageScore =
      scoredRecords.length === 0
        ? 0
        : Math.round(
            scoredRecords.reduce((sum, item) => sum + (item.summary.overallScore ?? 0), 0) / scoredRecords.length
          )

    return {
      total: records.length,
      interviews: records.filter((item) => item.mode === 'interview').length,
      written: records.filter((item) => item.mode === 'written').length,
      averageScore,
    }
  }, [records, scoredRecords])

  const activeQuestion = activeRecord?.questions[currentQuestion] ?? null
  const activeAnswer =
    activeQuestion && activeRecord
      ? activeRecord.answers.find((item) => item.questionId === activeQuestion.id) ?? null
      : null

  const liveFeedback = useMemo(() => {
    if (!activeQuestion) {
      return null
    }

    return buildLiveAnswerFeedback(activeQuestion, activeAnswer)
  }, [activeAnswer, activeQuestion])

  const liveRubricPreview = useMemo(() => {
    if (!activeRecord) {
      return null
    }

    const technicalScores: number[] = []
    const communicationScores: number[] = []
    const structuredScores: number[] = []
    const roleFitScores: number[] = []

    activeRecord.questions.forEach((question) => {
      const answer = activeRecord.answers.find((item) => item.questionId === question.id) ?? null
      const feedback = buildLiveAnswerFeedback(question, answer)
      const percentScore = Math.round((feedback.estimatedScore / Math.max(question.maxScore, 1)) * 100)
      const normalized = answerText(answer).toLowerCase()
      const structureScore = Math.min(
        100,
        Math.round(
          feedback.completionPercent * 0.35 +
            feedback.coveragePercent * 0.35 +
            (normalized.includes('首先') || normalized.includes('because') || normalized.includes('finally') ? 30 : 10)
        )
      )

      if (question.category === 'technical' || question.category === 'problem_solving') {
        technicalScores.push(percentScore)
      }
      if (question.category === 'communication') {
        communicationScores.push(percentScore)
      }
      if (question.category === 'behavioral' || question.category === 'role_fit') {
        roleFitScores.push(percentScore)
      }
      structuredScores.push(structureScore)
      if (question.category !== 'communication') {
        communicationScores.push(Math.round(feedback.coveragePercent * 0.45 + feedback.completionPercent * 0.55))
      }
    })

    return {
      technical: average(technicalScores),
      communication: average(communicationScores),
      structuredThinking: average(structuredScores),
      roleFit: average(roleFitScores),
    } satisfies AssessmentRubric
  }, [activeRecord])

  const progressMetrics = useMemo(() => {
    if (!activeRecord) {
      return null
    }

    const answeredCount = activeRecord.answers.filter((answer) => answerText(answer).length > 0).length
    const completionRate =
      activeRecord.questions.length === 0 ? 0 : Math.round((answeredCount / activeRecord.questions.length) * 100)
    const rubric = activeRecord.summary.overallScore !== null ? activeRecord.summary.rubric : liveRubricPreview

    if (!rubric) {
      return {
        answeredCount,
        completionRate,
        strongestDimension: '待开始',
        weakestDimension: '待开始',
      }
    }

    const dimensions = [
      { label: '技术能力', value: rubric.technical },
      { label: '沟通表达', value: rubric.communication },
      { label: '结构化思维', value: rubric.structuredThinking },
      { label: '岗位匹配', value: rubric.roleFit },
    ].sort((left, right) => right.value - left.value)

    return {
      answeredCount,
      completionRate,
      strongestDimension: dimensions[0]?.label ?? '待开始',
      weakestDimension: dimensions[dimensions.length - 1]?.label ?? '待开始',
    }
  }, [activeRecord, liveRubricPreview])

  const previewOverallScore = useMemo(() => {
    if (!liveRubricPreview) {
      return null
    }

    return average([
      liveRubricPreview.technical,
      liveRubricPreview.communication,
      liveRubricPreview.structuredThinking,
      liveRubricPreview.roleFit,
    ])
  }, [liveRubricPreview])

  const displayRubric =
    activeRecord && activeRecord.summary.overallScore !== null ? activeRecord.summary.rubric : liveRubricPreview

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError('')

        const [jobResponse, resumeResponse, assessmentResponse] = await Promise.all([
          fetch('/api/jobs?mode=published', { cache: 'no-store' }),
          fetch('/api/resumes', { cache: 'no-store' }),
          fetch('/api/assessments', { cache: 'no-store' }),
        ])

        const jobData = (await jobResponse.json()) as JobRecord[] | { error?: string }
        const resumeData = (await resumeResponse.json()) as ResumeListItem[] | { error?: string }
        const assessmentData = (await assessmentResponse.json()) as AssessmentRecord[] | { error?: string }

        if (!jobResponse.ok || !Array.isArray(jobData)) {
          throw new Error('加载已发布岗位失败。')
        }

        if (!resumeResponse.ok || !Array.isArray(resumeData)) {
          throw new Error('加载简历记录失败。')
        }

        if (!assessmentResponse.ok || !Array.isArray(assessmentData)) {
          throw new Error('加载评估历史失败。')
        }

        setJobs(jobData)
        setResumes(resumeData)
        setRecords(assessmentData)
        setSelectedJobId(jobData[0]?.id ?? '')
        setSelectedResumeId(resumeData[0]?.id ?? '')
        setActiveRecordId(assessmentData[0]?.id ?? null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '加载评估工作室失败。')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  useEffect(() => {
    if (!activeRecord) {
      setCurrentQuestion(0)
      setElapsedSeconds(0)
      return
    }

    setMode(activeRecord.mode)
    setSelectedJobId((current) => activeRecord.jobId ?? current)
    setSelectedResumeId((current) => activeRecord.resumeId ?? current)
    setCurrentQuestion(0)
    setElapsedSeconds(activeRecord.summary.sessionDurationSeconds)
  }, [activeRecordId])

  function updateActiveRecord(next: AssessmentRecord) {
    setRecords((current) => syncRecord(current, next))
    setActiveRecordId(next.id)
  }

  function handleModeChange(nextMode: AssessmentMode) {
    setMode(nextMode)

    if (activeRecord && activeRecord.mode !== nextMode) {
      setActiveRecordId(null)
      setMessage('已切换评估模式，请重新生成题目。')
    }
  }

  function handleJobChange(nextJobId: string) {
    setSelectedJobId(nextJobId)

    if (activeRecord && (activeRecord.jobId ?? '') !== nextJobId) {
      setActiveRecordId(null)
      setMessage('已切换岗位，请重新生成题目。')
    }
  }

  function handleResumeChange(nextResumeId: string) {
    setSelectedResumeId(nextResumeId)

    if (activeRecord && (activeRecord.resumeId ?? '') !== nextResumeId) {
      setActiveRecordId(null)
      setMessage('已切换候选人简历，请重新生成题目。')
    }
  }

  async function generateAssessment() {
    try {
      setGenerating(true)
      setError('')
      setMessage('正在生成题目，如 AI 响应较慢会自动回退到本地规则。')

      const response = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          jobId: selectedJobId || undefined,
          resumeId: selectedResumeId || undefined,
        }),
      })

      const data = (await response.json()) as AssessmentRecord | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : '生成评估失败。')
      }

      updateActiveRecord(data)
      setElapsedSeconds(0)
      setMessage('评估已生成。')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '生成评估失败。')
    } finally {
      setGenerating(false)
    }
  }

  async function applyPracticePack(pack: PracticePack) {
    try {
      setApplyingPackId(pack.id)
      setError('')
      setMessage('')

      const nextPack = clonePracticePack(pack)
      let targetRecord = activeRecord

      if (!targetRecord || targetRecord.mode !== pack.mode) {
        const response = await fetch('/api/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: pack.mode,
            jobId: selectedJobId || undefined,
            resumeId: selectedResumeId || undefined,
          }),
        })

        const payload = (await response.json()) as AssessmentRecord | { error?: string }
        if (!response.ok || !('id' in payload)) {
          throw new Error('error' in payload && payload.error ? payload.error : '生成练习题库载体失败。')
        }

        targetRecord = payload
      }

      const updateResponse = await fetch(`/api/assessments/${targetRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: nextPack.title,
          generatedFrom: nextPack.generatedFrom,
          questions: nextPack.questions,
          sessionDurationSeconds: 0,
        }),
      })

      const updatePayload = (await updateResponse.json()) as AssessmentRecord | { error?: string }
      if (!updateResponse.ok || !('id' in updatePayload)) {
        throw new Error('error' in updatePayload && updatePayload.error ? updatePayload.error : '载入练习题库失败。')
      }

      setMode(nextPack.mode)
      setCurrentQuestion(0)
      setElapsedSeconds(0)
      updateActiveRecord(updatePayload)
      setMessage(`已载入练习题库：${nextPack.title}`)
    } catch (packError) {
      setError(packError instanceof Error ? packError.message : '载入练习题库失败。')
    } finally {
      setApplyingPackId(null)
    }
  }

  function updateAnswer(questionId: string, answer: string) {
    if (!activeRecord) {
      return
    }

    const nextRecord: AssessmentRecord = {
      ...activeRecord,
      answers: activeRecord.answers.map((item) =>
        item.questionId === questionId
          ? {
              ...item,
              answer,
            }
          : item
      ),
    }

    updateActiveRecord(nextRecord)
  }

  async function saveDraft() {
    if (!activeRecord) {
      return
    }

    try {
      setSaving(true)
      setError('')
      setMessage('')

      const hasContent = activeRecord.answers.some((item) => item.answer.trim().length > 0)
      const response = await fetch(`/api/assessments/${activeRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: activeRecord.answers,
          sessionDurationSeconds: elapsedSeconds,
          status: activeRecord.status === 'scored' ? 'scored' : hasContent ? 'in_progress' : 'draft',
        }),
      })

      const data = (await response.json()) as AssessmentRecord | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : '保存草稿失败。')
      }

      updateActiveRecord(data)
      setMessage('草稿已保存。')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存草稿失败。')
    } finally {
      setSaving(false)
    }
  }

  async function submitForScoring() {
    if (!activeRecord) {
      return
    }

    try {
      setScoring(true)
      setError('')
      setMessage('')

      const response = await fetch(`/api/assessments/${activeRecord.id}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: activeRecord.answers,
          sessionDurationSeconds: elapsedSeconds,
        }),
      })

      const data = (await response.json()) as AssessmentRecord | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : '评估评分失败。')
      }

      updateActiveRecord(data)
      setMessage('评估已完成评分。')
    } catch (scoreError) {
      setError(scoreError instanceof Error ? scoreError.message : '评估评分失败。')
    } finally {
      setScoring(false)
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">正在加载评估工作室...</span>
      </div>
    )
  }

  return (
    <div className="notranslate space-y-6" translate="no">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">面试准备</h1>
          <p className="mt-2 text-gray-600">
            在一个页面内完成 AI 面试模拟、练习题库调用、实时反馈查看和绩效分析。
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card"><p className="text-sm text-gray-500">评估总数</p><p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p></div>
        <div className="card"><p className="text-sm text-gray-500">面试场次</p><p className="mt-1 text-2xl font-bold text-violet-700">{stats.interviews}</p></div>
        <div className="card"><p className="text-sm text-gray-500">笔试数量</p><p className="mt-1 text-2xl font-bold text-blue-700">{stats.written}</p></div>
        <div className="card"><p className="text-sm text-gray-500">平均分</p><p className="mt-1 text-2xl font-bold text-emerald-700">{stats.averageScore}%</p></div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">评估模式</label>
            <select
              value={mode}
              onChange={(event) => handleModeChange(event.target.value as AssessmentMode)}
              className="input-field"
            >
              <option value="interview">面试评估</option>
              <option value="written">笔试评估</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">岗位</label>
            <select
              value={selectedJobId}
              onChange={(event) => handleJobChange(event.target.value)}
              className="input-field"
            >
              <option value="">通用岗位</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} - {job.company}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">候选人简历</label>
            <select
              value={selectedResumeId}
              onChange={(event) => handleResumeChange(event.target.value)}
              className="input-field"
            >
              <option value="">未关联简历</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.contact.name || resume.fileName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={generateAssessment}
              className="btn-primary flex w-full items-center justify-center gap-2"
              disabled={generating}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span>{generating ? '生成中...' : '生成题目'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">练习题库</h3>
            <p className="text-sm text-gray-600">
              先用题库快速起练，再切回当前评估继续填写和评分。
            </p>
          </div>
          <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700">
            当前模式：{modeLabel(mode)}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {practicePacks.map((pack) => (
            <div key={pack.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-gray-900">{pack.title}</h4>
                  <p className="mt-1 text-sm text-gray-600">{pack.description}</p>
                </div>
                <BookOpen className="h-5 w-5 text-primary-500" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {pack.focus.map((item) => (
                  <span key={`${pack.id}-${item}`} className="rounded-full bg-white px-2 py-1 text-xs text-gray-600">
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {pack.questions.slice(0, 2).map((question, index) => (
                  <div key={question.id} className="rounded-lg bg-white p-3 text-sm text-gray-600">
                    <p className="font-medium text-gray-900">Q{index + 1}</p>
                    <p className="mt-1 line-clamp-2">{question.prompt}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => void applyPracticePack(pack)}
                className="btn-secondary mt-4 flex w-full items-center justify-center gap-2"
                disabled={applyingPackId === pack.id}
              >
                {applyingPackId === pack.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>{applyingPackId === pack.id ? '载入中...' : '载入这套练习题'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="card">
            {activeRecord ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold text-gray-900">{localizeAssessmentTitle(activeRecord.title)}</h2>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor(activeRecord.status)}`}>
                        {statusLabel(activeRecord.status)}
                      </span>
                      <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700">
                        {sourceLabel(activeRecord.source)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">基于岗位要求与候选人资料生成的评估内容。</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" />{activeRecord.jobTitle || '通用岗位'}</span>
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{activeRecord.candidateName || '未关联候选人'}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDuration(elapsedSeconds)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={saveDraft}
                      className="btn-secondary flex items-center gap-2"
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      <span>{saving ? '保存中...' : '保存草稿'}</span>
                    </button>
                    <button
                      onClick={submitForScoring}
                      className="btn-primary"
                      disabled={scoring}
                    >
                      {scoring ? '评分中...' : '提交并评分'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="space-y-3 lg:col-span-1">
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        {activeRecord.mode === 'written' ? <FileText className="h-5 w-5 text-blue-600" /> : <Video className="h-5 w-5 text-violet-600" />}
                        <h3 className="text-lg font-semibold text-gray-900">题目列表</h3>
                      </div>
                      <div className="space-y-3">
                        {activeRecord.questions.map((question, index) => (
                          <button
                            key={question.id}
                            onClick={() => setCurrentQuestion(index)}
                            className={`w-full rounded-xl border p-3 text-left transition-colors ${
                              index === currentQuestion ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-gray-900">Q{index + 1}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                                {categoryLabel(question.category)}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-3 text-sm text-gray-600">{question.prompt}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 lg:col-span-2">
                    {activeRecord.questions.map((question, index) => {
                      const answer = activeRecord.answers.find((item) => item.questionId === question.id)
                      const isCurrent = currentQuestion === index
                      const realtimeFeedback = isCurrent ? liveFeedback : null

                      return (
                        <div key={question.id} className={`rounded-xl border p-4 ${isCurrent ? 'border-primary-400 bg-primary-50/30' : 'border-gray-200 bg-white'}`}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-gray-900 px-2 py-1 text-xs font-medium text-white">Q{index + 1}</span>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{difficultyLabel(question.difficulty)}</span>
                                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">{question.maxScore} 分</span>
                              </div>
                              <p className="mt-3 text-sm font-medium text-gray-900">{question.prompt}</p>
                            </div>
                            {answer?.score !== null && (
                              <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                                {answer?.score ?? 0}/{question.maxScore}
                              </div>
                            )}
                          </div>

                          <div className="mt-4">
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                              {answerEditorLabel(activeRecord.mode)}
                            </label>
                            <textarea
                              rows={activeRecord.mode === 'written' ? 7 : 5}
                              value={answer?.answer ?? ''}
                              onChange={(event) => updateAnswer(question.id, event.target.value)}
                              className="input-field"
                              placeholder={answerEditorPlaceholder(activeRecord.mode)}
                            />
                          </div>

                          {realtimeFeedback && (
                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Lightbulb className="h-5 w-5 text-amber-600" />
                                    <p className="text-sm font-semibold text-amber-900">实时反馈</p>
                                  </div>
                                  <p className="mt-1 text-sm text-amber-800">
                                    基于当前答案内容即时估算覆盖度、完整度和表达状态。
                                  </p>
                                </div>
                                <div className="rounded-full bg-white px-3 py-1 text-sm font-medium text-amber-800">
                                  预估 {realtimeFeedback.estimatedScore}/{question.maxScore} 分
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                                <div className="rounded-lg bg-white p-3">
                                  <p className="text-xs text-gray-500">回答状态</p>
                                  <p className="mt-1 text-sm font-semibold text-gray-900">{realtimeFeedback.readinessLabel}</p>
                                </div>
                                <div className="rounded-lg bg-white p-3">
                                  <p className="text-xs text-gray-500">要点覆盖</p>
                                  <p className="mt-1 text-sm font-semibold text-gray-900">{realtimeFeedback.coveragePercent}%</p>
                                </div>
                                <div className="rounded-lg bg-white p-3">
                                  <p className="text-xs text-gray-500">内容完整度</p>
                                  <p className="mt-1 text-sm font-semibold text-gray-900">{realtimeFeedback.completionPercent}%</p>
                                </div>
                                <div className="rounded-lg bg-white p-3">
                                  <p className="text-xs text-gray-500">内容长度</p>
                                  <p className="mt-1 text-sm font-semibold text-gray-900">{realtimeFeedback.contentUnits}</p>
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div className="rounded-lg bg-white p-4">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <p className="text-sm font-medium text-gray-900">已覆盖要点</p>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {realtimeFeedback.matchedPoints.length > 0 ? (
                                      realtimeFeedback.matchedPoints.map((point) => (
                                        <span key={point} className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                                          {point}
                                        </span>
                                      ))
                                    ) : (
                                      <p className="text-sm text-gray-500">当前答案还没有明显覆盖到关键要点。</p>
                                    )}
                                  </div>
                                </div>

                                <div className="rounded-lg bg-white p-4">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                    <p className="text-sm font-medium text-gray-900">待补充内容</p>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {realtimeFeedback.missingPoints.length > 0 ? (
                                      realtimeFeedback.missingPoints.map((point) => (
                                        <span key={point} className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                                          {point}
                                        </span>
                                      ))
                                    ) : (
                                      <p className="text-sm text-gray-500">当前题目的关键点已经覆盖得比较完整。</p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 rounded-lg bg-white p-4">
                                <div className="flex items-center gap-2">
                                  <Lightbulb className="h-4 w-4 text-amber-600" />
                                  <p className="text-sm font-medium text-gray-900">即时教练建议</p>
                                </div>
                                <div className="mt-3 space-y-2">
                                  {realtimeFeedback.coachingTips.length > 0 ? (
                                    realtimeFeedback.coachingTips.map((tip) => (
                                      <p key={tip} className="text-sm text-gray-600">
                                        {tip}
                                      </p>
                                    ))
                                  ) : (
                                    <p className="text-sm text-gray-600">当前答案结构较完整，可以继续补充更具体的数据或案例来拉高说服力。</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <div className="rounded-lg bg-gray-50 p-4">
                              <p className="text-sm font-medium text-gray-900">考察要点</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {question.expectedPoints.map((point) => (
                                  <span key={point} className="rounded-md bg-primary-100 px-2 py-1 text-xs text-primary-700">
                                    {point}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-4">
                              <p className="text-sm font-medium text-gray-900">评估反馈</p>
                              <p className="mt-2 text-sm text-gray-600">
                                {answer?.feedback ?? '提交评分后会在这里显示反馈。'}
                              </p>
                              {(answer?.strengths.length ?? 0) > 0 && (
                                <p className="mt-2 text-xs text-emerald-700">优势：{answer?.strengths.join(', ')}</p>
                              )}
                              {(answer?.gaps.length ?? 0) > 0 && (
                                <p className="mt-1 text-xs text-amber-700">待补充：{answer?.gaps.join(', ')}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <GraduationCap className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">暂未选择评估</h3>
                <p className="mt-2 text-sm text-gray-500">
                  先生成一套笔试或面试评估，之后就可以开始填写和评分。
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">绩效分析</h3>
              <Target className="h-5 w-5 text-amber-500" />
            </div>
            {activeRecord && progressMetrics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-amber-50 p-4">
                    <p className="text-xs text-amber-700">已完成题目</p>
                    <p className="mt-1 text-2xl font-bold text-amber-900">
                      {progressMetrics.answeredCount}/{activeRecord.questions.length}
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-4">
                    <p className="text-xs text-blue-700">完成进度</p>
                    <p className="mt-1 text-2xl font-bold text-blue-900">{progressMetrics.completionRate}%</p>
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-gray-600">当前练习进度</span>
                    <span className="font-medium text-gray-900">{progressMetrics.completionRate}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div className="h-2 rounded-full bg-amber-500" style={{ width: `${progressMetrics.completionRate}%` }}></div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-600">
                    <p>优势维度：{progressMetrics.strongestDimension}</p>
                    <p>待加强维度：{progressMetrics.weakestDimension}</p>
                    {liveFeedback && (
                      <p>当前题状态：{liveFeedback.readinessLabel}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {displayRubric ? (
                    [
                      { key: 'technical', label: '技术能力', value: displayRubric.technical },
                      { key: 'communication', label: '沟通表达', value: displayRubric.communication },
                      { key: 'structuredThinking', label: '结构化思维', value: displayRubric.structuredThinking },
                      { key: 'roleFit', label: '岗位匹配', value: displayRubric.roleFit },
                    ].map((item) => (
                      <div key={item.key}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="font-medium text-gray-900">{item.value}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-200">
                          <div className="h-2 rounded-full bg-amber-500" style={{ width: `${item.value}%` }}></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">开始填写答案后，这里会出现绩效预估。</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">载入一套练习题后，这里会显示答题进度与维度表现。</p>
            )}
          </div>

          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">评分概览</h3>
              <TrendingUp className="h-5 w-5 text-primary-500" />
            </div>
            {activeRecord ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">
                      {activeRecord.summary.overallScore !== null ? '综合得分' : '实时预估得分'}
                    </p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {(activeRecord.summary.overallScore ?? previewOverallScore) ?? '--'}
                      {(activeRecord.summary.overallScore ?? previewOverallScore) !== null ? '%' : ''}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      activeRecord.summary.overallScore !== null
                        ? recommendationColor(activeRecord.summary.recommendation)
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {activeRecord.summary.overallScore !== null ? recommendationLabel(activeRecord.summary.recommendation) : '实时预估'}
                  </span>
                </div>

                <div className="space-y-3">
                  {[
                    { key: 'technical', label: '技术能力', value: displayRubric?.technical ?? 0 },
                    { key: 'communication', label: '沟通表达', value: displayRubric?.communication ?? 0 },
                    { key: 'structuredThinking', label: '结构化思维', value: displayRubric?.structuredThinking ?? 0 },
                    { key: 'roleFit', label: '岗位匹配', value: displayRubric?.roleFit ?? 0 },
                  ].map((item) => (
                    <div key={item.key}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-medium text-gray-900">{item.value}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${item.value}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">评估结论</p>
                  <p className="mt-2 text-sm text-gray-600">
                    {activeRecord.summary.overallScore !== null
                      ? activeRecord.summary.summary
                      : '系统会根据当前答案的覆盖度、结构化表达和岗位匹配度，持续刷新这一份练习中的实时预估。'}
                  </p>
                  <p className="mt-3 text-sm font-medium text-gray-900">下一步建议</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {activeRecord.summary.overallScore !== null
                      ? activeRecord.summary.nextStep
                      : progressMetrics
                        ? `优先补强 ${progressMetrics.weakestDimension}，并把未覆盖要点补充完整后再提交正式评分。`
                        : '继续补充答案内容，再提交正式评分。'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">生成并评分后，这里会显示评估总结。</p>
            )}
          </div>

          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">最近记录</h3>
              <MessageSquare className="h-5 w-5 text-primary-500" />
            </div>
            <div className="space-y-3">
              {records.length === 0 && (
                <p className="text-sm text-gray-500">暂无评估历史记录。</p>
              )}
              {records.map((record) => (
                <button
                  key={record.id}
                  onClick={() => setActiveRecordId(record.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    activeRecordId === record.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-gray-900">{localizeAssessmentTitle(record.title)}</p>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusColor(record.status)}`}>
                      {statusLabel(record.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {modeLabel(record.mode)} / {record.jobTitle || '通用岗位'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {record.candidateName || '未关联候选人'} / {record.summary.overallScore ?? '--'}{record.summary.overallScore !== null ? '%' : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
