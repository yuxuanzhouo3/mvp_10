export type AiUsageFeature =
  | 'resume_analysis'
  | 'assessment_generation'
  | 'recruiter_screening'

export type AiAccessMode = 'trial' | 'paid'

export interface AiQuotaConfig {
  id: 'default'
  enabled: boolean
  monthlyBudgetRmb: number
  userLimit: number
  perUserMonthlyBudgetRmb: number
  freeTrialCount: number
  updatedAt: string
  updatedByUserId: string | null
}

export interface AiUsageRecord {
  id: string
  userId: string
  userName: string
  userEmail: string
  feature: AiUsageFeature
  accessMode: AiAccessMode
  estimatedCostRmb: number
  month: string
  createdAt: string
}

export interface AiMonthlyUsageSummary {
  month: string
  totalEstimatedSpendRmb: number
  totalUsageCount: number
  activeUserCount: number
}
