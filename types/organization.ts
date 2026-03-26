export type OrganizationLeadSource = 'manual' | 'public_text'
export type OrganizationStage =
  | 'new'
  | 'qualified'
  | 'invited'
  | 'responded'
  | 'onboarded'
  | 'rejected'
export type OrganizationInviteStatus = 'not_sent' | 'preview' | 'sent' | 'failed'

export interface OrganizationContactInfo {
  contactName: string | null
  email: string | null
  phone: string | null
  location: string | null
}

export interface OrganizationWorkflow {
  stage: OrganizationStage
  recommendedNextAction: string
  notes: string
  lastUpdatedAt: string
}

export interface OrganizationCommunication {
  inviteEmailStatus: OrganizationInviteStatus
  inviteEmailCount: number
  inviteEmailLastAttemptAt: string | null
  inviteEmailSentAt: string | null
  inviteEmailLastError: string | null
}

export interface OrganizationLead {
  id: string
  createdAt: string
  source: OrganizationLeadSource
  companyName: string
  website: string | null
  publicText: string
  summary: string
  contact: OrganizationContactInfo
  workflow: OrganizationWorkflow
  communication: OrganizationCommunication
}
