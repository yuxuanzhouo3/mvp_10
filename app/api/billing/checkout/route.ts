import { randomUUID } from 'crypto'

import { NextResponse } from 'next/server'

import { isWechatPayEnabled } from '@/lib/app-version'
import { requireAuthenticatedUser } from '@/lib/server/auth-helpers'
import { createCheckoutSession, getPaymentPlan } from '@/lib/server/billing-store'
import {
  createWechatNativePayment,
  generateWechatOutTradeNo,
  getWechatPayConfig,
} from '@/lib/server/wechat-pay'
import type { PaymentMethod, PaymentPlanId } from '@/types/billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_PLAN_IDS: PaymentPlanId[] = ['pro_monthly', 'pro_quarterly', 'pro_yearly']
const VALID_PAYMENT_METHODS: PaymentMethod[] = ['default', 'wechat']

function isPlanId(value: unknown): value is PaymentPlanId {
  return typeof value === 'string' && VALID_PLAN_IDS.includes(value as PaymentPlanId)
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && VALID_PAYMENT_METHODS.includes(value as PaymentMethod)
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const body = (await request.json()) as { planId?: unknown; paymentMethod?: unknown }

    if (!isPlanId(body.planId)) {
      return NextResponse.json({ error: 'Payment plan is invalid.' }, { status: 400 })
    }

    const paymentMethod = isPaymentMethod(body.paymentMethod) ? body.paymentMethod : 'default'
    const plan = getPaymentPlan(body.planId)

    if (!plan) {
      return NextResponse.json({ error: 'Payment plan not found.' }, { status: 404 })
    }

    if (paymentMethod === 'wechat') {
      if (!isWechatPayEnabled()) {
        return NextResponse.json(
          { error: 'WeChat Pay is only available in the CN edition.' },
          { status: 400 }
        )
      }

      const outTradeNo = generateWechatOutTradeNo(randomUUID())
      const isMock = !getWechatPayConfig()
      const codeUrl = isMock
        ? `weixin://wxpay/mock/${outTradeNo}`
        : (
            await createWechatNativePayment({
              amountFen: Math.round(plan.amount * 100),
              description: `${plan.name} - ${user.name}`,
              outTradeNo,
            })
          ).codeUrl

      const session = await createCheckoutSession({
        userId: user.id,
        planId: body.planId,
        mode: 'wechat_native',
        paymentMethod,
        codeUrl,
        outTradeNo,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
        isMock,
      })

      return NextResponse.json(session, { status: 201 })
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
      paymentMethod,
      externalUrl,
    })

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout creation failed.'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
