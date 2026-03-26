import { NextResponse } from 'next/server'

import { requireAuthenticatedUser } from '@/lib/server/auth-helpers'
import { getPaymentPlan, updateCheckoutSession } from '@/lib/server/billing-store'
import { updateUser } from '@/lib/server/auth-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const body = (await request.json()) as { checkoutSessionId?: unknown }

    if (typeof body.checkoutSessionId !== 'string' || !body.checkoutSessionId.trim()) {
      return NextResponse.json({ error: 'Checkout session id is required.' }, { status: 400 })
    }

    const checkout = await updateCheckoutSession(body.checkoutSessionId, (session) => {
      if (session.userId !== user.id) {
        throw new Error('Checkout session does not belong to this user.')
      }

      return {
        ...session,
        status: 'paid',
        paidAt: new Date().toISOString(),
      }
    })

    if (!checkout) {
      return NextResponse.json({ error: 'Checkout session not found.' }, { status: 404 })
    }

    const plan = getPaymentPlan(checkout.planId)
    const upgradedUser = await updateUser(user.id, (current) => ({
      ...current,
      plan: plan ? 'pro' : current.plan,
      billingStatus: 'active',
    }))

    return NextResponse.json({
      checkout,
      user: upgradedUser,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment confirmation failed.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
