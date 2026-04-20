import { createMailTransport, getAuthMailDeliveryConfig } from '@/lib/server/mail-config'

const DEFAULT_CODE_EXPIRES_IN_SECONDS = 600

interface SendAuthCodeEmailInput {
  code: string
  email: string
  expiresInSeconds?: number
  purpose: 'register' | 'reset-password'
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function isAuthEmailConfigured() {
  return getAuthMailDeliveryConfig() !== null
}

function buildAuthEmailContent(input: SendAuthCodeEmailInput) {
  const platformName = process.env.PLATFORM_NAME || 'AI招聘平台'
  const expiresInMinutes = Math.max(
    1,
    Math.round((input.expiresInSeconds ?? DEFAULT_CODE_EXPIRES_IN_SECONDS) / 60)
  )
  const isRegister = input.purpose === 'register'
  const subject = isRegister
    ? `${platformName} Registration Code`
    : `${platformName} Password Reset Code`
  const intro = isRegister
    ? `You are registering a ${platformName} account.`
    : `You are resetting your ${platformName} account password.`
  const actionLine = isRegister
    ? 'Enter the 6-digit verification code below on the registration page.'
    : 'Enter the 6-digit verification code below on the password reset page.'
  const safetyLine = 'If this was not you, you can safely ignore this email.'
  const text = [
    intro,
    actionLine,
    '',
    `Verification code: ${input.code}`,
    `Valid for: ${expiresInMinutes} minutes`,
    '',
    safetyLine,
  ].join('\n')

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.7;">
      <p>${escapeHtml(intro)}</p>
      <p>${escapeHtml(actionLine)}</p>
      <div style="margin: 24px 0; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f8fafc; text-align: center;">
        <div style="font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #0f172a;">${escapeHtml(input.code)}</div>
        <div style="margin-top: 8px; font-size: 14px; color: #475569;">Valid for ${expiresInMinutes} minutes</div>
      </div>
      <p>${escapeHtml(safetyLine)}</p>
    </div>
  `.trim()

  return { subject, text, html }
}

function getReadableMailError(error: unknown, smtpHost: string, smtpPort: number) {
  if (!(error instanceof Error)) {
    return `Unable to connect to SMTP server ${smtpHost}:${smtpPort}.`
  }

  const errorWithCode = error as Error & { code?: string }

  if (['ESOCKET', 'ETIMEDOUT', 'ECONNECTION', 'ECONNRESET'].includes(errorWithCode.code || '')) {
    return `Unable to connect to SMTP server ${smtpHost}:${smtpPort}. Check the SMTP host, port, and any local proxy or TUN settings before trying again.`
  }

  return error.message
}

async function sendAuthCodeEmail(input: SendAuthCodeEmailInput) {
  const config = getAuthMailDeliveryConfig()

  if (!config) {
    throw new Error('Auth email SMTP is not configured.')
  }

  const transporter = createMailTransport(config)
  const { subject, text, html } = buildAuthEmailContent(input)

  try {
    return await transporter.sendMail({
      from: config.from,
      to: input.email,
      replyTo: config.replyTo,
      subject,
      text,
      html,
    })
  } catch (error) {
    throw new Error(getReadableMailError(error, config.host, config.port))
  }
}

export async function sendRegistrationCodeEmail(
  email: string,
  code: string,
  expiresInSeconds = DEFAULT_CODE_EXPIRES_IN_SECONDS
) {
  return sendAuthCodeEmail({
    email,
    code,
    expiresInSeconds,
    purpose: 'register',
  })
}

export async function sendPasswordResetCodeEmail(
  email: string,
  code: string,
  expiresInSeconds = DEFAULT_CODE_EXPIRES_IN_SECONDS
) {
  return sendAuthCodeEmail({
    email,
    code,
    expiresInSeconds,
    purpose: 'reset-password',
  })
}
