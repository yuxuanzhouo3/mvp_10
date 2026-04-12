import { NextResponse } from 'next/server'

import { createRegistrationVerificationCode, getUserByEmail } from '@/lib/server/auth-store'
import {
  createLocalVerificationCode,
  isCloudBaseAuthConfigured,
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
    const existingUser = await getUserByEmail(normalizedEmail)

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 400 }
      )
    }

    await assertCodeSendAllowed('register', normalizedEmail)

    const cloudBaseConfigured = isCloudBaseAuthConfigured()

    if (cloudBaseConfigured) {
      const verification = await sendCloudBaseEmailVerification(normalizedEmail)
      await createRegistrationVerificationCode(
        normalizedEmail,
        verification.verificationId,
        verification.expiresIn
      )
    } else {
      const localCode = createLocalVerificationCode()
      await createRegistrationVerificationCode(
        normalizedEmail,
        `local:${crypto.randomUUID()}`,
        600,
        localCode
      )
      await recordCodeSend('register', normalizedEmail)

      return NextResponse.json({
        message: `CloudBase 未配置，当前走临时本地验证码模式。验证码：${localCode}（10 分钟内有效）`,
      })
    }

    await recordCodeSend('register', normalizedEmail)

    return NextResponse.json({
      message: 'Verification code sent to your email.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send verification code.'
    const cooldownMessage = getCooldownMessage(message)
    const status =
      cooldownMessage
        ? 429
        : message === 'An account with this email already exists.'
          ? 400
          : isCloudBaseAuthVerificationError(error) && error.status >= 400 && error.status < 500
            ? error.status
          : 500

    return NextResponse.json(
      {
        error: cooldownMessage || message,
      },
      { status }
    )
  }
}
