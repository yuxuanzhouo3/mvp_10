import { NextResponse } from 'next/server'

import { requireAuthenticatedUser } from '@/lib/server/auth-helpers'
import { createCheckoutSession } from '@/lib/server/billing-store'
import type { PaymentPlanId } from '@/types/billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_PLAN_IDS: PaymentPlanId[] = ['pro_monthly', 'pro_quarterly', 'pro_yearly']

function isPlanId(value: unknown): value is PaymentPlanId {
  return typeof value === 'string' && VALID_PLAN_IDS.includes(value as PaymentPlanId)
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const body = (await request.json()) as { planId?: unknown }

    if (!isPlanId(body.planId)) {
      return NextResponse.json({ error: 'Payment plan is invalid.' }, { status: 400 })
    }

    const paymentLinkTemplate = process.env.PAYMENT_CHECKOUT_URL_TEMPLATE
    const externalUrl = paymentLinkTemplate
      ? paymentLinkTemplate
          .replace('{PLAN_ID}', body.planId)
          .replace('{USER_ID}', user.id)
      : null

    const session = await createCheckoutSession({
      userId: user.id,
      planId: body.planId,
      mode: externalUrl ? 'external' : 'mock',
      externalUrl,
    })

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout creation failed.'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
