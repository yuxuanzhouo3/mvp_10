import type { AiQuotaConfig, AiUsageFeature, AiUsageRecord } from '@/types/ai'
import type { BillingStatus, UserPlan, UserRole } from '@/types/auth'

export type AdminAiUserStatus =
  | 'trial_available'
  | 'payment_required'
  | 'paid_active'
  | 'per_user_budget_reached'
  | 'monthly_budget_reached'
  | 'user_limit_reached'
  | 'disabled'

export interface AdminAiUserSummary {
  id: string
  name: string
  email: string
  role: UserRole
  plan: UserPlan
  billingStatus: BillingStatus
  aiPaidEnabled: boolean
  createdAt: string
  usageCount: number
  estimatedSpendRmb: number
  remainingTrialCount: number
  lastUsedAt: string | null
  status: AdminAiUserStatus
  featuresUsed: AiUsageFeature[]
}

export interface AdminAiOverview {
  month: string
  totalEstimatedSpendRmb: number
  totalUsageCount: number
  activeUserCount: number
  paidEnabledUserCount: number
  paymentRequiredUserCount: number
  monthlyBudgetRemainingRmb: number
  userLimitRemaining: number
}

export interface AdminAiDashboardResponse {
  month: string
  config: AiQuotaConfig
  overview: AdminAiOverview
  users: AdminAiUserSummary[]
  recentUsage: AiUsageRecord[]
}

export interface MarketOverviewResponse {
  month: string
  totals: {
    users: number
    recruiters: number
    candidates: number
    admins: number
    aiPaidUsers: number
    jobs: number
    publishedJobs: number
    applications: number
    resumes: number
    assessments: number
    recruiterScreenings: number
    organizationLeads: number
    paidOrders: number
    checkoutRevenueRmb: number
    aiUsageCount: number
    aiEstimatedSpendRmb: number
  }
  applicationStages: Array<{
    stage: string
    count: number
  }>
  aiFeatures: Array<{
    feature: AiUsageFeature
    count: number
    estimatedSpendRmb: number
  }>
  recentRevenue: Array<{
    id: string
    userName: string
    planName: string
    amount: number
    paidAt: string | null
  }>
}
