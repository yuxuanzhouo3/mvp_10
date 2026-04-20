interface WxMiniProgram {
  getEnv?: (callback: (res: { miniprogram: boolean }) => void) => void
  navigateBack?: (options?: { delta?: number }) => void
  navigateTo?: (options: { url: string }) => void
  postMessage?: (data: unknown) => void
}

declare global {
  interface Window {
    wx?: { miniProgram?: WxMiniProgram }
    __wxjs_environment?: string
  }
}

export interface WechatMiniProgramCallbackPayload {
  token: string | null
  openid: string | null
  expiresIn: string | null
  nickName: string | null
  avatarUrl: string | null
  code: string | null
}

function safeDecode(value: string | null) {
  if (!value) {
    return null
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function isMiniProgram() {
  if (typeof window === 'undefined') {
    return false
  }

  const userAgent = window.navigator.userAgent.toLowerCase()

  if (userAgent.includes('miniprogram')) {
    return true
  }

  if (window.__wxjs_environment === 'miniprogram') {
    return true
  }

  const url = new URL(window.location.href)
  return url.searchParams.get('_wxjs_environment') === 'miniprogram'
}

export function getWxMiniProgram() {
  if (typeof window === 'undefined' || !window.wx || typeof window.wx !== 'object') {
    return null
  }

  return window.wx.miniProgram ?? null
}

export function waitForWxSDK(timeout = 3000): Promise<WxMiniProgram | null> {
  return new Promise((resolve) => {
    const direct = getWxMiniProgram()

    if (direct) {
      resolve(direct)
      return
    }

    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const current = getWxMiniProgram()

      if (current) {
        window.clearInterval(timer)
        resolve(current)
        return
      }

      if (Date.now() - startedAt >= timeout) {
        window.clearInterval(timer)
        resolve(null)
      }
    }, 120)
  })
}

export function parseWxMpLoginCallback(): WechatMiniProgramCallbackPayload | null {
  if (typeof window === 'undefined') {
    return null
  }

  const url = new URL(window.location.href)
  const token = safeDecode(url.searchParams.get('token'))
  const openid = safeDecode(url.searchParams.get('openid'))
  const expiresIn = safeDecode(url.searchParams.get('expiresIn'))
  const nickName = safeDecode(url.searchParams.get('mpNickName'))
  const avatarUrl = safeDecode(url.searchParams.get('mpAvatarUrl'))
  const code = safeDecode(url.searchParams.get('mpCode'))

  if (!token && !openid && !code && !nickName && !avatarUrl) {
    return null
  }

  return {
    token,
    openid,
    expiresIn,
    nickName,
    avatarUrl,
    code,
  }
}

export function clearWxMpLoginParams() {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)

  for (const key of [
    'token',
    'openid',
    'expiresIn',
    'mpCode',
    'mpNickName',
    'mpAvatarUrl',
    'mpProfileTs',
    'mpReadyTs',
    'mpPongTs',
  ]) {
    url.searchParams.delete(key)
  }

  window.history.replaceState({}, '', url.toString())
}

export async function requestWxMpLogin(returnUrl?: string) {
  const miniProgram = await waitForWxSDK()

  if (!miniProgram) {
    return false
  }

  const targetUrl = returnUrl || (typeof window !== 'undefined' ? window.location.href : '')

  if (typeof miniProgram.navigateTo === 'function') {
    miniProgram.navigateTo({
      url: `/pages/webshell/login?returnUrl=${encodeURIComponent(targetUrl)}`,
    })
    return true
  }

  if (typeof miniProgram.postMessage === 'function') {
    miniProgram.postMessage({
      data: {
        type: 'REQUEST_WX_LOGIN',
        returnUrl: targetUrl,
      },
    })
    return true
  }

  return false
}

export async function exchangeWechatMiniCode(input: {
  code: string
  nickName?: string | null
  avatarUrl?: string | null
}) {
  const response = await fetch('/api/wxlogin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean
    token?: string
    openid?: string
    expiresIn?: number
    user?: unknown
    message?: string
    error?: string
  }

  if (!response.ok || !payload.success || !payload.token || !payload.openid) {
    throw new Error(payload.message || payload.error || 'WeChat login failed.')
  }

  return payload
}
