import { createSession, upsertWechatUser } from '@/lib/server/auth-store'
import { createAuthToken } from '@/lib/server/jwt'

const MINI_PROGRAM_LOGIN_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60

interface WechatCodeSessionResponse {
  errcode?: number
  errmsg?: string
  openid?: string
  unionid?: string
  session_key?: string
}

function getWechatMiniConfig() {
  const appId = process.env.WX_MINI_APPID?.trim() || process.env.WECHAT_APP_ID?.trim()
  const appSecret = process.env.WX_MINI_SECRET?.trim() || process.env.WECHAT_APP_SECRET?.trim()

  if (!appId || !appSecret) {
    throw new Error('WeChat mini-program credentials are not configured.')
  }

  return { appId, appSecret }
}

export async function exchangeWechatMiniProgramCode(code: string) {
  const normalizedCode = code.trim()

  if (!normalizedCode) {
    throw new Error('WeChat login code is required.')
  }

  const { appId, appSecret } = getWechatMiniConfig()
  const query = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    js_code: normalizedCode,
    grant_type: 'authorization_code',
  })
  const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })
  const payload = (await response.json()) as WechatCodeSessionResponse

  if (!response.ok) {
    throw new Error('Failed to contact WeChat mini-program login service.')
  }

  if (payload.errcode || !payload.openid) {
    throw new Error(payload.errmsg || 'The WeChat login code is invalid or expired.')
  }

  return {
    openId: payload.openid,
    unionId: payload.unionid || null,
  }
}

export async function loginWithWechatMiniProgram(input: {
  code: string
  nickName?: string | null
  avatarUrl?: string | null
}) {
  const sessionPayload = await exchangeWechatMiniProgramCode(input.code)
  const user = await upsertWechatUser({
    openId: sessionPayload.openId,
    unionId: sessionPayload.unionId,
    name: input.nickName,
    avatar: input.avatarUrl,
  })
  const session = await createSession(user.id)
  const token = await createAuthToken(user.id, session.token)

  return {
    success: true as const,
    token,
    openid: sessionPayload.openId,
    expiresIn: MINI_PROGRAM_LOGIN_EXPIRES_IN_SECONDS,
    hasProfile: Boolean(user.name && user.avatar),
    user,
  }
}
