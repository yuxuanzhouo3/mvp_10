export type ModerationSubjectType =
  | 'candidate'
  | 'employer'
  | 'interviewer'
  | 'job'
  | 'platform'
  | 'other'
export type ModerationReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'

export interface ModerationReport {
  id: string
  createdAt: string
  updatedAt: string
  subjectType: ModerationSubjectType
  subjectId: string | null
  reporterName: string | null
  reporterEmail: string | null
  reason: string
  details: string
  status: ModerationReportStatus
  resolutionNotes: string
}
