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
    '如果你希望更快获得回复，也可以通过以下自愿联系渠道和我们沟通：',
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
    <p>如果你希望更快获得回复，也可以通过以下自愿联系渠道和我们沟通：</p>
    <ul>${listItems}</ul>
  `.trim()
}
