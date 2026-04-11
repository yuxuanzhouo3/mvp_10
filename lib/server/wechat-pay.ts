import crypto from 'crypto'

interface WechatPayConfig {
  appId: string
  mchId: string
  apiV3Key: string
  privateKey: string
  serialNo: string
  notifyUrl: string
  apiBaseUrl: string
}

interface CreateWechatNativePaymentInput {
  amountFen: number
  description: string
  outTradeNo: string
}

export interface WechatPaymentStatus {
  tradeState: string
  transactionId: string | null
  successTime: string | null
}

function normalizePrivateKey(privateKey: string) {
  return privateKey.replace(/\\n/g, '\n').trim()
}

function getConfiguredNotifyUrl() {
  const directNotifyUrl = process.env.WECHAT_PAY_NOTIFY_URL?.trim()

  if (directNotifyUrl) {
    return directNotifyUrl
  }

  const appUrl = process.env.APP_URL?.trim()
  if (!appUrl) {
    return null
  }

  return `${appUrl.replace(/\/$/, '')}/api/billing/wechat/webhook`
}

export function getWechatPayConfig(): WechatPayConfig | null {
  const notifyUrl = getConfiguredNotifyUrl()
  const config = {
    appId: process.env.WECHAT_PAY_APP_ID?.trim() || process.env.WECHAT_APP_ID?.trim() || '',
    mchId: process.env.WECHAT_PAY_MCH_ID?.trim() || '',
    apiV3Key: process.env.WECHAT_PAY_API_V3_KEY?.trim() || '',
    privateKey: normalizePrivateKey(process.env.WECHAT_PAY_PRIVATE_KEY || ''),
    serialNo: process.env.WECHAT_PAY_SERIAL_NO?.trim() || '',
    notifyUrl: notifyUrl || '',
    apiBaseUrl: process.env.WECHAT_PAY_API_BASE_URL?.trim() || 'https://api.mch.weixin.qq.com',
  }

  if (
    !config.appId ||
    !config.mchId ||
    !config.apiV3Key ||
    !config.privateKey ||
    !config.serialNo ||
    !config.notifyUrl
  ) {
    return null
  }

  return config
}

function buildAuthorizationHeader(
  config: WechatPayConfig,
  method: string,
  canonicalUrl: string,
  bodyText: string
) {
  const nonceStr = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const message = `${method}\n${canonicalUrl}\n${timestamp}\n${nonceStr}\n${bodyText}\n`
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(message)
    .sign(config.privateKey, 'base64')

  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${config.serialNo}",signature="${signature}"`
}

async function requestWechatPay<TResponse>(
  config: WechatPayConfig,
  method: 'GET' | 'POST',
  path: string,
  searchParams?: URLSearchParams,
  body?: Record<string, unknown>
) {
  const query = searchParams && Array.from(searchParams.keys()).length > 0 ? `?${searchParams.toString()}` : ''
  const canonicalUrl = `${path}${query}`
  const bodyText = body ? JSON.stringify(body) : ''
  const authorization = buildAuthorizationHeader(config, method, canonicalUrl, bodyText)
  const response = await fetch(`${config.apiBaseUrl}${canonicalUrl}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: authorization,
      'Content-Type': 'application/json',
      'User-Agent': 'mvp_10-wechat-pay/1.0',
    },
    body: method === 'POST' ? bodyText : undefined,
    cache: 'no-store',
  })

  const payloadText = await response.text()
  const payload = payloadText ? (JSON.parse(payloadText) as TResponse & { message?: string; code?: string }) : ({} as TResponse)

  if (!response.ok) {
    const errorMessage =
      (typeof payload === 'object' &&
        payload &&
        'message' in payload &&
        typeof payload.message === 'string' &&
        payload.message) ||
      `WeChat Pay request failed with status ${response.status}.`

    throw new Error(errorMessage)
  }

  return payload
}

export function generateWechatOutTradeNo(checkoutSessionId: string) {
  const compactId = checkoutSessionId.replace(/-/g, '').slice(0, 18).toUpperCase()
  return `WX${Date.now().toString().slice(-10)}${compactId}`.slice(0, 32)
}

export async function createWechatNativePayment(input: CreateWechatNativePaymentInput) {
  const config = getWechatPayConfig()

  if (!config) {
    throw new Error('WeChat Pay is not configured yet.')
  }

  const payload = await requestWechatPay<{ code_url?: string }>(
    config,
    'POST',
    '/v3/pay/transactions/native',
    undefined,
    {
      appid: config.appId,
      mchid: config.mchId,
      description: input.description,
      out_trade_no: input.outTradeNo,
      notify_url: config.notifyUrl,
      amount: {
        total: input.amountFen,
        currency: 'CNY',
      },
    }
  )

  if (!payload.code_url) {
    throw new Error('WeChat Pay did not return a code_url.')
  }

  return {
    codeUrl: payload.code_url,
  }
}

export async function queryWechatPaymentStatus(outTradeNo: string): Promise<WechatPaymentStatus> {
  const config = getWechatPayConfig()

  if (!config) {
    throw new Error('WeChat Pay is not configured yet.')
  }

  const payload = await requestWechatPay<{
    trade_state?: string
    transaction_id?: string
    success_time?: string
  }>(
    config,
    'GET',
    `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}`,
    new URLSearchParams({ mchid: config.mchId })
  )

  return {
    tradeState: payload.trade_state || 'NOTPAY',
    transactionId: payload.transaction_id || null,
    successTime: payload.success_time || null,
  }
}
