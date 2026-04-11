import { NextResponse } from 'next/server'

import { createPasswordResetCode, getUserByEmail } from '@/lib/server/auth-store'
import {
  isCloudBaseAuthVerificationError,
  sendCloudBaseEmailVerification,
} from '@/lib/server/cloudbase-auth-verification'
import { assertCodeSendAllowed, recordCodeSend } from '@/lib/server/code-send-rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getCooldownMessage(message: string) {
  const match = message.match(/Please wait (\d+) seconds before requesting another verification code\./)
  return match ? `Please wait ${match[1]} seconds before requesting another verification code.` : null
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: unknown
    }

    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
    }

    const normalizedEmail = body.email.trim().toLowerCase()
    const user = await getUserByEmail(normalizedEmail)

    if (!user) {
      return NextResponse.json({
        message: 'If this email exists, a verification code has been sent.',
      })
    }

    await assertCodeSendAllowed('reset-password', normalizedEmail)

    const verification = await sendCloudBaseEmailVerification(normalizedEmail)
    await createPasswordResetCode(
      normalizedEmail,
      verification.verificationId,
      verification.expiresIn
    )
    await recordCodeSend('reset-password', normalizedEmail)

    return NextResponse.json({
      message: 'Verification code sent to your email.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send verification code.'
    const cooldownMessage = getCooldownMessage(message)
    const status =
      cooldownMessage
        ? 429
        : isCloudBaseAuthVerificationError(error) && error.status >= 400 && error.status < 500
          ? error.status
          : 500

    return NextResponse.json(
      { error: cooldownMessage || message },
      { status }
    )
  }
}
