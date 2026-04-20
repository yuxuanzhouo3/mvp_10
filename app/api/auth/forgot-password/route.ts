import { NextResponse } from 'next/server'

import { isCnEdition } from '@/lib/app-version'
import { isAuthEmailConfigured, sendPasswordResetCodeEmail } from '@/lib/server/auth-email'
import { createPasswordResetCode, getUserByEmail } from '@/lib/server/auth-store'
import {
  createLocalVerificationCode,
  isCloudBaseAuthConfigured,
  isCloudBaseAuthVerificationError,
  sendCloudBaseEmailVerification,
  shouldFallbackToLocalVerification,
} from '@/lib/server/cloudbase-auth-verification'
import { assertCodeSendAllowed, recordCodeSend } from '@/lib/server/code-send-rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getCooldownMessage(message: string) {
  const match = message.match(/Please wait (\d+) seconds before requesting another verification code\./)
  return match ? `Please wait ${match[1]} seconds before requesting another verification code.` : null
}

function getClientFacingError(message: string) {
  if (message.includes('Unable to connect to SMTP server')) {
    return '验证码邮件暂时无法发送，请检查 SMTP 主机、端口，或关闭本机代理/TUN 后重试。'
  }

  return message
}

async function sendCnResetCode(email: string) {
  const localCode = createLocalVerificationCode()
  const expiresInSeconds = 600

  await createPasswordResetCode(email, `smtp:${crypto.randomUUID()}`, expiresInSeconds, localCode)
  await sendPasswordResetCodeEmail(email, localCode, expiresInSeconds)
  await recordCodeSend('reset-password', email)

  return NextResponse.json({
    message: 'Verification code sent to your email.',
  })
}

async function sendLocalResetCode(email: string) {
  const localCode = createLocalVerificationCode()

  await createPasswordResetCode(email, `local:${crypto.randomUUID()}`, 600, localCode)
  await recordCodeSend('reset-password', email)

  return NextResponse.json({
    message: `Email delivery is unavailable right now. Use this local test code: ${localCode} (valid for 10 minutes).`,
  })
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

    if (isCnEdition()) {
      if (!isAuthEmailConfigured()) {
        throw new Error('Auth email SMTP is not configured for the CN edition.')
      }

      return await sendCnResetCode(normalizedEmail)
    }

    if (!isCloudBaseAuthConfigured()) {
      return await sendLocalResetCode(normalizedEmail)
    }

    try {
      const verification = await sendCloudBaseEmailVerification(normalizedEmail)
      await createPasswordResetCode(
        normalizedEmail,
        verification.verificationId,
        verification.expiresIn
      )
    } catch (error) {
      if (!shouldFallbackToLocalVerification(error)) {
        throw error
      }

      console.warn(
        '[auth] forgot-password fell back to local verification:',
        error instanceof Error ? error.message : error
      )

      return await sendLocalResetCode(normalizedEmail)
    }

    await recordCodeSend('reset-password', normalizedEmail)

    return NextResponse.json({
      message: 'Verification code sent to your email.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send verification code.'
    const clientFacingMessage = getClientFacingError(message)
    const cooldownMessage = getCooldownMessage(message)
    const status =
      cooldownMessage
        ? 429
        : isCloudBaseAuthVerificationError(error) && error.status >= 400 && error.status < 500
          ? error.status
          : 500

    return NextResponse.json(
      { error: cooldownMessage || clientFacingMessage },
      { status }
    )
  }
}
