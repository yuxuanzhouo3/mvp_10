import { getApplicationById, listApplications, updateApplication } from '@/lib/server/application-store'
import { buildRecommendedNextAction, createTimelineEvent, syncCandidateTasks } from '@/lib/server/resume-defaults'
import { getResumeRecordById, updateResumeRecord } from '@/lib/server/resume-store'
import type { AssessmentRecord, AssessmentRecommendation } from '@/types/assessment'
import type { ApplicationRecord, ApplicationStage } from '@/types/application'
import type { CandidateStage } from '@/types/resume'

function recommendationToResumeStage(
  recommendation: AssessmentRecommendation | null,
  mode: AssessmentRecord['mode']
): CandidateStage {
  if (recommendation === 'no') {
    return 'rejected'
  }

  if (mode === 'written') {
    if (recommendation === 'strong_yes' || recommendation === 'yes') {
      return 'interview'
    }

    return 'screening'
  }

  if (recommendation === 'strong_yes' || recommendation === 'yes') {
    return 'offer'
  }

  return 'interview'
}

function recommendationToApplicationStage(
  recommendation: AssessmentRecommendation | null,
  mode: AssessmentRecord['mode']
): ApplicationStage {
  if (recommendation === 'no') {
    return 'rejected'
  }

  if (mode === 'written') {
    if (recommendation === 'strong_yes' || recommendation === 'yes') {
      return 'interview'
    }

    return 'screening'
  }

  if (recommendation === 'strong_yes' || recommendation === 'yes') {
    return 'offer'
  }

  return 'interview'
}

function recommendationLabel(recommendation: AssessmentRecommendation | null) {
  switch (recommendation) {
    case 'strong_yes':
      return '强烈推荐'
    case 'yes':
      return '推荐'
    case 'hold':
      return '待定'
    case 'no':
      return '不推荐'
    default:
      return '待评估'
  }
}

function modeLabel(mode: AssessmentRecord['mode']) {
  return mode === 'written' ? '笔试' : '面试'
}

function buildAssessmentNote(record: AssessmentRecord) {
  const score = record.summary.overallScore ?? 0
  const recommendation = recommendationLabel(record.summary.recommendation)

  return [
    `[测评] ${record.title}`,
    `模式：${modeLabel(record.mode)}`,
    `得分：${score}%`,
    `建议：${recommendation}`,
    `总结：${record.summary.summary}`,
    `下一步：${record.summary.nextStep}`,
  ].join('\n')
}

async function syncResume(record: AssessmentRecord, note: string, now: string) {
  if (!record.resumeId) {
    return
  }

  const resume = await getResumeRecordById(record.resumeId)
  if (!resume) {
    return
  }

  const nextStage = recommendationToResumeStage(record.summary.recommendation, record.mode)

  await updateResumeRecord(record.resumeId, (current) => {
    const nextWorkflow = {
      ...current.workflow,
      stage: nextStage,
      reviewStatus: 'reviewed' as const,
      notes: note,
      recommendedNextAction:
        record.summary.recommendation === 'no'
          ? '建议礼貌结束当前流程，或转入人才库长期跟进。'
          : record.mode === 'written'
            ? '可以安排下一轮面试，并带着本次测评结论继续深挖。'
            : '可以进入 Offer 评估或最终用人决策对齐。',
      lastUpdatedAt: now,
    }

    const nextRecord = {
      ...current,
      workflow: nextWorkflow,
    }

    return {
      ...nextRecord,
      tasks: syncCandidateTasks(nextRecord, current.tasks),
      timeline: [
        ...current.timeline,
        createTimelineEvent({
          type: 'note_added',
          actor: 'system',
          title: `测评已完成评分：${record.title}`,
          description: `${recommendationLabel(record.summary.recommendation)} / ${record.summary.overallScore ?? 0}%`,
          createdAt: now,
        }),
        createTimelineEvent({
          type: 'workflow_updated',
          actor: 'system',
          title: `候选人已推进到：${nextStage}`,
          description: buildRecommendedNextAction(current.contact),
          createdAt: now,
        }),
      ],
    }
  })
}

async function resolveApplications(record: AssessmentRecord) {
  if (record.applicationId) {
    const application = await getApplicationById(record.applicationId)
    return application ? [application] : []
  }

  if (!record.jobId) {
    return []
  }

  const applications = await listApplications()
  return applications.filter((application) => {
    if (application.jobId !== record.jobId) {
      return false
    }

    if (record.resumeId && application.resumeId && application.resumeId === record.resumeId) {
      return true
    }

    if (record.candidateEmail && application.userEmail === record.candidateEmail) {
      return true
    }

    return false
  })
}

async function syncApplications(record: AssessmentRecord, note: string, now: string) {
  const applications = await resolveApplications(record)

  if (applications.length === 0) {
    return
  }

  const nextStage = recommendationToApplicationStage(record.summary.recommendation, record.mode)

  await Promise.all(
    applications.map((application: ApplicationRecord) =>
      updateApplication(application.id, (current) => ({
        ...current,
        stage: nextStage,
        notes: note,
        updatedAt: now,
      }))
    )
  )
}

export async function syncAssessmentOutcome(record: AssessmentRecord) {
  const note = buildAssessmentNote(record)
  const now = new Date().toISOString()

  await Promise.all([syncResume(record, note, now), syncApplications(record, note, now)])
}
