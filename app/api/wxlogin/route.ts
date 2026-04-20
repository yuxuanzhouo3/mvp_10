import { NextResponse } from 'next/server'

import { loginWithWechatMiniProgram } from '@/lib/server/wechat-mini-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getWechatLoginErrorStatus(message: string) {
  if (message === 'WeChat login code is required.') {
    return 400
  }

  if (
    message === 'The WeChat login code is invalid or expired.' ||
    /invalid|expired/i.test(message)
  ) {
    return 401
  }

  if (message === 'WeChat mini-program credentials are not configured.') {
    return 500
  }

  return 500
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: unknown
      nickName?: unknown
      avatarUrl?: unknown
    }

    if (typeof body.code !== 'string' || !body.code.trim()) {
      return NextResponse.json(
        { success: false, error: 'INVALID_PARAMS', message: 'code is required' },
        { status: 400 }
      )
    }

    const result = await loginWithWechatMiniProgram({
      code: body.code,
      nickName: typeof body.nickName === 'string' ? body.nickName : null,
      avatarUrl: typeof body.avatarUrl === 'string' ? body.avatarUrl : null,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WeChat mini-program login failed.'

    return NextResponse.json(
      {
        success: false,
        error: 'WXLOGIN_FAILED',
        message,
      },
      { status: getWechatLoginErrorStatus(message) }
    )
  }
}
