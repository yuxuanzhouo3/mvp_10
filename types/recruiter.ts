import type { ApplicationRecord } from '@/types/application'
import type { AssessmentRecord } from '@/types/assessment'
import type { ResumeListItem } from '@/types/resume'
import type { RecruiterScreeningRecord } from '@/types/screening'

export interface RecruiterCandidateRecord {
  application: ApplicationRecord
  selectedResume: ResumeListItem | null
  availableResumes: ResumeListItem[]
  screening: RecruiterScreeningRecord | null
  latestAssessment: AssessmentRecord | null
}
