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

function buildAssessmentNote(record: AssessmentRecord) {
  const score = record.summary.overallScore ?? 0
  const recommendation = record.summary.recommendation ?? 'pending'
  return [
    `[Assessment] ${record.title}`,
    `Mode: ${record.mode}`,
    `Score: ${score}%`,
    `Recommendation: ${recommendation}`,
    `Summary: ${record.summary.summary}`,
    `Next step: ${record.summary.nextStep}`,
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
              ? 'Close the candidate loop politely or keep them in reserve.'
              : record.mode === 'written'
                ? 'Schedule an interview and carry the assessment summary into the next round.'
                : 'Prepare hiring decision, offer review, or final stakeholder alignment.',
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
              title: `Assessment scored: ${record.title}`,
              description: `${record.summary.recommendation ?? 'pending'} · ${record.summary.overallScore ?? 0}%`,
              createdAt: now,
            }),
            createTimelineEvent({
              type: 'workflow_updated',
              actor: 'system',
              title: `Candidate moved to ${nextStage}`,
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
