export interface RecruitingContactOption {
  label: string
  value: string
}

export function getRecruitingContactOptions() {
  const options: RecruitingContactOption[] = []

  if (process.env.RECRUITING_WECHAT_HINT) {
    options.push({
      label: 'WeChat',
      value: process.env.RECRUITING_WECHAT_HINT,
    })
  }

  if (process.env.RECRUITING_FEISHU_HINT) {
    options.push({
      label: 'Feishu',
      value: process.env.RECRUITING_FEISHU_HINT,
    })
  }

  if (process.env.RECRUITING_WHATSAPP_URL) {
    options.push({
      label: 'WhatsApp',
      value: process.env.RECRUITING_WHATSAPP_URL,
    })
  }

  if (process.env.RECRUITING_LINKEDIN_URL) {
    options.push({
      label: 'LinkedIn',
      value: process.env.RECRUITING_LINKEDIN_URL,
    })
  }

  return options
}

export function buildContactOptionTextLines() {
  const options = getRecruitingContactOptions()

  if (options.length === 0) {
    return []
  }

  return [
    'If you prefer a faster response, you can also reach us through these opt-in channels:',
    ...options.map((option) => `- ${option.label}: ${option.value}`),
  ]
}

export function buildContactOptionHtml(options = getRecruitingContactOptions()) {
  if (options.length === 0) {
    return ''
  }

  const listItems = options
    .map((option) => `<li><strong>${option.label}:</strong> ${option.value}</li>`)
    .join('')

  return `
    <p>If you prefer a faster response, you can also reach us through these opt-in channels:</p>
    <ul>${listItems}</ul>
  `.trim()
}
