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
  const platformName = process.env.PLATFORM_NAME || '招聘平台'
  const schedulerUrl = process.env.INTERVIEW_SCHEDULING_URL
  const supportEmail = process.env.RECRUITING_SUPPORT_EMAIL || process.env.SMTP_FROM || 'recruiting@example.com'
  const candidateName = record.contact.name || '同学'
  const subject = `${platformName}：我们已收到你的简历`

  const intro = `${candidateName}，你好：`
  const lines = [
    intro,
    '',
    `感谢你向 ${platformName} 投递简历。我们已经成功收到你的信息，招聘团队会尽快完成初步查看。`,
    '',
    '接下来会发生什么：',
    '- 我们会审核你的背景信息和简历提取结果。',
    '- 如果你的资料与当前岗位匹配，我们会尽快联系你进入下一步。',
    '- 如果你的联系方式有更新，也可以直接回复这封邮件告诉我们。',
  ]

  if (schedulerUrl) {
    lines.push('', `如果你希望更快推进，也可以通过下面的链接预约沟通时间：${schedulerUrl}`)
  }

  lines.push(...buildContactOptionTextLines())
  lines.push('', `如有问题，欢迎直接回复这封邮件，或联系 ${supportEmail}。`, '', '此致', `${platformName} 招聘团队`)

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
    throw new Error('发送回执邮件前需要先填写候选人邮箱。')
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
      message: '当前未配置 SMTP，已生成回执邮件预览稿，但尚未真正发送。',
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
    message: '回执邮件发送成功。',
    messageId: info.messageId,
  }
}
