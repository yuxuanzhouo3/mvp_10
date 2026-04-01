import path from 'path'

import {
  getCloudDocumentById,
  listCloudDocuments,
  putCloudDocument,
  readLocalJsonFile,
  withCloudBaseFallback,
  writeLocalJsonFile,
} from '@/lib/server/cloudbase'
import type { CheckoutSession, PaymentPlan, PaymentPlanId } from '@/types/billing'

const CHECKOUTS_FILE = path.join(process.cwd(), 'data', 'billing', 'checkouts.json')
const BILLING_CHECKOUTS_COLLECTION = 'billing_checkouts'

export const PAYMENT_PLANS: PaymentPlan[] = [
  {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    amount: 29,
    currency: 'USD',
    interval: 'month',
    description: 'Monthly access to premium recruiting workflows.',
  },
  {
    id: 'pro_quarterly',
    name: 'Pro Quarterly',
    amount: 69,
    currency: 'USD',
    interval: 'quarter',
    description: 'Quarterly plan with lower effective monthly cost.',
  },
  {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    amount: 199,
    currency: 'USD',
    interval: 'year',
    description: 'Annual plan for teams operating the platform long-term.',
  },
]

async function readCheckoutSessions() {
  return readLocalJsonFile<CheckoutSession[]>(CHECKOUTS_FILE, [])
}

async function writeCheckoutSessions(checkouts: CheckoutSession[]) {
  await writeLocalJsonFile(CHECKOUTS_FILE, checkouts)
}

export function getPaymentPlan(planId: PaymentPlanId) {
  return PAYMENT_PLANS.find((plan) => plan.id === planId) ?? null
}

export async function listCheckoutSessions() {
  return withCloudBaseFallback(
    'listCheckoutSessions',
    async () =>
      listCloudDocuments<CheckoutSession>(BILLING_CHECKOUTS_COLLECTION, {
        orderBy: { field: 'createdAt', direction: 'desc' },
      }),
    async () => readCheckoutSessions()
  )
}

export async function createCheckoutSession(input: {
  userId: string
  planId: PaymentPlanId
  externalUrl?: string | null
  mode: 'external' | 'mock'
}) {
  const plan = getPaymentPlan(input.planId)

  if (!plan) {
    throw new Error('Payment plan not found.')
  }

  const checkouts = await listCheckoutSessions()
  const session: CheckoutSession = {
    id: crypto.randomUUID(),
    userId: input.userId,
    planId: input.planId,
    amount: plan.amount,
    currency: plan.currency,
    mode: input.mode,
    status: 'created',
    createdAt: new Date().toISOString(),
    paidAt: null,
    externalUrl: input.externalUrl ?? null,
  }

  await withCloudBaseFallback(
    'createCheckoutSession',
    async () => {
      await putCloudDocument(BILLING_CHECKOUTS_COLLECTION, session.id, session)
    },
    async () => {
      checkouts.unshift(session)
      await writeCheckoutSessions(checkouts)
    }
  )

  return session
}

export async function updateCheckoutSession(
  id: string,
  updater: (session: CheckoutSession) => CheckoutSession
) {
  return withCloudBaseFallback(
    'updateCheckoutSession',
    async () => {
      const existing = await getCloudDocumentById<CheckoutSession>(BILLING_CHECKOUTS_COLLECTION, id)

      if (!existing) {
        return null
      }

      const nextSession = updater(existing)
      await putCloudDocument(BILLING_CHECKOUTS_COLLECTION, id, nextSession)
      return nextSession
    },
    async () => {
      const checkouts = await readCheckoutSessions()
      const index = checkouts.findIndex((session) => session.id === id)

      if (index === -1) {
        return null
      }

      checkouts[index] = updater(checkouts[index])
      await writeCheckoutSessions(checkouts)

      return checkouts[index]
    }
  )
}
