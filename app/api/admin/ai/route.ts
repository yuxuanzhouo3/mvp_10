import { NextResponse } from 'next/server'

import { getAdminAiDashboardData } from '@/lib/server/backoffice'
import { isAuthErrorMessage, isPermissionErrorMessage, requireUserRoles } from '@/lib/server/auth-helpers'
import { updateAiQuotaConfig } from '@/lib/server/ai-quota-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function statusForMessage(message: string) {
  if (isAuthErrorMessage(message)) {
    return 401
  }

  if (isPermissionErrorMessage(message)) {
    return 403
  }

  if (message === 'Monthly budget must be greater than zero.' || message === 'Free trial count must be at least 1.' || message === 'User limit must be at least 1.' || message === 'Per-user monthly budget must be greater than zero.') {
    return 400
  }

  return 500
}

function toPositiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function GET(request: Request) {
  try {
    await requireUserRoles(request, ['admin'])
    const url = new URL(request.url)
    const month = url.searchParams.get('month')?.trim() || undefined
    const data = await getAdminAiDashboardData(month)
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load admin AI dashboard.'
    return NextResponse.json({ error: message }, { status: statusForMessage(message) })
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireUserRoles(request, ['admin'])
    const body = (await request.json()) as {
      enabled?: unknown
      monthlyBudgetRmb?: unknown
      userLimit?: unknown
      perUserMonthlyBudgetRmb?: unknown
      freeTrialCount?: unknown
    }

    const monthlyBudgetRmb = toPositiveNumber(body.monthlyBudgetRmb)
    const userLimit = toPositiveNumber(body.userLimit)
    const perUserMonthlyBudgetRmb = toPositiveNumber(body.perUserMonthlyBudgetRmb)
    const freeTrialCount = toPositiveNumber(body.freeTrialCount)

    if (monthlyBudgetRmb === null || monthlyBudgetRmb <= 0) {
      throw new Error('Monthly budget must be greater than zero.')
    }

    if (userLimit === null || userLimit < 1) {
      throw new Error('User limit must be at least 1.')
    }

    if (perUserMonthlyBudgetRmb === null || perUserMonthlyBudgetRmb <= 0) {
      throw new Error('Per-user monthly budget must be greater than zero.')
    }

    if (freeTrialCount === null || freeTrialCount < 1) {
      throw new Error('Free trial count must be at least 1.')
    }

    const config = await updateAiQuotaConfig((current) => ({
      ...current,
      enabled: body.enabled !== false,
      monthlyBudgetRmb,
      userLimit: Math.round(userLimit),
      perUserMonthlyBudgetRmb,
      freeTrialCount: Math.round(freeTrialCount),
      updatedAt: new Date().toISOString(),
      updatedByUserId: user.id,
    }))

    return NextResponse.json(config)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update AI quota settings.'
    return NextResponse.json({ error: message }, { status: statusForMessage(message) })
  }
}
