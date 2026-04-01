function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface AuthEmailTemplateOptions {
  title: string
  intro: string
  codeLabel: string
  code: string
  footerNotice: string
}

export function buildAuthEmailTemplate(options: AuthEmailTemplateOptions) {
  const platformName = process.env.PLATFORM_NAME || 'MornJob'
  const supportEmail =
    process.env.RECRUITING_SUPPORT_EMAIL ||
    process.env.RESEND_REPLY_TO ||
    process.env.SMTP_REPLY_TO ||
    process.env.RESEND_FROM ||
    process.env.SMTP_FROM ||
    'support@example.com'

  const textLines = [
    `${platformName}`,
    '',
    options.title,
    options.intro,
    '',
    `${options.codeLabel}：${options.code}`,
    '有效时间：10 分钟',
    '',
    options.footerNotice,
    `如需帮助，请联系：${supportEmail}`,
  ]

  const html = `
    <div style="margin:0;padding:32px 16px;background:#eef4ff;font-family:'PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.10);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f172a 0%,#2563eb 100%);color:#ffffff;">
          <div style="font-size:14px;letter-spacing:0.08em;opacity:0.82;text-transform:uppercase;">${escapeHtml(platformName)}</div>
          <h1 style="margin:14px 0 0;font-size:28px;line-height:1.25;font-weight:700;">${escapeHtml(options.title)}</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.8;color:#334155;">${escapeHtml(options.intro)}</p>
          <div style="margin:28px 0;padding:22px 24px;border-radius:20px;background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border:1px solid #bfdbfe;">
            <div style="font-size:13px;color:#1d4ed8;letter-spacing:0.06em;text-transform:uppercase;">${escapeHtml(options.codeLabel)}</div>
            <div style="margin-top:12px;font-size:34px;line-height:1;font-weight:800;letter-spacing:0.28em;color:#0f172a;">${escapeHtml(options.code)}</div>
          </div>
          <div style="padding:16px 18px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;color:#475569;font-size:14px;line-height:1.8;">
            <div>验证码 10 分钟内有效，请尽快完成操作。</div>
            <div>${escapeHtml(options.footerNotice)}</div>
          </div>
        </div>
        <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:1.8;">
          如需帮助，请联系 ${escapeHtml(supportEmail)}
        </div>
      </div>
    </div>
  `.trim()

  return {
    text: textLines.join('\n'),
    html,
  }
}
