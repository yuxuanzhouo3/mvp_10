import nodemailer from 'nodemailer'

import { buildContactOptionHtml, buildContactOptionTextLines } from '@/lib/server/contact-options'
import type { ResumeRecord } from '@/types/resume'

export interface InterviewInviteDeliveryResult {
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

function buildInterviewInviteContent(record: ResumeRecord) {
  const platformName = process.env.PLATFORM_NAME || 'JobSearch Platform'
  const schedulerUrl = process.env.INTERVIEW_SCHEDULING_URL
  const supportEmail = process.env.RECRUITING_SUPPORT_EMAIL || process.env.SMTP_FROM || 'recruiting@example.com'
  const candidateName = record.contact.name || 'there'
  const subject = `${platformName}: Interview invitation`

  const lines = [
    `Hi ${candidateName},`,
    '',
    `Thanks again for your interest in ${platformName}. We would like to invite you to the next interview step.`,
    '',
    'Next step details:',
    '- Please choose a time slot or reply with your availability.',
    '- You can also add us on an opt-in chat channel if that is faster for you.',
    '- If any contact detail has changed, just reply to this email and we will update your profile.',
  ]

  if (schedulerUrl) {
    lines.push('', `Interview booking link: ${schedulerUrl}`)
  } else {
    lines.push('', 'Reply to this email with a few available time slots and we will help coordinate the interview.')
  }

  lines.push(...buildContactOptionTextLines())
  lines.push(
    '',
    'We will use your resume summary and assessment results to guide the conversation, so no need to resend your materials.',
    '',
    `Questions? Reply to this email or contact ${supportEmail}.`,
    '',
    'Best regards,',
    `${platformName} Recruiting`
  )

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

export async function sendInterviewInviteEmail(record: ResumeRecord): Promise<InterviewInviteDeliveryResult> {
  if (!record.contact.email) {
    throw new Error('Candidate email is required before sending an interview invite.')
  }

  const { subject, text, html } = buildInterviewInviteContent(record)

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
      message: 'SMTP is not configured yet. An interview invite draft was generated but not sent.',
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
    message: 'Interview invite email sent successfully.',
    messageId: info.messageId,
  }
}
