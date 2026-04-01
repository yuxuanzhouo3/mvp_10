import { NextResponse } from 'next/server'

import {
  createSession,
  createUser,
  deleteRegistrationVerificationCode,
  getUserByEmail,
  verifyRegistrationCode,
} from '@/lib/server/auth-store'
import { createAuthToken } from '@/lib/server/jwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: unknown
      password?: unknown
      name?: unknown
      code?: unknown
    }

    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      return NextResponse.json({ error: '请输入至少 2 个字符的姓名。' }, { status: 400 })
    }

    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return NextResponse.json({ error: '请输入有效的邮箱地址。' }, { status: 400 })
    }

    if (typeof body.password !== 'string' || body.password.length < 8) {
      return NextResponse.json({ error: '密码至少需要 8 位。' }, { status: 400 })
    }

    if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code.trim())) {
      return NextResponse.json({ error: '请输入 6 位邮箱验证码。' }, { status: 400 })
    }

    const normalizedEmail = body.email.trim().toLowerCase()
    const existingUser = await getUserByEmail(normalizedEmail)

    if (existingUser) {
      return NextResponse.json({ error: '该邮箱已注册，请直接登录。' }, { status: 400 })
    }

    const verification = await verifyRegistrationCode(normalizedEmail, body.code.trim())

    if (!verification) {
      return NextResponse.json({ error: '验证码错误或已过期，请重新获取。' }, { status: 400 })
    }

    const user = await createUser({
      email: normalizedEmail,
      password: body.password,
      name: body.name,
    })
    const session = await createSession(user.id)
    const token = await createAuthToken(user.id, session.token)

    void deleteRegistrationVerificationCode(verification.id).catch((cleanupError) => {
      console.error('Failed to delete registration verification code:', cleanupError)
    })

    return NextResponse.json({
      user,
      token,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '注册失败。'
    const status = message === 'An account with this email already exists.' ? 400 : 500

    return NextResponse.json(
      {
        error: status === 400 ? '该邮箱已注册，请直接登录。' : message,
      },
      { status }
    )
  }
}
