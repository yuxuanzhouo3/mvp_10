import nodemailer from 'nodemailer'

import { buildContactOptionHtml, buildContactOptionTextLines } from '@/lib/server/contact-options'
import type { ResumeRecord } from '@/types/resume'

export interface ReceiptDeliveryResult {
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

function buildReceiptContent(record: ResumeRecord) {
  const platformName = process.env.PLATFORM_NAME || 'JobSearch Platform'
  const schedulerUrl = process.env.INTERVIEW_SCHEDULING_URL
  const supportEmail = process.env.RECRUITING_SUPPORT_EMAIL || process.env.SMTP_FROM || 'recruiting@example.com'
  const candidateName = record.contact.name || 'there'
  const subject = `${platformName}: We received your resume`

  const intro = `Hi ${candidateName},`
  const lines = [
    intro,
    '',
    `Thanks for submitting your resume to ${platformName}. We have received your information successfully and our team will review it shortly.`,
    '',
    'What happens next:',
    '- We review your background and the extracted resume details.',
    '- If your profile matches an open role, we will contact you for the next step.',
    '- You can reply to this email if you want to update your contact details.',
  ]

  if (schedulerUrl) {
    lines.push('', `If you prefer to move faster, you can also book an interview slot here: ${schedulerUrl}`)
  }

  lines.push(...buildContactOptionTextLines())
  lines.push('', `Questions? Reply to this email or contact ${supportEmail}.`, '', `Best regards,`, `${platformName} Recruiting`)

  const text = lines.join('\n')
  const htmlParagraphs = lines.map((line) => {
    if (line.startsWith('- ')) {
      return `<li>${escapeHtml(line.slice(2))}</li>`
    }

    return line.length > 0 ? `<p>${escapeHtml(line)}</p>` : ''
  })

  const htmlListItems = htmlParagraphs.filter((line) => line.startsWith('<li>'))
  const htmlBlocks = htmlParagraphs
    .filter((line) => !line.startsWith('<li>'))
    .filter(Boolean)
    .join('')

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      ${htmlBlocks}
      ${htmlListItems.length > 0 ? `<ul>${htmlListItems.join('')}</ul>` : ''}
      ${buildContactOptionHtml()}
    </div>
  `.trim()

  return { subject, text, html }
}

export async function sendReceiptEmail(record: ResumeRecord): Promise<ReceiptDeliveryResult> {
  if (!record.contact.email) {
    throw new Error('Candidate email is required before sending a receipt email.')
  }

  const { subject, text, html } = buildReceiptContent(record)

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
      message: 'SMTP is not configured yet. A receipt draft was generated but not sent.',
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
    to: record.contact.email,
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
    message: 'Receipt email sent successfully.',
    messageId: info.messageId,
  }
}
