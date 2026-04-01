import nodemailer from 'nodemailer'

export type EmailDeliveryMode = 'api' | 'smtp' | 'preview'
export type EmailDeliveryProvider = 'resend' | 'smtp' | 'preview'

export interface EmailDeliveryPayload {
  to: string
  subject: string
  text: string
  html: string
}

export interface EmailDeliveryResult {
  mode: EmailDeliveryMode
  provider: EmailDeliveryProvider
  subject: string
  text: string
  html: string
  message: string
  messageId?: string
}

function trimEnv(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function buildPreviewResult(
  payload: EmailDeliveryPayload,
  message: string
): EmailDeliveryResult {
  return {
    mode: 'preview',
    provider: 'preview',
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    message,
  }
}

async function sendWithResend(
  payload: EmailDeliveryPayload
): Promise<EmailDeliveryResult | null> {
  const apiKey = trimEnv(process.env.RESEND_API_KEY)
  const from = trimEnv(process.env.RESEND_FROM)

  if (!apiKey || !from) {
    return null
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      reply_to:
        trimEnv(process.env.RESEND_REPLY_TO) ||
        trimEnv(process.env.SMTP_REPLY_TO) ||
        from,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  })

  const responseJson = (await response.json().catch(() => ({}))) as {
    id?: string
    message?: string
    name?: string
    error?: {
      message?: string
    }
  }

  if (!response.ok) {
    const errorMessage =
      responseJson.error?.message ||
      responseJson.message ||
      `Resend API request failed with status ${response.status}.`

    throw new Error(errorMessage)
  }

  return {
    mode: 'api',
    provider: 'resend',
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    message: 'Email sent successfully via API.',
    messageId: responseJson.id,
  }
}

async function sendWithSmtp(
  payload: EmailDeliveryPayload
): Promise<EmailDeliveryResult | null> {
  const host = trimEnv(process.env.SMTP_HOST)
  const from = trimEnv(process.env.SMTP_FROM)

  if (!host || !from) {
    return null
  }

  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587
  const user = trimEnv(process.env.SMTP_USER)
  const pass = trimEnv(process.env.SMTP_PASS)

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  })

  const info = await transporter.sendMail({
    from,
    to: payload.to,
    replyTo: trimEnv(process.env.SMTP_REPLY_TO) || from,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  })

  return {
    mode: 'smtp',
    provider: 'smtp',
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    message: 'Email sent successfully via SMTP.',
    messageId: info.messageId,
  }
}

export async function deliverEmail(payload: EmailDeliveryPayload): Promise<EmailDeliveryResult> {
  try {
    const resendResult = await sendWithResend(payload)

    if (resendResult) {
      return resendResult
    }
  } catch (error) {
    console.error('API email delivery failed, falling back to SMTP:', error)
  }

  try {
    const smtpResult = await sendWithSmtp(payload)

    if (smtpResult) {
      return smtpResult
    }
  } catch (error) {
    console.error('SMTP email delivery failed, falling back to preview mode:', error)
  }

  return buildPreviewResult(
    payload,
    'No email provider is available. A preview was generated instead.'
  )
}
