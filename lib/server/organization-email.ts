import nodemailer from 'nodemailer'

import { buildContactOptionHtml, buildContactOptionTextLines } from '@/lib/server/contact-options'
import type { OrganizationLead } from '@/types/organization'

export interface OrganizationInviteDeliveryResult {
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

function buildInviteContent(record: OrganizationLead) {
  const platformName = process.env.PLATFORM_NAME || 'JobSearch Platform'
  const onboardingUrl = process.env.EMPLOYER_ONBOARDING_URL
  const schedulerUrl = process.env.EMPLOYER_DEMO_URL
  const supportEmail =
    process.env.RECRUITING_SUPPORT_EMAIL || process.env.SMTP_FROM || 'recruiting@example.com'
  const contactName = record.contact.contactName || 'team'
  const subject = `${platformName}: Invitation to onboard your hiring team`

  const lines = [
    `Hi ${contactName},`,
    '',
    `We found your public hiring contact for ${record.companyName} and would love to invite your team to onboard on ${platformName}.`,
    '',
    'What you can do next:',
    '- Join the platform to manage candidate intake, screening, interview workflow, and offers in one place.',
  ]

  if (onboardingUrl) {
    lines.push(`- Complete onboarding here: ${onboardingUrl}`)
  }

  if (schedulerUrl) {
    lines.push(`- Book a product walkthrough here: ${schedulerUrl}`)
  }

  lines.push(...buildContactOptionTextLines())
  lines.push('', `Questions? Reply to this email or contact ${supportEmail}.`, '', `${platformName} Growth`)

  const text = lines.join('\n')

  const htmlListItems = lines
    .filter((line) => line.startsWith('- '))
    .map((line) => `<li>${escapeHtml(line.slice(2))}</li>`)
    .join('')

  const htmlParagraphs = lines
    .filter((line) => !line.startsWith('- '))
    .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : ''))
    .filter(Boolean)
    .join('')

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      ${htmlParagraphs}
      ${htmlListItems ? `<ul>${htmlListItems}</ul>` : ''}
      ${buildContactOptionHtml()}
    </div>
  `.trim()

  return { subject, text, html }
}

export async function sendOrganizationInviteEmail(
  record: OrganizationLead
): Promise<OrganizationInviteDeliveryResult> {
  if (!record.contact.email) {
    throw new Error('Employer email is required before sending an onboarding invite.')
  }

  const { subject, text, html } = buildInviteContent(record)
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
      message: 'SMTP is not configured yet. An employer invite draft was generated but not sent.',
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
    message: 'Employer invite email sent successfully.',
    messageId: info.messageId,
  }
}
