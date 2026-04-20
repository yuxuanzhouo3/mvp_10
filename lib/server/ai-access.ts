import { addAiUsageRecord, getAiQuotaConfig, getCurrentAiUsageMonth, getEstimatedAiUseCost, listAiUsageRecords } from '@/lib/server/ai-quota-store'
import type { AiAccessMode, AiUsageFeature } from '@/types/ai'
import type { AppUser } from '@/types/auth'

export type AiAccessDenialReason =
  | 'disabled'
  | 'payment_required'
  | 'monthly_budget_reached'
  | 'per_user_budget_reached'
  | 'user_limit_reached'

export interface AiAccessDecision {
  allowed: boolean
  month: string
  accessMode: AiAccessMode | null
  denialReason: AiAccessDenialReason | null
  message: string | null
  projectedCostRmb: number
  userUsageCount: number
  remainingTrialCount: number
  totalEstimatedSpendRmb: number
  userEstimatedSpendRmb: number
}

const AI_ACCESS_ERROR_PATTERNS = [
  'AI generation is currently disabled by the administrator.',
  'The monthly AI user capacity has been reached. Please contact the administrator.',
  'Free AI trials have been used up.',
  'This account has reached its AI budget for the current month.',
  'The platform AI budget for this month has been exhausted.',
]

function roundCurrency(value: number) {
  return Math.round(value * 10000) / 10000
}

function isPaidAiUser(user: Pick<AppUser, 'plan' | 'billingStatus' | 'aiPaidEnabled'>) {
  return (
    user.aiPaidEnabled === true ||
    user.plan === 'pro' ||
    user.plan === 'enterprise' ||
    user.billingStatus === 'active' ||
    user.billingStatus === 'trialing'
  )
}

export async function getAiAccessDecision(user: Pick<AppUser, 'id' | 'name' | 'email' | 'plan' | 'billingStatus' | 'aiPaidEnabled'>): Promise<AiAccessDecision> {
  const config = await getAiQuotaConfig()
  const month = getCurrentAiUsageMonth()
  const projectedCostRmb = getEstimatedAiUseCost(config)
  const records = await listAiUsageRecords({ month })
  const userRecords = records.filter((record) => record.userId === user.id)
  const uniqueUsers = new Set(records.map((record) => record.userId))
  const userEstimatedSpendRmb = roundCurrency(
    userRecords.reduce((sum, record) => sum + record.estimatedCostRmb, 0)
  )
  const totalEstimatedSpendRmb = roundCurrency(
    records.reduce((sum, record) => sum + record.estimatedCostRmb, 0)
  )
  const userUsageCount = userRecords.length
  const remainingTrialCount = Math.max(0, config.freeTrialCount - userUsageCount)
  const knownUser = uniqueUsers.has(user.id)
  const paidUser = isPaidAiUser(user)

  if (!config.enabled) {
    return {
      allowed: false,
      month,
      accessMode: null,
      denialReason: 'disabled',
      message: 'AI generation is currently disabled by the administrator.',
      projectedCostRmb,
      userUsageCount,
      remainingTrialCount,
      totalEstimatedSpendRmb,
      userEstimatedSpendRmb,
    }
  }

  if (!knownUser && uniqueUsers.size >= config.userLimit) {
    return {
      allowed: false,
      month,
      accessMode: null,
      denialReason: 'user_limit_reached',
      message: 'The monthly AI user capacity has been reached. Please contact the administrator.',
      projectedCostRmb,
      userUsageCount,
      remainingTrialCount,
      totalEstimatedSpendRmb,
      userEstimatedSpendRmb,
    }
  }

  if (remainingTrialCount > 0) {
    return {
      allowed: true,
      month,
      accessMode: 'trial',
      denialReason: null,
      message: null,
      projectedCostRmb,
      userUsageCount,
      remainingTrialCount,
      totalEstimatedSpendRmb,
      userEstimatedSpendRmb,
    }
  }

  if (!paidUser) {
    return {
      allowed: false,
      month,
      accessMode: null,
      denialReason: 'payment_required',
      message: `Free AI trials have been used up. Paid access is ${config.perUserMonthlyBudgetRmb.toFixed(
        2
      )} RMB per user per month. Please complete payment or contact an administrator.`,
      projectedCostRmb,
      userUsageCount,
      remainingTrialCount,
      totalEstimatedSpendRmb,
      userEstimatedSpendRmb,
    }
  }

  if (userEstimatedSpendRmb + projectedCostRmb > config.perUserMonthlyBudgetRmb + 0.0001) {
    return {
      allowed: false,
      month,
      accessMode: null,
      denialReason: 'per_user_budget_reached',
      message: 'This account has reached its AI budget for the current month.',
      projectedCostRmb,
      userUsageCount,
      remainingTrialCount,
      totalEstimatedSpendRmb,
      userEstimatedSpendRmb,
    }
  }

  if (totalEstimatedSpendRmb + projectedCostRmb > config.monthlyBudgetRmb + 0.0001) {
    return {
      allowed: false,
      month,
      accessMode: null,
      denialReason: 'monthly_budget_reached',
      message: 'The platform AI budget for this month has been exhausted.',
      projectedCostRmb,
      userUsageCount,
      remainingTrialCount,
      totalEstimatedSpendRmb,
      userEstimatedSpendRmb,
    }
  }

  return {
    allowed: true,
    month,
    accessMode: 'paid',
    denialReason: null,
    message: null,
    projectedCostRmb,
    userUsageCount,
    remainingTrialCount,
    totalEstimatedSpendRmb,
    userEstimatedSpendRmb,
  }
}

export async function assertAiAccess(user: Pick<AppUser, 'id' | 'name' | 'email' | 'plan' | 'billingStatus' | 'aiPaidEnabled'>) {
  const decision = await getAiAccessDecision(user)

  if (!decision.allowed || !decision.accessMode) {
    throw new Error(decision.message || 'AI access is not available for this account.')
  }

  return decision
}

export async function recordAiUsage(
  user: Pick<AppUser, 'id' | 'name' | 'email'>,
  feature: AiUsageFeature,
  accessMode: AiAccessMode,
  month = getCurrentAiUsageMonth()
) {
  const config = await getAiQuotaConfig()

  return addAiUsageRecord({
    id: crypto.randomUUID(),
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    feature,
    accessMode,
    estimatedCostRmb: getEstimatedAiUseCost(config),
    month,
    createdAt: new Date().toISOString(),
  })
}

export function isAiAccessErrorMessage(message: string) {
  return AI_ACCESS_ERROR_PATTERNS.some((pattern) => message.startsWith(pattern))
}

export function getAiAccessErrorStatus(message: string) {
  if (message.startsWith('Free AI trials have been used up.')) {
    return 402
  }

  return 403
}
