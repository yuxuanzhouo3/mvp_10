import { getAiQuotaConfig, getCurrentAiUsageMonth, getEstimatedAiUseCost, listAiUsageRecords } from '@/lib/server/ai-quota-store'
import { listApplications } from '@/lib/server/application-store'
import { listUsers } from '@/lib/server/auth-store'
import { listCheckoutSessions, getPaymentPlan } from '@/lib/server/billing-store'
import { listJobs } from '@/lib/server/job-store'
import { listOrganizationLeads } from '@/lib/server/organization-store'
import { listRecruiterScreenings } from '@/lib/server/recruiter-screening-store'
import { listResumeRecords } from '@/lib/server/resume-store'
import { listAssessmentRecords } from '@/lib/server/assessment-store'
import type { AiUsageFeature, AiUsageRecord } from '@/types/ai'
import type { AppUser } from '@/types/auth'
import type { AdminAiDashboardResponse, AdminAiUserStatus, AdminAiUserSummary, MarketOverviewResponse } from '@/types/admin'

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

function dedupe<T>(values: T[]) {
  return Array.from(new Set(values))
}

function summarizeUserStatus(params: {
  user: AppUser
  monthRecords: AiUsageRecord[]
  allActiveUserIds: Set<string>
  totalEstimatedSpendRmb: number
  monthlyBudgetRmb: number
  userLimit: number
  perUserMonthlyBudgetRmb: number
  freeTrialCount: number
  enabled: boolean
  projectedCostRmb: number
}): AdminAiUserStatus {
  const paidUser = isPaidAiUser(params.user)
  const knownUser = params.allActiveUserIds.has(params.user.id)
  const userUsageCount = params.monthRecords.length
  const remainingTrials = Math.max(0, params.freeTrialCount - userUsageCount)
  const userEstimatedSpendRmb = roundCurrency(
    params.monthRecords.reduce((sum, record) => sum + record.estimatedCostRmb, 0)
  )

  if (!params.enabled) {
    return 'disabled'
  }

  if (!knownUser && params.allActiveUserIds.size >= params.userLimit) {
    return 'user_limit_reached'
  }

  if (remainingTrials > 0) {
    return 'trial_available'
  }

  if (!paidUser) {
    return 'payment_required'
  }

  if (userEstimatedSpendRmb + params.projectedCostRmb > params.perUserMonthlyBudgetRmb + 0.0001) {
    return 'per_user_budget_reached'
  }

  if (params.totalEstimatedSpendRmb + params.projectedCostRmb > params.monthlyBudgetRmb + 0.0001) {
    return 'monthly_budget_reached'
  }

  return 'paid_active'
}

export async function getAdminAiDashboardData(month = getCurrentAiUsageMonth()): Promise<AdminAiDashboardResponse> {
  const [config, usageRecords, users] = await Promise.all([
    getAiQuotaConfig(),
    listAiUsageRecords({ month }),
    listUsers(),
  ])

  const projectedCostRmb = getEstimatedAiUseCost(config)
  const totalEstimatedSpendRmb = roundCurrency(
    usageRecords.reduce((sum, record) => sum + record.estimatedCostRmb, 0)
  )
  const activeUserIds = new Set(usageRecords.map((record) => record.userId))

  const summaries: AdminAiUserSummary[] = users.map((user) => {
    const monthRecords = usageRecords.filter((record) => record.userId === user.id)
    const lastUsedAt = monthRecords[0]?.createdAt ?? null
    const estimatedSpendRmb = roundCurrency(
      monthRecords.reduce((sum, record) => sum + record.estimatedCostRmb, 0)
    )

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan: user.plan,
      billingStatus: user.billingStatus,
      aiPaidEnabled: user.aiPaidEnabled === true,
      createdAt: user.createdAt,
      usageCount: monthRecords.length,
      estimatedSpendRmb,
      remainingTrialCount: Math.max(0, config.freeTrialCount - monthRecords.length),
      lastUsedAt,
      status: summarizeUserStatus({
        user,
        monthRecords,
        allActiveUserIds: activeUserIds,
        totalEstimatedSpendRmb,
        monthlyBudgetRmb: config.monthlyBudgetRmb,
        userLimit: config.userLimit,
        perUserMonthlyBudgetRmb: config.perUserMonthlyBudgetRmb,
        freeTrialCount: config.freeTrialCount,
        enabled: config.enabled,
        projectedCostRmb,
      }),
      featuresUsed: dedupe(monthRecords.map((record) => record.feature)),
    }
  })

  return {
    month,
    config,
    overview: {
      month,
      totalEstimatedSpendRmb,
      totalUsageCount: usageRecords.length,
      activeUserCount: activeUserIds.size,
      paidEnabledUserCount: summaries.filter((user) => isPaidAiUser(user)).length,
      paymentRequiredUserCount: summaries.filter((user) => user.status === 'payment_required').length,
      monthlyBudgetRemainingRmb: roundCurrency(Math.max(0, config.monthlyBudgetRmb - totalEstimatedSpendRmb)),
      userLimitRemaining: Math.max(0, config.userLimit - activeUserIds.size),
    },
    users: summaries,
    recentUsage: usageRecords.slice(0, 20),
  }
}

export async function getMarketOverviewData(month = getCurrentAiUsageMonth()): Promise<MarketOverviewResponse> {
  const [users, jobs, applications, resumes, assessments, recruiterScreenings, organizationLeads, checkouts, usageRecords] =
    await Promise.all([
      listUsers(),
      listJobs(),
      listApplications(),
      listResumeRecords(),
      listAssessmentRecords(),
      listRecruiterScreenings(),
      listOrganizationLeads(),
      listCheckoutSessions(),
      listAiUsageRecords({ month }),
    ])

  const paidOrders = checkouts.filter((checkout) => checkout.status === 'paid')
  const revenue = roundCurrency(paidOrders.reduce((sum, checkout) => sum + checkout.amount, 0))
  const aiEstimatedSpendRmb = roundCurrency(
    usageRecords.reduce((sum, record) => sum + record.estimatedCostRmb, 0)
  )
  const applicationStages = Array.from(
    applications.reduce((map, application) => {
      map.set(application.stage, (map.get(application.stage) ?? 0) + 1)
      return map
    }, new Map<string, number>())
  ).map(([stage, count]) => ({ stage, count }))

  const aiFeatures = Array.from(
    usageRecords.reduce((map, record) => {
      const current = map.get(record.feature) ?? { count: 0, estimatedSpendRmb: 0 }
      current.count += 1
      current.estimatedSpendRmb = roundCurrency(current.estimatedSpendRmb + record.estimatedCostRmb)
      map.set(record.feature, current)
      return map
    }, new Map<AiUsageFeature, { count: number; estimatedSpendRmb: number }>())
  ).map(([feature, value]) => ({
    feature,
    count: value.count,
    estimatedSpendRmb: value.estimatedSpendRmb,
  }))

  const recentRevenue = paidOrders
    .slice()
    .sort((left, right) => new Date(right.paidAt ?? right.createdAt).getTime() - new Date(left.paidAt ?? left.createdAt).getTime())
    .slice(0, 10)
    .map((checkout) => ({
      id: checkout.id,
      userName:
        users.find((user) => user.id === checkout.userId)?.name ??
        users.find((user) => user.id === checkout.userId)?.email ??
        checkout.userId,
      planName: getPaymentPlan(checkout.planId)?.name ?? checkout.planId,
      amount: checkout.amount,
      paidAt: checkout.paidAt,
    }))

  return {
    month,
    totals: {
      users: users.length,
      recruiters: users.filter((user) => user.role === 'recruiter').length,
      candidates: users.filter((user) => user.role === 'candidate').length,
      admins: users.filter((user) => user.role === 'admin').length,
      aiPaidUsers: users.filter((user) => isPaidAiUser(user)).length,
      jobs: jobs.length,
      publishedJobs: jobs.filter((job) => job.status === 'published').length,
      applications: applications.length,
      resumes: resumes.length,
      assessments: assessments.length,
      recruiterScreenings: recruiterScreenings.length,
      organizationLeads: organizationLeads.length,
      paidOrders: paidOrders.length,
      checkoutRevenueRmb: revenue,
      aiUsageCount: usageRecords.length,
      aiEstimatedSpendRmb,
    },
    applicationStages,
    aiFeatures,
    recentRevenue,
  }
}
