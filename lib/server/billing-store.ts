import { promises as fs } from 'fs'
import path from 'path'

import type { CheckoutSession, PaymentPlan, PaymentPlanId } from '@/types/billing'

const DATA_DIR = path.join(process.cwd(), 'data', 'billing')
const CHECKOUTS_FILE = path.join(DATA_DIR, 'checkouts.json')

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

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback
    }

    throw error
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await ensureStore()
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export function getPaymentPlan(planId: PaymentPlanId) {
  return PAYMENT_PLANS.find((plan) => plan.id === planId) ?? null
}

export async function listCheckoutSessions() {
  return readJsonFile<CheckoutSession[]>(CHECKOUTS_FILE, [])
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

  checkouts.unshift(session)
  await writeJsonFile(CHECKOUTS_FILE, checkouts)

  return session
}

export async function updateCheckoutSession(
  id: string,
  updater: (session: CheckoutSession) => CheckoutSession
) {
  const checkouts = await listCheckoutSessions()
  const index = checkouts.findIndex((session) => session.id === id)

  if (index === -1) {
    return null
  }

  checkouts[index] = updater(checkouts[index])
  await writeJsonFile(CHECKOUTS_FILE, checkouts)

  return checkouts[index]
}
