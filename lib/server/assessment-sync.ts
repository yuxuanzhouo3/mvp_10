import { listApplications, updateApplication } from '@/lib/server/application-store'
import { buildRecommendedNextAction, createTimelineEvent, syncCandidateTasks } from '@/lib/server/resume-defaults'
import { getResumeRecordById, updateResumeRecord } from '@/lib/server/resume-store'
import type { AssessmentRecord, AssessmentRecommendation } from '@/types/assessment'
import type { ApplicationStage } from '@/types/application'
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
    case 'no':
      return '不推荐'
    default:
      return '待定'
  }
}

function buildAssessmentNote(record: AssessmentRecord) {
  const score = record.summary.overallScore ?? 0
  const recommendation = recommendationLabel(record.summary.recommendation)
  return [
    `[测评] ${record.title}`,
    `模式：${record.mode === 'written' ? '笔试' : '面试'}`,
    `得分：${score}%`,
    `建议：${recommendation}`,
    `总结：${record.summary.summary}`,
    `下一步：${record.summary.nextStep}`,
  ].join('\n')
}

export async function syncAssessmentOutcome(record: AssessmentRecord) {
  const recommendation = record.summary.recommendation
  const note = buildAssessmentNote(record)
  const now = new Date().toISOString()

  if (record.resumeId) {
    const resume = await getResumeRecordById(record.resumeId)

    if (resume) {
      const nextStage = recommendationToResumeStage(recommendation, record.mode)

      await updateResumeRecord(record.resumeId, (current) => {
        const nextWorkflow = {
          ...current.workflow,
          stage: nextStage,
          reviewStatus: 'reviewed' as const,
          notes: note,
          recommendedNextAction:
            recommendation === 'no'
              ? '建议礼貌结束当前流程，或转入人才储备池。'
              : record.mode === 'written'
                ? '安排面试，并将测评结论带入下一轮沟通。'
                : '准备录用决策、Offer 评审或最终用人对齐。',
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
              description: `${recommendationLabel(record.summary.recommendation)} · ${record.summary.overallScore ?? 0}%`,
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
  }

  if (record.jobId) {
    const applications = await listApplications()
    const matchingApplications = applications.filter((application) => {
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

    const nextStage = recommendationToApplicationStage(recommendation, record.mode)

    await Promise.all(
      matchingApplications.map((application) =>
        updateApplication(application.id, (current) => ({
          ...current,
          stage: nextStage,
          notes: note,
          updatedAt: now,
        }))
      )
    )
  }
}
