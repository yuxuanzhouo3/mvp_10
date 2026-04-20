import { buildContactOptionHtml, buildContactOptionTextLines } from '@/lib/server/contact-options'
import { createMailTransport, getDefaultMailDeliveryConfig, getDefaultSupportEmail } from '@/lib/server/mail-config'
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
  const platformName = process.env.PLATFORM_NAME || '招聘平台'
  const schedulerUrl = process.env.INTERVIEW_SCHEDULING_URL
  const supportEmail = getDefaultSupportEmail()
  const candidateName = record.contact.name || '同学'
  const subject = `${platformName}：面试邀请`

  const lines = [
    `${candidateName}，你好：`,
    '',
    `感谢你对 ${platformName} 的关注，我们希望邀请你进入下一轮面试沟通。`,
    '',
    '下一步安排如下：',
    '- 请选择一个合适的时间段，或直接回复你的可用时间。',
    '- 如果你更习惯即时沟通，也可以通过自愿联系渠道和我们对接。',
    '- 如果你的联系方式有变化，直接回复这封邮件即可，我们会同步更新资料。',
  ]

  if (schedulerUrl) {
    lines.push('', `面试预约链接：${schedulerUrl}`)
  } else {
    lines.push('', '如果当前没有预约链接，也可以直接回复几个可选时间，我们会协助安排面试。')
  }

  lines.push(...buildContactOptionTextLines())
  lines.push(
    '',
    '面试过程中我们会结合你的简历摘要和测评结果进行沟通，因此无需重复发送材料。',
    '',
    `如有问题，欢迎直接回复这封邮件，或联系 ${supportEmail}。`,
    '',
    '此致',
    `${platformName} 招聘团队`
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
    throw new Error('发送面试邀请前需要先填写候选人邮箱。')
  }

  const { subject, text, html } = buildInterviewInviteContent(record)

  const config = getDefaultMailDeliveryConfig()

  if (!config) {
    return {
      mode: 'preview',
      subject,
      text,
      html,
      message: '当前未配置 SMTP，已生成面试邀请预览稿，但尚未真正发送。',
    }
  }

  const transporter = createMailTransport(config)

  const info = await transporter.sendMail({
    from: config.from,
    to: record.contact.email,
    replyTo: config.replyTo,
    subject,
    text,
    html,
  })

  return {
    mode: 'smtp',
    subject,
    text,
    html,
    message: '面试邀请发送成功。',
    messageId: info.messageId,
  }
}
