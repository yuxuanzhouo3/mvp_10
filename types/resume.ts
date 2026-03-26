export type ResumeInsightType = 'strength' | 'improvement' | 'warning'
export type ResumeInsightPriority = 'high' | 'medium' | 'low'
export type ResumeAnalysisSource = 'heuristic' | 'openai'
export type CandidateStage = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
export type CandidateReviewStatus = 'pending' | 'reviewed'
export type CandidateOutreachStatus = 'pending' | 'ready' | 'contacted' | 'responded'
export type ReceiptEmailStatus = 'not_sent' | 'preview' | 'sent' | 'failed'
export type InterviewInviteEmailStatus = 'not_sent' | 'preview' | 'sent' | 'failed'
export type CandidateTaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'
export type CandidateTaskChannel =
  | 'email'
  | 'phone'
  | 'wechat'
  | 'feishu'
  | 'linkedin'
  | 'assessment'
  | 'manual'
export type CandidateTaskKind =
  | 'contact_verification'
  | 'first_outreach'
  | 'screening_decision'
  | 'interview'
  | 'offer'
  | 'custom'
export type CandidateTimelineActor = 'system' | 'recruiter' | 'candidate'
export type CandidateTimelineEventType =
  | 'resume_uploaded'
  | 'contact_updated'
  | 'workflow_updated'
  | 'receipt_sent'
  | 'receipt_failed'
  | 'interview_invite_sent'
  | 'interview_invite_failed'
  | 'task_created'
  | 'task_updated'
  | 'note_added'

export interface ResumeSkillAnalysis {
  skill: string
  level: number
  demand: number
  match: number
}

export interface ResumeInsight {
  type: ResumeInsightType
  title: string
  description: string
  priority: ResumeInsightPriority
}

export interface ResumeCompositionItem {
  name: string
  value: number
  color: string
}

export interface ResumeContactInfo {
  name: string | null
  email: string | null
  phone: string | null
  location: string | null
}

export interface ResumeProfile {
  currentTitle: string | null
  yearsExperience: number | null
  skills: string[]
  education: string[]
  highlights: string[]
}

export interface ResumeAnalysisResult {
  score: number
  summary: string
  source: ResumeAnalysisSource
  contact: ResumeContactInfo
  profile: ResumeProfile
  skillAnalysis: ResumeSkillAnalysis[]
  insights: ResumeInsight[]
  composition: ResumeCompositionItem[]
}

export interface ResumeWorkflow {
  stage: CandidateStage
  reviewStatus: CandidateReviewStatus
  outreachStatus: CandidateOutreachStatus
  recommendedNextAction: string
  notes: string
  lastUpdatedAt: string
}

export interface ResumeCommunication {
  receiptEmailStatus: ReceiptEmailStatus
  receiptEmailCount: number
  receiptEmailLastAttemptAt: string | null
  receiptEmailSentAt: string | null
  receiptEmailLastError: string | null
  interviewInviteEmailStatus: InterviewInviteEmailStatus
  interviewInviteEmailCount: number
  interviewInviteEmailLastAttemptAt: string | null
  interviewInviteEmailSentAt: string | null
  interviewInviteEmailLastError: string | null
}

export interface CandidateTask {
  id: string
  kind: CandidateTaskKind
  title: string
  description: string | null
  status: CandidateTaskStatus
  channel: CandidateTaskChannel
  owner: string | null
  dueAt: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface CandidateTimelineEvent {
  id: string
  type: CandidateTimelineEventType
  actor: CandidateTimelineActor
  title: string
  description: string | null
  createdAt: string
}

export interface ResumeRecord extends ResumeAnalysisResult {
  id: string
  fileName: string
  mimeType: string
  fileSize: number
  createdAt: string
  storedFileName: string
  extractedText: string
  workflow: ResumeWorkflow
  communication: ResumeCommunication
  tasks: CandidateTask[]
  timeline: CandidateTimelineEvent[]
}

export interface ResumeListItem extends Omit<ResumeRecord, 'extractedText'> {
  textPreview: string
}
