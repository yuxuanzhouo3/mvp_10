import path from 'path'

import {
  getCloudDocumentById,
  listCloudDocuments,
  putCloudDocument,
  readLocalJsonFile,
  withCloudBaseFallback,
  writeLocalJsonFile,
} from '@/lib/server/cloudbase'
import type { CheckoutSession, PaymentMethod, PaymentPlan, PaymentPlanId } from '@/types/billing'

const CHECKOUTS_FILE = path.join(process.cwd(), 'data', 'billing', 'checkouts.json')
const BILLING_CHECKOUTS_COLLECTION = 'billing_checkouts'

export const PAYMENT_PLANS: PaymentPlan[] = [
  {
    id: 'pro_monthly',
    name: 'Pro 月付',
    amount: 29,
    currency: 'CNY',
    interval: 'month',
    description: '按月开通高级招聘工作流与 AI 服务。',
  },
  {
    id: 'pro_quarterly',
    name: 'Pro 季付',
    amount: 69,
    currency: 'CNY',
    interval: 'quarter',
    description: '按季度购买，折合单月成本更低。',
  },
  {
    id: 'pro_yearly',
    name: 'Pro 年付',
    amount: 199,
    currency: 'CNY',
    interval: 'year',
    description: '适合长期使用团队的年度会员方案。',
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

export async function getCheckoutSessionById(id: string) {
  return withCloudBaseFallback(
    'getCheckoutSessionById',
    async () => getCloudDocumentById<CheckoutSession>(BILLING_CHECKOUTS_COLLECTION, id),
    async () => {
      const checkouts = await readCheckoutSessions()
      return checkouts.find((session) => session.id === id) ?? null
    }
  )
}

export async function createCheckoutSession(input: {
  userId: string
  planId: PaymentPlanId
  externalUrl?: string | null
  codeUrl?: string | null
  outTradeNo?: string | null
  expiresAt?: string | null
  transactionId?: string | null
  mode: CheckoutSession['mode']
  paymentMethod?: PaymentMethod
  isMock?: boolean
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
    paymentMethod: input.paymentMethod ?? 'default',
    status: 'created',
    createdAt: new Date().toISOString(),
    paidAt: null,
    externalUrl: input.externalUrl ?? null,
    codeUrl: input.codeUrl ?? null,
    outTradeNo: input.outTradeNo ?? null,
    expiresAt: input.expiresAt ?? null,
    transactionId: input.transactionId ?? null,
    isMock: input.isMock ?? input.mode === 'mock',
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
