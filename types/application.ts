export type ApplicationStage =
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'withdrawn'

export interface ApplicationRecord {
  id: string
  createdAt: string
  updatedAt: string
  userId: string
  userName: string
  userEmail: string
  resumeId: string | null
  jobId: string
  jobTitle: string
  company: string
  stage: ApplicationStage
  matchScore: number
  notes: string
}
