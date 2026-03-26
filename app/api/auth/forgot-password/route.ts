import { NextResponse } from 'next/server'

import { createPasswordResetCode, getUserByEmail } from '@/lib/server/auth-store'
import { sendPasswordResetEmail } from '@/lib/server/password-reset-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: unknown
    }

    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return NextResponse.json({ error: '请输入有效的邮箱地址。' }, { status: 400 })
    }

    const normalizedEmail = body.email.trim().toLowerCase()
    const user = await getUserByEmail(normalizedEmail)

    if (!user) {
      return NextResponse.json({
        message: '如果该邮箱已注册，系统会向该邮箱发送验证码。',
      })
    }

    const { code } = await createPasswordResetCode(normalizedEmail)
    const delivery = await sendPasswordResetEmail(normalizedEmail, code)

    return NextResponse.json({
      message:
        delivery.mode === 'smtp'
          ? '验证码已发送到邮箱，请查收。'
          : `SMTP 未配置，已生成预览验证码：${code}`,
      delivery,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '发送验证码失败。'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
