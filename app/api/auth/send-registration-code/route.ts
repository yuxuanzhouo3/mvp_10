import { NextResponse } from 'next/server'

import { createRegistrationVerificationCode } from '@/lib/server/auth-store'
import { assertCodeSendAllowed, recordCodeSend } from '@/lib/server/code-send-rate-limit'
import { sendRegistrationVerificationEmail } from '@/lib/server/registration-verification-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getCooldownMessage(message: string) {
  const match = message.match(/Please wait (\d+) seconds before requesting another verification code\./)
  return match ? `请等待 ${match[1]} 秒后再发送验证码。` : null
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: unknown
    }

    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return NextResponse.json({ error: '请输入有效的邮箱地址。' }, { status: 400 })
    }

    const normalizedEmail = body.email.trim().toLowerCase()
    await assertCodeSendAllowed('register', normalizedEmail)

    const { code } = await createRegistrationVerificationCode(normalizedEmail)
    await recordCodeSend('register', normalizedEmail)

    const delivery = await sendRegistrationVerificationEmail(normalizedEmail, code)

    return NextResponse.json({
      message:
        delivery.mode === 'preview'
          ? `邮件服务当前不可用，已切换为预览模式。注册验证码：${code}`
          : '验证码已发送到邮箱，请查收。',
      delivery,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '发送验证码失败。'
    const cooldownMessage = getCooldownMessage(message)
    const status =
      cooldownMessage
        ? 429
        : message === 'An account with this email already exists.'
          ? 400
          : 500

    return NextResponse.json(
      {
        error: cooldownMessage || (status === 400 ? '该邮箱已注册，请直接登录。' : message),
      },
      { status }
    )
  }
}
