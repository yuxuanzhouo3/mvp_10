export type AssessmentMode = 'written' | 'interview'
export type AssessmentStatus = 'draft' | 'in_progress' | 'submitted' | 'scored'
export type AssessmentDifficulty = 'easy' | 'medium' | 'hard'
export type AssessmentKind = 'practice' | 'recruiter_assigned'
export type AssessmentQuestionCategory =
  | 'technical'
  | 'problem_solving'
  | 'behavioral'
  | 'communication'
  | 'role_fit'
export type AssessmentSource = 'heuristic' | 'openai'
export type AssessmentRecommendation = 'strong_yes' | 'yes' | 'hold' | 'no'

export interface AssessmentAudioAsset {
  fileName: string | null
  mimeType: string | null
  size: number | null
  storedFileName: string | null
  uploadedAt: string | null
}

export interface AssessmentQuestion {
  id: string
  prompt: string
  category: AssessmentQuestionCategory
  difficulty: AssessmentDifficulty
  expectedPoints: string[]
  idealAnswer: string
  maxScore: number
}

export interface AssessmentAnswer {
  questionId: string
  answer: string
  transcript: string | null
  audioAsset: AssessmentAudioAsset
  submittedAt: string | null
  score: number | null
  feedback: string | null
  strengths: string[]
  gaps: string[]
}

export interface AssessmentRubric {
  technical: number
  communication: number
  structuredThinking: number
  roleFit: number
}

export interface AssessmentSummary {
  overallScore: number | null
  recommendation: AssessmentRecommendation | null
  summary: string
  nextStep: string
  sessionDurationSeconds: number
  completedAt: string | null
  rubric: AssessmentRubric
}

export interface AssessmentRecord {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  kind: AssessmentKind
  mode: AssessmentMode
  status: AssessmentStatus
  source: AssessmentSource
  generatedFrom: string
  applicationId: string | null
  jobId: string | null
  jobTitle: string | null
  company: string | null
  resumeId: string | null
  candidateUserId: string | null
  candidateName: string | null
  candidateEmail: string | null
  recruiterUserId: string | null
  recruiterName: string | null
  assignedAt: string | null
  questions: AssessmentQuestion[]
  answers: AssessmentAnswer[]
  summary: AssessmentSummary
}
