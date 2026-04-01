import { buildAuthEmailTemplate } from '@/lib/server/auth-email-template'
import { deliverEmail, type EmailDeliveryResult } from '@/lib/server/email-delivery'

export type RegistrationVerificationDeliveryResult = EmailDeliveryResult

function buildRegistrationVerificationContent(email: string, code: string) {
  const platformName = process.env.PLATFORM_NAME || 'JobSearch Platform'
  const subject = `${platformName} 注册验证码`
  const { text, html } = buildAuthEmailTemplate({
    title: '邮箱注册验证码',
    intro: `欢迎注册 ${platformName}。请输入下方验证码，完成 ${email} 的邮箱验证。`,
    codeLabel: '注册验证码',
    code,
    footerNotice: '如果你没有发起注册，无需做任何处理。',
  })

  return { subject, text, html }
}

export async function sendRegistrationVerificationEmail(
  email: string,
  code: string
): Promise<RegistrationVerificationDeliveryResult> {
  const { subject, text, html } = buildRegistrationVerificationContent(email, code)

  return deliverEmail({
    to: email,
    subject,
    text,
    html,
  })
}
