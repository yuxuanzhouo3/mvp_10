import nodemailer from 'nodemailer'

export interface PasswordResetDeliveryResult {
  mode: 'smtp' | 'preview'
  subject: string
  text: string
  html: string
  message: string
  messageId?: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildPasswordResetContent(email: string, code: string) {
  const platformName = process.env.PLATFORM_NAME || 'JobSearch Platform'
  const supportEmail =
    process.env.RECRUITING_SUPPORT_EMAIL || process.env.SMTP_FROM || 'support@example.com'
  const subject = `${platformName}: Password reset verification code`
  const lines = [
    `Hi ${email},`,
    '',
    `We received a request to reset your ${platformName} password.`,
    '',
    `Your verification code is: ${code}`,
    '',
    'This code will expire in 10 minutes.',
    'If you did not request a password reset, you can ignore this email.',
    '',
    `Questions? Reply to this email or contact ${supportEmail}.`,
  ]

  const text = lines.join('\n')
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      ${lines
        .map((line) =>
          line
            ? `<p>${escapeHtml(line)}</p>`
            : ''
        )
        .filter(Boolean)
        .join('')}
    </div>
  `.trim()

  return { subject, text, html }
}

export async function sendPasswordResetEmail(
  email: string,
  code: string
): Promise<PasswordResetDeliveryResult> {
  const { subject, text, html } = buildPasswordResetContent(email, code)
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM

  if (!host || !from) {
    return {
      mode: 'preview',
      subject,
      text,
      html,
      message: 'SMTP is not configured yet. A password reset email preview was generated instead.',
    }
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  })

  const info = await transporter.sendMail({
    from,
    to: email,
    replyTo: process.env.SMTP_REPLY_TO || from,
    subject,
    text,
    html,
  })

  return {
    mode: 'smtp',
    subject,
    text,
    html,
    message: 'Password reset code sent successfully.',
    messageId: info.messageId,
  }
}
