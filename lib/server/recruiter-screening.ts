import { createAssessmentDraft } from '@/lib/server/assessment-engine'
import type { ApplicationRecord } from '@/types/application'
import type { AppUser } from '@/types/auth'
import type { AssessmentRecommendation } from '@/types/assessment'
import type { JobRecord } from '@/types/job'
import type { ResumeInsight, ResumeRecord } from '@/types/resume'
import type { RecruiterScreeningBreakdown, RecruiterScreeningRecord } from '@/types/screening'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function coverageScore(required: string[], candidateSkills: string[]) {
  if (required.length === 0) {
    return 80
  }

  const candidateSet = new Set(candidateSkills.map(normalizeText))
  const matched = required.filter((skill) => candidateSet.has(normalizeText(skill)))
  return Math.round((matched.length / required.length) * 100)
}

function experienceScore(resume: ResumeRecord, job: JobRecord) {
  const years = resume.profile.yearsExperience
  const required = job.minYearsExperience

  if (years === null || Number.isNaN(years)) {
    return required > 0 ? 55 : 72
  }

  if (years >= required + 2) return 95
  if (years >= required) return 86
  if (required === 0) return 80

  return clamp(Math.round((years / required) * 82), 35, 82)
}

function communicationScore(resume: ResumeRecord) {
  const email = resume.contact.email ? 1 : 0
  const phone = resume.contact.phone ? 1 : 0
  const location = resume.contact.location ? 1 : 0
  const structureBonus = resume.summary.length > 80 ? 1 : 0

  return clamp(45 + (email + phone + location + structureBonus) * 13, 45, 97)
}

function recommendationFromScore(score: number): AssessmentRecommendation {
  if (score >= 85) return 'strong_yes'
  if (score >= 72) return 'yes'
  if (score >= 58) return 'hold'
  return 'no'
}

function buildHighlights(job: JobRecord, resume: ResumeRecord) {
  const matchedRequiredSkills = job.requiredSkills.filter((skill) =>
    resume.profile.skills.some((candidateSkill) => normalizeText(candidateSkill) === normalizeText(skill))
  )

  const insightHighlights = resume.insights
    .filter((insight) => insight.type === 'strength')
    .map((insight) => insight.title)

  const highlights = [
    matchedRequiredSkills.length > 0 ? `命中核心技能：${matchedRequiredSkills.slice(0, 4).join('、')}` : '',
    resume.profile.yearsExperience !== null ? `识别到约 ${resume.profile.yearsExperience} 年相关经验` : '工作年限仍需人工确认',
    insightHighlights[0] ? `简历亮点：${insightHighlights[0]}` : '',
  ]

  return dedupe(highlights.filter(Boolean)).slice(0, 4)
}

function buildRisks(job: JobRecord, resume: ResumeRecord) {
  const missingRequiredSkills = job.requiredSkills.filter(
    (skill) =>
      !resume.profile.skills.some((candidateSkill) => normalizeText(candidateSkill) === normalizeText(skill))
  )

  const riskInsights = resume.insights
    .filter((insight) => insight.type !== 'strength')
    .map((insight) => insight.description)

  const risks = [
    missingRequiredSkills.length > 0 ? `缺少关键技能：${missingRequiredSkills.slice(0, 4).join('、')}` : '',
    !resume.contact.email ? '候选人邮箱缺失，后续触达链路不完整。' : '',
    resume.score < 65 ? '简历质量分偏低，建议复核表达完整度与项目细节。' : '',
    riskInsights[0] ?? '',
  ]

  return dedupe(risks.filter(Boolean)).slice(0, 4)
}

function buildInterviewFocus(job: JobRecord, resume: ResumeRecord, risks: string[]) {
  const focusFromSkills = job.requiredSkills.filter(
    (skill) =>
      !resume.profile.skills.some((candidateSkill) => normalizeText(candidateSkill) === normalizeText(skill))
  )

  const focusFromInsights = resume.insights
    .filter((insight) => insight.type !== 'strength')
    .map((insight) => insight.title)

  return dedupe([
    ...focusFromSkills.map((skill) => `重点追问 ${skill} 的真实项目深度与落地细节。`),
    ...focusFromInsights.map((title) => `围绕“${title}”继续追问具体案例。`),
    ...risks.map((risk) => `补充确认：${risk}`),
  ]).slice(0, 5)
}

function buildSummary(
  recommendation: AssessmentRecommendation,
  score: number,
  job: JobRecord,
  resume: ResumeRecord,
  risks: string[]
) {
  const candidateName = resume.contact.name || '该候选人'

  if (recommendation === 'strong_yes') {
    return `${candidateName} 与 ${job.title} 的匹配度较高，建议直接进入正式面试。当前 AI 初筛得分为 ${score} 分。`
  }

  if (recommendation === 'yes') {
    return `${candidateName} 基本满足 ${job.title} 的核心要求，建议进入面试并重点验证关键能力。当前 AI 初筛得分为 ${score} 分。`
  }

  if (recommendation === 'hold') {
    return `${candidateName} 有可用信号，但仍存在待验证项。建议先补充追问，再决定是否继续推进。当前 AI 初筛得分为 ${score} 分。`
  }

  return `${candidateName} 与 ${job.title} 的关键要求存在明显差距，建议谨慎推进。${risks[0] ?? '请结合岗位需求继续复核。'}`
}

function topInsightByPriority(insights: ResumeInsight[], type: ResumeInsight['type']) {
  return insights.find((insight) => insight.type === type && insight.priority === 'high')
}

export async function generateRecruiterScreeningRecord(params: {
  job: JobRecord
  application: ApplicationRecord | null
  resume: ResumeRecord
  recruiter: AppUser
  existingId?: string | null
  createdAt?: string
  requireAiQuestions?: boolean
}) {
  const { job, application, resume, recruiter } = params
  const draft = await createAssessmentDraft(job, resume, 'interview', {
    requireAi: params.requireAiQuestions,
  })
  const requiredSkillFit = coverageScore(job.requiredSkills, resume.profile.skills)
  const preferredSkillFit = coverageScore(job.preferredSkills, resume.profile.skills)
  const skillFit = Math.round(requiredSkillFit * 0.75 + preferredSkillFit * 0.25)
  const experienceFit = experienceScore(resume, job)
  const resumeQuality = clamp(Math.round(resume.score), 0, 100)
  const communicationFit = communicationScore(resume)

  const scoreBreakdown: RecruiterScreeningBreakdown = {
    skillFit,
    experienceFit,
    resumeQuality,
    communicationFit,
  }

  const overallScore = clamp(
    Math.round(skillFit * 0.45 + experienceFit * 0.25 + resumeQuality * 0.2 + communicationFit * 0.1),
    0,
    100
  )

  const recommendation = recommendationFromScore(overallScore)
  const risks = buildRisks(job, resume)
  const summary = buildSummary(recommendation, overallScore, job, resume, risks)
  const highlights = buildHighlights(job, resume)
  const interviewFocus = buildInterviewFocus(job, resume, risks)
  const highStrength = topInsightByPriority(resume.insights, 'strength')
  const highWarning = topInsightByPriority(resume.insights, 'warning')
  const now = new Date().toISOString()
  const createdAt = params.createdAt ?? now

  return {
    id: params.existingId ?? crypto.randomUUID(),
    createdAt,
    updatedAt: now,
    recruiterUserId: recruiter.id,
    recruiterName: recruiter.name,
    applicationId: application?.id ?? null,
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    resumeId: resume.id,
    candidateUserId: application?.userId ?? resume.ownerUserId ?? null,
    candidateName: resume.contact.name ?? application?.userName ?? null,
    candidateEmail: resume.contact.email ?? application?.userEmail ?? null,
    overallScore,
    recommendation,
    summary:
      highStrength || highWarning
        ? `${summary}${highStrength ? ` 优势提示：${highStrength.title}。` : ''}${highWarning ? ` 风险提示：${highWarning.title}。` : ''}`
        : summary,
    highlights,
    risks,
    interviewFocus,
    generatedFrom: draft.generatedFrom,
    source: draft.source,
    scoreBreakdown,
    questions: draft.questions,
  } satisfies RecruiterScreeningRecord
}
