import type {
  AssessmentQuestion,
  AssessmentRecommendation,
  AssessmentSource,
} from '@/types/assessment'

export interface RecruiterScreeningBreakdown {
  skillFit: number
  experienceFit: number
  resumeQuality: number
  communicationFit: number
}

export interface RecruiterScreeningRecord {
  id: string
  createdAt: string
  updatedAt: string
  recruiterUserId: string
  recruiterName: string | null
  applicationId: string | null
  jobId: string
  jobTitle: string
  company: string | null
  resumeId: string
  candidateUserId: string | null
  candidateName: string | null
  candidateEmail: string | null
  overallScore: number
  recommendation: AssessmentRecommendation
  summary: string
  highlights: string[]
  risks: string[]
  interviewFocus: string[]
  generatedFrom: string
  source: AssessmentSource
  scoreBreakdown: RecruiterScreeningBreakdown
  questions: AssessmentQuestion[]
}
