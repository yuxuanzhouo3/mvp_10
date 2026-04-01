import { buildAuthEmailTemplate } from '@/lib/server/auth-email-template'
import { deliverEmail, type EmailDeliveryResult } from '@/lib/server/email-delivery'

export type PasswordResetDeliveryResult = EmailDeliveryResult

function buildPasswordResetContent(email: string, code: string) {
  const platformName = process.env.PLATFORM_NAME || 'JobSearch Platform'
  const subject = `${platformName} 重置密码验证码`
  const { text, html } = buildAuthEmailTemplate({
    title: '重置密码验证码',
    intro: `我们收到了 ${email} 的密码重置请求。请输入下方验证码以继续完成重置。`,
    codeLabel: '重置验证码',
    code,
    footerNotice: '如果这不是你本人操作，可以直接忽略这封邮件。',
  })

  return { subject, text, html }
}

export async function sendPasswordResetEmail(
  email: string,
  code: string
): Promise<PasswordResetDeliveryResult> {
  const { subject, text, html } = buildPasswordResetContent(email, code)

  return deliverEmail({
    to: email,
    subject,
    text,
    html,
  })
}
