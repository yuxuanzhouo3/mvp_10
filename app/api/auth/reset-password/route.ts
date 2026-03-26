import { NextResponse } from 'next/server'

import { resetPasswordWithCode } from '@/lib/server/auth-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: unknown
      code?: unknown
      newPassword?: unknown
    }

    if (typeof body.email !== 'string' || !body.email.trim()) {
      return NextResponse.json({ error: '请输入邮箱地址。' }, { status: 400 })
    }

    if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code.trim())) {
      return NextResponse.json({ error: '请输入 6 位验证码。' }, { status: 400 })
    }

    if (typeof body.newPassword !== 'string' || body.newPassword.length < 8) {
      return NextResponse.json({ error: '新密码至少需要 8 位。' }, { status: 400 })
    }

    const user = await resetPasswordWithCode(body.email, body.code.trim(), body.newPassword)

    if (!user) {
      return NextResponse.json({ error: '验证码错误、已过期，或该邮箱不存在。' }, { status: 400 })
    }

    return NextResponse.json({
      message: '密码已重置，请使用新密码登录。',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '重置密码失败。'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
