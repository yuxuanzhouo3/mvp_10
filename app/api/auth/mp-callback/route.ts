import { NextResponse } from 'next/server'

import { getSessionUser, updateUser } from '@/lib/server/auth-store'
import { verifyAuthToken } from '@/lib/server/jwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_WECHAT_USER_NAME = '微信用户'

function shouldReplaceWechatDisplayName(name: string) {
  const normalized = name.trim().toLowerCase()

  return (
    !normalized ||
    normalized === DEFAULT_WECHAT_USER_NAME.toLowerCase() ||
    normalized.startsWith('微信用户') ||
    normalized.startsWith('wechat user')
  )
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: unknown
      openid?: unknown
      expiresIn?: unknown
      nickName?: unknown
      avatarUrl?: unknown
    }

    if (typeof body.token !== 'string' || typeof body.openid !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token and openid are required.' },
        { status: 400 }
      )
    }

    const { sessionToken } = await verifyAuthToken(body.token)
    const user = await getSessionUser(sessionToken)

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Session is invalid or expired.' },
        { status: 401 }
      )
    }

    const normalizedOpenId = body.openid.trim()
    const normalizedName = typeof body.nickName === 'string' ? body.nickName.trim() : ''
    const normalizedAvatar = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : ''
    const maxAge =
      typeof body.expiresIn === 'number'
        ? body.expiresIn
        : typeof body.expiresIn === 'string' && body.expiresIn.trim()
          ? Number(body.expiresIn)
          : 7 * 24 * 60 * 60

    const nextUser = await updateUser(user.id, (existing) => ({
      ...existing,
      authProvider: 'wechat_mp',
      wechatOpenId: normalizedOpenId,
      name:
        normalizedName && shouldReplaceWechatDisplayName(existing.name)
          ? normalizedName
          : existing.name,
      avatar: normalizedAvatar || existing.avatar,
    }))

    const response = NextResponse.json({
      success: true,
      user: nextUser ?? user,
    })

    response.cookies.set('auth_token', body.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Number.isFinite(maxAge) ? maxAge : 7 * 24 * 60 * 60,
      path: '/',
    })

    response.cookies.set('auth-token', body.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Number.isFinite(maxAge) ? maxAge : 7 * 24 * 60 * 60,
      path: '/',
    })

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mini-program callback failed.'

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
