import { NextResponse } from 'next/server'

import { requireAuthenticatedUser } from '@/lib/server/auth-helpers'
import { activateCheckoutSession, getOwnedCheckoutSession } from '@/lib/server/billing-service'
import { queryWechatPaymentStatus } from '@/lib/server/wechat-pay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const body = (await request.json()) as { checkoutSessionId?: unknown }

    if (typeof body.checkoutSessionId !== 'string' || !body.checkoutSessionId.trim()) {
      return NextResponse.json({ error: 'Checkout session id is required.' }, { status: 400 })
    }

    const ownedCheckout = await getOwnedCheckoutSession(body.checkoutSessionId, user.id)
    if (!ownedCheckout) {
      return NextResponse.json({ error: 'Checkout session not found.' }, { status: 404 })
    }

    if (ownedCheckout.paymentMethod === 'wechat' && ownedCheckout.mode === 'wechat_native' && !ownedCheckout.isMock) {
      if (!ownedCheckout.outTradeNo) {
        return NextResponse.json({ error: 'WeChat order number is missing.' }, { status: 400 })
      }

      const paymentStatus = await queryWechatPaymentStatus(ownedCheckout.outTradeNo)
      if (paymentStatus.tradeState !== 'SUCCESS') {
        return NextResponse.json(
          {
            error: 'WeChat payment has not completed yet.',
            tradeState: paymentStatus.tradeState,
          },
          { status: 409 }
        )
      }

      const result = await activateCheckoutSession({
        checkoutSessionId: ownedCheckout.id,
        userId: user.id,
        transactionId: paymentStatus.transactionId,
        paidAt: paymentStatus.successTime,
      })

      if (!result) {
        return NextResponse.json({ error: 'Checkout session not found.' }, { status: 404 })
      }

      return NextResponse.json(result)
    }

    const result = await activateCheckoutSession({
      checkoutSessionId: ownedCheckout.id,
      userId: user.id,
    })

    if (!result) {
      return NextResponse.json({ error: 'Checkout session not found.' }, { status: 404 })
    }

    return NextResponse.json({
      checkout: result.checkout,
      user: result.user,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment confirmation failed.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
