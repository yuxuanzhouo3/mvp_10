import { NextResponse } from 'next/server'

import { activateCheckoutSession, getOwnedCheckoutSession } from '@/lib/server/billing-service'
import { requireAuthenticatedUser } from '@/lib/server/auth-helpers'
import { queryWechatPaymentStatus } from '@/lib/server/wechat-pay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function mapTradeState(tradeState: string) {
  switch (tradeState) {
    case 'SUCCESS':
      return 'paid'
    case 'CLOSED':
    case 'PAYERROR':
    case 'REVOKED':
      return 'failed'
    case 'NOTPAY':
    case 'USERPAYING':
    default:
      return 'created'
  }
}

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const checkoutSessionId = searchParams.get('checkoutSessionId')?.trim()

    if (!checkoutSessionId) {
      return NextResponse.json({ error: 'Checkout session id is required.' }, { status: 400 })
    }

    const checkout = await getOwnedCheckoutSession(checkoutSessionId, user.id)
    if (!checkout) {
      return NextResponse.json({ error: 'Checkout session not found.' }, { status: 404 })
    }

    if (checkout.paymentMethod !== 'wechat') {
      return NextResponse.json({ error: 'Checkout session is not a WeChat payment.' }, { status: 400 })
    }

    if (checkout.status === 'paid') {
      return NextResponse.json({
        status: 'paid',
        tradeState: 'SUCCESS',
        checkout,
      })
    }

    if (checkout.isMock) {
      return NextResponse.json({
        status: checkout.status,
        tradeState: checkout.status === 'failed' ? 'PAYERROR' : 'NOTPAY',
        checkout,
        isMock: true,
      })
    }

    if (!checkout.outTradeNo) {
      return NextResponse.json({ error: 'WeChat order number is missing.' }, { status: 400 })
    }

    const paymentStatus = await queryWechatPaymentStatus(checkout.outTradeNo)

    if (paymentStatus.tradeState === 'SUCCESS') {
      const result = await activateCheckoutSession({
        checkoutSessionId: checkout.id,
        userId: user.id,
        transactionId: paymentStatus.transactionId,
        paidAt: paymentStatus.successTime,
      })

      if (!result) {
        return NextResponse.json({ error: 'Checkout session not found.' }, { status: 404 })
      }

      return NextResponse.json({
        status: 'paid',
        tradeState: paymentStatus.tradeState,
        checkout: result.checkout,
      })
    }

    return NextResponse.json({
      status: mapTradeState(paymentStatus.tradeState),
      tradeState: paymentStatus.tradeState,
      checkout,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WeChat payment status check failed.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
