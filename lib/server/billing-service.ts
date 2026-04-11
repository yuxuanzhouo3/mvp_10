import { updateUser } from '@/lib/server/auth-store'
import { getCheckoutSessionById, getPaymentPlan, updateCheckoutSession } from '@/lib/server/billing-store'

export async function getOwnedCheckoutSession(checkoutSessionId: string, userId: string) {
  const checkout = await getCheckoutSessionById(checkoutSessionId)

  if (!checkout) {
    return null
  }

  if (checkout.userId !== userId) {
    throw new Error('Checkout session does not belong to this user.')
  }

  return checkout
}

export async function activateCheckoutSession(input: {
  checkoutSessionId: string
  userId: string
  transactionId?: string | null
  paidAt?: string | null
}) {
  const paidAt = input.paidAt || new Date().toISOString()
  const checkout = await updateCheckoutSession(input.checkoutSessionId, (session) => {
    if (session.userId !== input.userId) {
      throw new Error('Checkout session does not belong to this user.')
    }

    return {
      ...session,
      status: 'paid',
      paidAt: session.paidAt ?? paidAt,
      transactionId: session.transactionId ?? input.transactionId ?? null,
    }
  })

  if (!checkout) {
    return null
  }

  const plan = getPaymentPlan(checkout.planId)
  const upgradedUser = await updateUser(input.userId, (current) => ({
    ...current,
    plan: plan ? 'pro' : current.plan,
    billingStatus: 'active',
  }))

  return {
    checkout,
    user: upgradedUser,
    plan,
  }
}
