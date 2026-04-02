import path from 'path'

import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

import { fetchJsonObjectFromChat } from '@/lib/server/fast-json-chat'
import {
  getDefaultFastTextModel,
  getDefaultTextModel,
  getProviderApiKey,
  getOpenAIUrl,
  shouldPreferDashScope,
} from '@/lib/server/openai-config'
import { normalizeResumeContactInfo } from '@/lib/resume-contact'
import type {
  ResumeAnalysisResult,
  ResumeCompositionItem,
  ResumeContactInfo,
  ResumeInsight,
  ResumeProfile,
  ResumeSkillAnalysis,
} from '@/types/resume'

const RESUME_ANALYSIS_TIMEOUT_MS = 7000
const DASHSCOPE_RESUME_ANALYSIS_TIMEOUT_MS = 5000

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const PHONE_PATTERN =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}/
const CN_MOBILE_PATTERN = /(?:\+?86[\s-]?)?1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/
const SECTION_HEADING_PATTERN =
  /^(summary|profile|experience|work experience|employment|education|skills|projects|certifications|self evaluation|about me|个人简介|个人优势|教育背景|教育经历|工作经历|项目经历|技能|专业技能|荣誉奖项|校园经历|自我评价)$/i
const FIELD_LABEL_PREFIX_PATTERN =
  /^(?:name|full name|candidate|email|e-mail|mail|phone|mobile|tel|telephone|location|city|address|skills?|education|experience|summary|profile|姓名|名字|邮箱|电子邮箱|电话|手机|联系方式|地址|所在地|工作地点|城市|技能|教育背景|教育经历|工作经历|个人简介|个人优势)\s*[:：-]?\s*/i
const NAME_LABEL_PATTERN = /^(?:name|full name|candidate|姓名|名字)\s*[:：-]?\s*/i
const EMAIL_LABEL_PATTERN = /^(?:email|e-mail|mail|邮箱|电子邮箱|联系邮箱)\s*[:：-]?\s*/i
const PHONE_LABEL_PATTERN = /^(?:phone|mobile|tel|telephone|联系方式|联系电话|电话|手机)\s*[:：-]?\s*/i
const LOCATION_LABEL_PATTERN = /^(?:location|city|based in|address|地址|所在地|工作地点|城市|期望城市)\s*[:：-]?\s*/i
const LOCATION_HINT_PATTERN =
  /(remote|hybrid|onsite|china|beijing|shanghai|shenzhen|guangzhou|hangzhou|nanjing|suzhou|chengdu|wuhan|xian|tianjin|chongqing|changsha|qingdao|xiamen|hefei|zhengzhou|foshan|dongguan|ningbo|wuxi|fuzhou|jinan|zhuhai|dalian|shenyang|nanning|北京|上海|深圳|广州|杭州|南京|苏州|成都|武汉|西安|天津|重庆|长沙|青岛|厦门|合肥|郑州|佛山|东莞|宁波|无锡|福州|济南|珠海|大连|沈阳|南宁)/i
const CHINESE_REGION_SUFFIX_PATTERN = /[\u4e00-\u9fa5]{2,}(?:省|市|区|县|州|自治区|特别行政区)/
const EXPERIENCE_CONTEXT_PATTERN =
  /(experience|employment|work|intern|project|career|工作经历|实习经历|项目经历|任职|公司|岗位|职责)/i
const BIRTH_CONTEXT_PATTERN = /(born|birth|dob|出生|出生年月|生日)/i
const WORK_SECTION_HEADING_PATTERN =
  /^(?:work experience|experience|employment|internship|intern experience|工作经历|实习经历|任职经历|职业经历)$/i
const NON_WORK_SECTION_HEADING_PATTERN =
  /^(?:education|education background|education history|projects|project experience|skills|certifications|summary|profile|about me|self evaluation|校园经历|教育背景|教育经历|项目经历|专业技能|技能|荣誉奖项|校园活动|社团经历|自我评价|个人简介|个人优势)$/i
const EXPLICIT_EXPERIENCE_PATTERN =
  /(?:约|近|超过|至少|累计|拥有|具备)?\s*(\d{1,2})(?:\s*\+)?\s*(?:年|years?)(?:以上)?(?:[^。\n]{0,12})(?:工作经验|经验|从业经验|开发经验|测试经验|运营经验|经验积累)/i
const DATE_RANGE_PATTERN =
  /((?:19|20)\d{2})(?:[./年-]?\s*(0?[1-9]|1[0-2]))?\s*(?:月)?\s*(?:-|–|—|~|～|至|到)\s*(((?:19|20)\d{2})(?:[./年-]?\s*(0?[1-9]|1[0-2]))?\s*(?:月)?|至今|现在|current|present)/gi

const SKILL_DEMAND: Record<string, number> = {
  Python: 92,
  JavaScript: 88,
  TypeScript: 85,
  React: 84,
  'Next.js': 78,
  'Node.js': 80,
  SQL: 82,
  Java: 76,
  Go: 74,
  AWS: 83,
  Azure: 79,
  Docker: 77,
  Kubernetes: 75,
  'Machine Learning': 90,
  'Deep Learning': 87,
  NLP: 81,
  'Data Analysis': 78,
  Tableau: 68,
  Excel: 66,
  'Product Management': 72,
  Figma: 63,
}
const SKILL_ALIASES: Record<string, string[]> = {
  Python: ['python', 'py'],
  JavaScript: ['javascript', 'js', 'ecmascript'],
  TypeScript: ['typescript', 'ts'],
  React: ['react', 'reactjs'],
  'Next.js': ['next.js', 'nextjs'],
  'Node.js': ['node.js', 'nodejs'],
  SQL: ['sql', 'mysql', 'postgres', 'postgresql', 'database', '数据库'],
  Java: ['java'],
  Go: ['go', 'golang'],
  AWS: ['aws', 'amazon web services'],
  Azure: ['azure'],
  Docker: ['docker', '容器'],
  Kubernetes: ['kubernetes', 'k8s'],
  'Machine Learning': ['machine learning', 'ml', '机器学习'],
  'Deep Learning': ['deep learning', 'dl', '深度学习'],
  NLP: ['nlp', 'natural language processing', '自然语言处理'],
  'Data Analysis': ['data analysis', 'analytics', '数据分析'],
  Tableau: ['tableau'],
  Excel: ['excel'],
  'Product Management': ['product management', 'product manager', '产品经理'],
  Figma: ['figma'],
}

const SKILL_NEIGHBOR_SUGGESTIONS: Record<string, string[]> = {
  Python: ['FastAPI', 'Pandas', 'NumPy'],
  Java: ['Spring Boot', 'MySQL', 'Redis'],
  SQL: ['MySQL', 'PostgreSQL', '数据建模'],
  React: ['TypeScript', 'Next.js', '组件设计'],
  'Next.js': ['TypeScript', 'Node.js', 'SSR'],
  JavaScript: ['TypeScript', 'React', 'Node.js'],
  TypeScript: ['React', 'Next.js', '接口建模'],
  'Node.js': ['Express', 'NestJS', 'REST API'],
  Docker: ['Kubernetes', 'CI/CD', 'Linux'],
  Kubernetes: ['Docker', 'Helm', '云原生部署'],
  AWS: ['云服务部署', '监控告警', '成本优化'],
  Azure: ['云服务部署', 'DevOps', '资源治理'],
  'Machine Learning': ['模型评估', '特征工程', '实验设计'],
  'Deep Learning': ['PyTorch', '模型训练', '推理优化'],
  NLP: ['Prompt Engineering', '文本清洗', '向量检索'],
  'Data Analysis': ['Excel', 'Tableau', '业务分析'],
}

const TITLE_KEYWORDS = [
  'software engineer',
  'frontend engineer',
  'backend engineer',
  'full stack engineer',
  'data scientist',
  'machine learning engineer',
  'ai engineer',
  'product manager',
  'designer',
  'marketing manager',
  'operations manager',
  'sales manager',
  'research engineer',
  'devops engineer',
]

const COMPOSITION_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function dedupe(values: string[]) {
  return Array.from(new Set(values))
}

function shouldUseAiResumeAnalysis() {
  return process.env.ENABLE_AI_RESUME_ANALYSIS?.trim() === '1'
}

function trimEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function getResumeAnalysisModel() {
  return (
    trimEnvValue(process.env.OPENAI_RESUME_ANALYSIS_MODEL) ||
    (shouldPreferDashScope() ? getDefaultFastTextModel() : null) ||
    trimEnvValue(process.env.OPENAI_RESUME_MODEL) ||
    getDefaultTextModel()
  )
}

function normalizeFullWidthChars(text: string) {
  return text
    .replace(/[\uFF01-\uFF5E]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/g, ' ')
}

function normalizeOcrNoise(text: string) {
  return text
    .replace(/[•·●▪■◆◇◦]/g, ' ')
    .replace(/[¦｜]/g, '|')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[，、；]/g, ',')
    .replace(/[：]/g, ':')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[【]/g, '[')
    .replace(/[】]/g, ']')
}

function normalizeEmailCandidate(value: string) {
  return value
    .replace(/\(at\)|\[at\]/gi, '@')
    .replace(/\s+at\s+/gi, '@')
    .replace(/\(dot\)|\[dot\]/gi, '.')
    .replace(/\s+dot\s+/gi, '.')
    .replace(/\s+/g, '')
}

function stripFieldLabelPrefix(value: string) {
  return value.replace(FIELD_LABEL_PREFIX_PATTERN, '').trim()
}

function extractByLabel(lines: string[], pattern: RegExp) {
  for (const line of lines.slice(0, 24)) {
    if (!pattern.test(line)) {
      continue
    }

    const candidate = line.replace(pattern, '').trim()
    if (candidate) {
      return candidate
    }
  }

  return null
}

function cleanText(text: string) {
  return normalizeOcrNoise(normalizeFullWidthChars(text))
    .replace(/\u0000/g, '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[^\S\r\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()
}

function titleCase(text: string) {
  return text
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function normalizePhone(phone: string | null) {
  if (!phone) {
    return null
  }

  const digits = phone.replace(/[^\d+]/g, '')
  return digits.length >= 8 ? digits : null
}

function extractEmail(text: string, lines: string[]) {
  const labeled = extractByLabel(lines, EMAIL_LABEL_PATTERN)
  if (labeled) {
    const normalizedLabeled = normalizeEmailCandidate(labeled)
    const emailFromLabel = normalizedLabeled.match(EMAIL_PATTERN)?.[0] ?? null
    if (emailFromLabel) {
      return emailFromLabel.toLowerCase()
    }
  }

  const normalizedText = normalizeEmailCandidate(text)
  return normalizedText.match(EMAIL_PATTERN)?.[0]?.toLowerCase() ?? null
}

function extractPhone(text: string, lines: string[]) {
  const labeled = extractByLabel(lines, PHONE_LABEL_PATTERN)
  const source = [labeled ?? '', text].filter(Boolean).join('\n')
  const mobile = source.match(CN_MOBILE_PATTERN)?.[0] ?? null

  if (mobile) {
    return normalizePhone(mobile)
  }

  return normalizePhone(source.match(PHONE_PATTERN)?.[0] ?? null)
}

function isLikelyName(line: string) {
  if (line.length < 2 || line.length > 60) {
    return false
  }

  if (EMAIL_PATTERN.test(line) || PHONE_PATTERN.test(line)) {
    return false
  }

  if (SECTION_HEADING_PATTERN.test(line)) {
    return false
  }

  if (/\d{3,}/.test(line) || /https?:\/\//i.test(line) || /linkedin|github/i.test(line)) {
    return false
  }

  return /^[A-Za-z\u4e00-\u9fa5 .'-]+$/.test(line)
}

function extractName(lines: string[]) {
  const labeled = extractByLabel(lines, NAME_LABEL_PATTERN)
  if (labeled && isLikelyName(labeled)) {
    return labeled
  }

  const candidate = lines
    .slice(0, 20)
    .map((line) => stripFieldLabelPrefix(line))
    .find((line) => isLikelyName(line))

  return candidate ?? null
}

function extractCurrentTitle(lines: string[]) {
  const titleLine = lines
    .slice(0, 24)
    .find((line) => /^(position|title|role|求职意向|职位|岗位)\s*[:：-]?\s*/i.test(line))

  if (titleLine) {
    const labeledTitle = stripFieldLabelPrefix(titleLine)
    if (labeledTitle) {
      return labeledTitle
    }
  }

  const normalizedLines = lines.slice(0, 20)

  for (const line of normalizedLines) {
    const lower = line.toLowerCase()
    const exactMatch = TITLE_KEYWORDS.find((keyword) => lower.includes(keyword))

    if (exactMatch) {
      return titleCase(exactMatch)
    }
  }

  const fallback = normalizedLines.find((line) => {
    if (line.length < 4 || line.length > 80) {
      return false
    }

    if (SECTION_HEADING_PATTERN.test(line)) {
      return false
    }

    return /(engineer|manager|designer|scientist|developer|consultant|specialist|analyst|工程师|开发|经理|分析师|产品经理|设计师|测试|运维|算法|数据科学|研究员)/i.test(line)
  })

  return fallback ?? null
}

function isLikelyLocation(line: string) {
  if (!line) {
    return false
  }

  if (EMAIL_PATTERN.test(line) || PHONE_PATTERN.test(line)) {
    return false
  }

  if (/linkedin|github|portfolio/i.test(line)) {
    return false
  }

  return (
    /remote|[A-Za-z\u4e00-\u9fa5]+,\s*[A-Za-z\u4e00-\u9fa5]+/i.test(line) ||
    LOCATION_HINT_PATTERN.test(line) ||
    CHINESE_REGION_SUFFIX_PATTERN.test(line)
  )
}

function extractLocation(lines: string[]) {
  const labeledLocation = extractByLabel(lines, LOCATION_LABEL_PATTERN)
  if (labeledLocation && isLikelyLocation(labeledLocation)) {
    return labeledLocation
  }

  const locationLine = lines
    .slice(0, 24)
    .map((line) => stripFieldLabelPrefix(line))
    .find((line) => isLikelyLocation(line))

  return locationLine ?? null
}

function extractEducation(lines: string[]) {
  return dedupe(
    lines.filter((line) =>
      /(university|college|bachelor|master|phd|mba|b\.?s\.?|m\.?s\.?|beng|meng|大学|学院|本科|硕士|博士|研究生|学士|专科|大专|教育背景|教育经历)/i.test(line)
    )
  ).slice(0, 3)
}

function extractHighlights(lines: string[]) {
  return lines
    .filter((line) => line.length > 26)
    .filter((line) => !EMAIL_PATTERN.test(line) && !PHONE_PATTERN.test(line))
    .filter((line) => !SECTION_HEADING_PATTERN.test(line))
    .map((line) => stripFieldLabelPrefix(line))
    .filter(Boolean)
    .slice(0, 3)
}

function hasNearbyContext(text: string, index: number, pattern: RegExp, span = 42) {
  const start = Math.max(0, index - span)
  const end = Math.min(text.length, index + span)
  return pattern.test(text.slice(start, end))
}

function parseWorkSectionLines(text: string) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const workLines: string[] = []
  let inWorkSection = false

  for (const line of lines) {
    const normalized = stripFieldLabelPrefix(line)

    if (WORK_SECTION_HEADING_PATTERN.test(normalized)) {
      inWorkSection = true
      continue
    }

    if (NON_WORK_SECTION_HEADING_PATTERN.test(normalized) || SECTION_HEADING_PATTERN.test(normalized)) {
      inWorkSection = false
      continue
    }

    if (inWorkSection) {
      workLines.push(normalized)
    }
  }

  return workLines
}

function addMonthRange(months: Set<number>, startYear: number, startMonth: number, endYear: number, endMonth: number) {
  const startIndex = startYear * 12 + (startMonth - 1)
  const endIndex = endYear * 12 + (endMonth - 1)

  if (endIndex < startIndex) {
    return
  }

  for (let index = startIndex; index <= endIndex; index += 1) {
    months.add(index)
  }
}

function estimateYearsFromDateRanges(text: string) {
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1
  const workLines = parseWorkSectionLines(text)

  if (workLines.length === 0) {
    return null
  }

  const months = new Set<number>()

  for (const line of workLines) {
    DATE_RANGE_PATTERN.lastIndex = 0
    let match = DATE_RANGE_PATTERN.exec(line)

    while (match) {
      const startYear = Number(match[1])
      const startMonth = match[2] ? Number(match[2]) : 1
      const endToken = match[3]
      const endYear = match[4] ? Number(match[4]) : currentYear
      const endMonth = match[5]
        ? Number(match[5])
        : /^(?:至今|现在|current|present)$/i.test(endToken)
          ? currentMonth
          : 12

      if (
        startYear < 1990 ||
        startYear > currentYear + 1 ||
        endYear < 1990 ||
        endYear > currentYear + 1 ||
        startMonth < 1 ||
        startMonth > 12 ||
        endMonth < 1 ||
        endMonth > 12
      ) {
        continue
      }

      addMonthRange(months, startYear, startMonth, endYear, endMonth)
      match = DATE_RANGE_PATTERN.exec(line)
    }
  }

  const totalMonths = months.size

  if (totalMonths < 3) {
    return null
  }

  return clamp(Math.max(1, Math.round(totalMonths / 12)), 1, 25)
}

function estimateYearsFromExplicitExperience(text: string) {
  const match = text.match(EXPLICIT_EXPERIENCE_PATTERN)

  if (!match) {
    return null
  }

  return clamp(Number(match[1]), 0, 25)
}

export function estimateYearsExperienceFromResumeText(text: string) {
  const explicitYears = estimateYearsFromExplicitExperience(text)
  if (explicitYears !== null) {
    return explicitYears
  }

  const rangedYears = estimateYearsFromDateRanges(text)
  if (rangedYears !== null) {
    return rangedYears
  }

  const currentYear = new Date().getFullYear()
  const yearMatches = Array.from(text.matchAll(/\b(19|20)\d{2}\b/g))
    .map((match) => ({
      year: Number(match[0]),
      index: match.index ?? -1,
    }))
    .filter((item) => item.year >= 1990 && item.year <= currentYear)

  if (yearMatches.length === 0) {
    return null
  }

  const inExperienceContext = yearMatches.filter((item) =>
    hasNearbyContext(text, item.index, EXPERIENCE_CONTEXT_PATTERN)
  )

  if (inExperienceContext.length === 0) {
    return null
  }

  const candidatePool = inExperienceContext
  const nonBirthYears = candidatePool.filter(
    (item) => !hasNearbyContext(text, item.index, BIRTH_CONTEXT_PATTERN)
  )
  const fallbackPool = nonBirthYears.length > 0 ? nonBirthYears : candidatePool
  const recentYears = fallbackPool.filter((item) => item.year >= currentYear - 15)
  const bestPool = recentYears.length > 0 ? recentYears : fallbackPool.filter((item) => item.year >= currentYear - 10)

  if (bestPool.length === 0) {
    return null
  }

  const startYear = Math.min(...bestPool.map((item) => item.year))
  return clamp(currentYear - startYear, 0, 25)
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasAliasToken(source: string, alias: string) {
  const normalizedAlias = alias.toLowerCase()

  if (/[\u4e00-\u9fa5]/.test(normalizedAlias)) {
    return source.includes(normalizedAlias)
  }

  const regex = new RegExp(`(^|[^a-z0-9+.#-])${escapeRegex(normalizedAlias)}([^a-z0-9+.#-]|$)`, 'i')
  return regex.test(source)
}

function extractSkills(text: string) {
  const searchableText = text.toLowerCase()
  const aliasMatchedSkills = Object.entries(SKILL_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => hasAliasToken(searchableText, alias)))
    .map(([skill]) => skill)

  const skills = aliasMatchedSkills.length > 0
    ? aliasMatchedSkills
    : Object.keys(SKILL_DEMAND).filter((skill) => {
        const regex = new RegExp(`(^|[^A-Za-z])${escapeRegex(skill)}([^A-Za-z]|$)`, 'i')
        return regex.test(text)
      })

  return skills.slice(0, 8)
}

function buildSkillAnalysis(skills: string[], yearsExperience: number | null) {
  const resolvedSkills =
    skills.length > 0 ? skills : ['Python', 'SQL', 'Communication', 'Problem Solving']

  return resolvedSkills.slice(0, 5).map((skill, index) => {
    const demand = SKILL_DEMAND[skill] ?? 70 - index * 4
    const baseLevel = skills.includes(skill) ? 58 : 30
    const levelBonus = yearsExperience ? Math.min(yearsExperience * 2, 18) : 6
    const level = clamp(baseLevel + levelBonus - index * 3, 25, 96)
    const match = clamp(Math.round(level * 0.6 + demand * 0.4), 20, 98)

    return {
      skill,
      level,
      demand,
      match,
    }
  })
}

function buildSkillFocusedHighlights(
  skills: string[],
  skillAnalysis: ResumeSkillAnalysis[],
  textHighlights: string[]
) {
  const skillHighlights = skillAnalysis
    .filter((item) => item.match >= 72 || item.level >= 68)
    .slice(0, 3)
    .map((item) => `${item.skill} 可作为当前简历里的重点能力标签`)

  if (skillHighlights.length > 0) {
    return skillHighlights
  }

  if (skills.length > 0) {
    return skills.slice(0, 3).map((skill) => `${skill} 是当前最值得前置展示的技能`)
  }

  return textHighlights.slice(0, 3)
}

function pickSkillGapSuggestions(skills: string[], skillAnalysis: ResumeSkillAnalysis[]) {
  const normalizedSkills = new Set(skills.map((item) => item.toLowerCase()))

  for (const item of skillAnalysis) {
    const suggestions = SKILL_NEIGHBOR_SUGGESTIONS[item.skill] ?? []
    const nextSkill = suggestions.find((suggestion) => !normalizedSkills.has(suggestion.toLowerCase()))
    if (nextSkill) {
      return {
        anchorSkill: item.skill,
        suggestion: nextSkill,
      }
    }
  }

  return null
}

function normalizeComposition(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0) || 1
  const normalized = values.map((value) => Math.round((value / total) * 100))
  const delta = 100 - normalized.reduce((sum, value) => sum + value, 0)

  normalized[0] += delta

  return normalized
}

function buildComposition(
  skillCount: number,
  yearsExperience: number | null,
  educationCount: number,
  projectSignal: number
): ResumeCompositionItem[] {
  const values = normalizeComposition([
    20 + skillCount * 6,
    18 + (yearsExperience ?? 0) * 3,
    12 + educationCount * 8,
    10 + projectSignal * 7,
  ])

  return [
    { name: '技术技能', value: values[0], color: COMPOSITION_COLORS[0] },
    { name: '经验经历', value: values[1], color: COMPOSITION_COLORS[1] },
    { name: '教育背景', value: values[2], color: COMPOSITION_COLORS[2] },
    { name: '项目实践', value: values[3], color: COMPOSITION_COLORS[3] },
  ]
}

function buildScore(contact: ResumeContactInfo, profile: ResumeProfile, textLength: number) {
  let score = 38

  if (contact.name) score += 8
  if (contact.email) score += 16
  if (contact.phone) score += 16
  if (contact.location) score += 6

  score += Math.min(profile.skills.length * 4, 18)
  score += profile.education.length > 0 ? 10 : 0
  score += profile.yearsExperience ? clamp(profile.yearsExperience * 2, 4, 14) : 0
  score += textLength > 800 ? 8 : textLength > 400 ? 4 : 0

  return clamp(Math.round(score), 25, 98)
}

function buildInsights(
  contact: ResumeContactInfo,
  profile: ResumeProfile,
  textLength: number,
  skillAnalysis: ResumeSkillAnalysis[]
) {
  const insights: ResumeInsight[] = []
  const topSkill = skillAnalysis[0] ?? null
  const secondSkill = skillAnalysis[1] ?? null
  const skillGap = pickSkillGapSuggestions(profile.skills, skillAnalysis)

  if (contact.email && contact.phone) {
    insights.push({
      type: 'strength',
      title: '联系方式较完整',
      description: '简历中同时包含邮箱和电话，便于后续联系与推进。',
      priority: 'high',
    })
  }

  if (profile.skills.length >= 5) {
    insights.push({
      type: 'strength',
      title: '技能标签覆盖度较好',
      description: `已识别 ${profile.skills.length} 项技能，其中 ${profile.skills.slice(0, 3).join('、')} 可以直接支撑岗位匹配与初筛判断。`,
      priority: 'high',
    })
  }

  if (topSkill && topSkill.match >= 72) {
    insights.push({
      type: 'strength',
      title: `${topSkill.skill} 是当前最强技能亮点`,
      description: `当前已识别到 ${topSkill.skill} 的匹配度较高，建议在项目经历里继续补充你如何使用 ${topSkill.skill} 落地、优化或解决问题。`,
      priority: 'high',
    })
  }

  if (secondSkill && secondSkill.match >= 70) {
    insights.push({
      type: 'strength',
      title: `${secondSkill.skill} 可以作为第二卖点`,
      description: `除了核心技能外，${secondSkill.skill} 也是当前简历里可前置展示的能力，适合写在技能栏或项目结果里。`,
      priority: 'medium',
    })
  }

  if (profile.yearsExperience && profile.yearsExperience >= 3) {
    insights.push({
      type: 'strength',
      title: '工作经历具备参考价值',
      description: `简历显示约 ${profile.yearsExperience} 年经验，足以支持岗位匹配判断。`,
      priority: 'medium',
    })
  }

  if (!contact.email || !contact.phone) {
    insights.push({
      type: 'warning',
      title: '关键联系方式缺失',
      description: '邮箱或电话未能稳定识别，建议在联系候选人前人工补全。',
      priority: 'high',
    })
  }

  if (profile.education.length === 0) {
    insights.push({
      type: 'improvement',
      title: '教育信息不足',
      description: '如果补充学校、学历或证书信息，会更有利于背景核验和岗位适配分析。',
      priority: 'medium',
    })
  }

  if (profile.skills.length < 4) {
    insights.push({
      type: 'improvement',
      title: '技能关键词可进一步补充',
      description: '当前结构化技能关键词较少，建议补充你实际使用过的语言、框架、数据库、部署工具和业务分析方法。',
      priority: 'medium',
    })
  }

  if (skillGap) {
    insights.push({
      type: 'improvement',
      title: `建议围绕 ${skillGap.anchorSkill} 补充相邻技能`,
      description: `如果你实际接触过 ${skillGap.suggestion}，建议明确写进技能栏或项目描述，这样会更容易形成完整的技术栈信号。`,
      priority: 'medium',
    })
  }

  if (topSkill) {
    insights.push({
      type: 'improvement',
      title: `把 ${topSkill.skill} 写得更“有结果”`,
      description: `不要只写会 ${topSkill.skill}，建议补充使用场景、负责内容、量化结果和技术取舍，例如性能提升、问题定位或项目交付结果。`,
      priority: 'medium',
    })
  }

  if (textLength < 350) {
    insights.push({
      type: 'warning',
      title: '简历内容偏短',
      description: '提取出的文本较少，解析置信度和后续 AI 分析效果可能都会受到影响。',
      priority: 'medium',
    })
  }

  if (!contact.name && !contact.location && profile.skills.length <= 1) {
    insights.push({
      type: 'warning',
      title: 'OCR 识别可能存在噪声',
      description: '当前识别出的结构化字段较少，建议在筛选前人工核验核心信息。',
      priority: 'high',
    })
  }

  if (profile.yearsExperience !== null && profile.yearsExperience >= 20) {
    insights.push({
      type: 'warning',
      title: '工作年限估算建议复核',
      description: '识别出的工作年限偏高，建议先确认日期解析是否准确，再继续招聘判断。',
      priority: 'medium',
    })
  }

  return insights.slice(0, 5)
}

function buildSummary(contact: ResumeContactInfo, profile: ResumeProfile, score: number) {
  const title = profile.currentTitle?.trim() || '候选人'
  const experienceText = profile.yearsExperience
    ? `约 ${profile.yearsExperience} 年工作经验`
    : '工作年限暂未明确识别'
  const skillsText = profile.skills.length > 0 ? profile.skills.slice(0, 4).join('、') : '技能关键词仍较少'
  const contactText = [contact.email, contact.phone].filter(Boolean).length >= 2 ? '联系方式较完整' : '联系方式仍需补充'

  return `${title} 的简历已完成解析，${contactText}，${experienceText}，当前识别到的重点技能包括 ${skillsText}。当前筛选就绪度为 ${score}/100。`
}

function buildHeuristicAnalysis(text: string): ResumeAnalysisResult {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const contact = normalizeResumeContactInfo({
    name: extractName(lines),
    email: extractEmail(text, lines),
    phone: extractPhone(text, lines),
    location: extractLocation(lines),
  })

  const profile: ResumeProfile = {
    currentTitle: extractCurrentTitle(lines),
    yearsExperience: estimateYearsExperienceFromResumeText(text),
    skills: extractSkills(text),
    education: extractEducation(lines),
    highlights: [],
  }

  const skillAnalysis = buildSkillAnalysis(profile.skills, profile.yearsExperience)
  profile.highlights = buildSkillFocusedHighlights(profile.skills, skillAnalysis, extractHighlights(lines))

  const projectSignal = lines.filter((line) => /(project|portfolio|case study|github|项目|作品|实战)/i.test(line)).length
  const composition = buildComposition(
    profile.skills.length,
    profile.yearsExperience,
    profile.education.length,
    projectSignal
  )
  const score = buildScore(contact, profile, text.length)

  return {
    score,
      summary: buildSummary(contact, profile, score),
      source: 'heuristic',
      contact,
      profile,
      skillAnalysis,
      insights: buildInsights(contact, profile, text.length, skillAnalysis),
      composition,
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutLabel: string
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${timeoutLabel}超时，已回退到本地规则`)
    }

    throw error
  } finally {
    clearTimeout(timer)
  }
}

function extractOutputText(payload: unknown) {
  if (!isObject(payload) || !Array.isArray(payload.output)) {
    return null
  }

  const chunks: string[] = []

  for (const item of payload.output) {
    if (!isObject(item) || !Array.isArray(item.content)) {
      continue
    }

    for (const contentItem of item.content) {
      if (!isObject(contentItem)) {
        continue
      }

      if (contentItem.type === 'output_text' && typeof contentItem.text === 'string') {
        chunks.push(contentItem.text)
      }
    }
  }

  const text = chunks.join('\n').trim()
  return text.length > 0 ? text : null
}

function coerceStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function coerceInsights(value: unknown, fallback: ResumeInsight[]) {
  if (!Array.isArray(value)) {
    return fallback
  }

  const parsed = value
    .filter((item): item is Record<string, unknown> => isObject(item))
    .map((item) => {
      const type = item.type
      const priority = item.priority

      if (
        (type !== 'strength' && type !== 'improvement' && type !== 'warning') ||
        (priority !== 'high' && priority !== 'medium' && priority !== 'low')
      ) {
        return null
      }

      if (typeof item.title !== 'string' || typeof item.description !== 'string') {
        return null
      }

      return {
        type,
        title: item.title,
        description: item.description,
        priority,
      } satisfies ResumeInsight
    })
    .filter((item): item is ResumeInsight => item !== null)

  return parsed.length > 0 ? parsed.slice(0, 5) : fallback
}

function coerceSkillAnalysis(value: unknown, fallback: ResumeSkillAnalysis[]) {
  if (!Array.isArray(value)) {
    return fallback
  }

  const parsed = value
    .filter((item): item is Record<string, unknown> => isObject(item))
    .map((item) => {
      if (
        typeof item.skill !== 'string' ||
        typeof item.level !== 'number' ||
        typeof item.demand !== 'number' ||
        typeof item.match !== 'number'
      ) {
        return null
      }

      return {
        skill: item.skill,
        level: clamp(Math.round(item.level), 0, 100),
        demand: clamp(Math.round(item.demand), 0, 100),
        match: clamp(Math.round(item.match), 0, 100),
      } satisfies ResumeSkillAnalysis
    })
    .filter((item): item is ResumeSkillAnalysis => item !== null)

  return parsed.length > 0 ? parsed.slice(0, 5) : fallback
}

function coerceComposition(value: unknown, fallback: ResumeCompositionItem[]) {
  if (!Array.isArray(value)) {
    return fallback
  }

  const parsed = value
    .filter((item): item is Record<string, unknown> => isObject(item))
    .map((item) => {
      if (typeof item.name !== 'string' || typeof item.value !== 'number') {
        return null
      }

      return {
        name: item.name,
        value: clamp(Math.round(item.value), 0, 100),
        color: typeof item.color === 'string' ? item.color : '#3b82f6',
      } satisfies ResumeCompositionItem
    })
    .filter((item): item is ResumeCompositionItem => item !== null)

  return parsed.length > 0 ? parsed.slice(0, 4) : fallback
}

function resolveYearsExperience(aiValue: unknown, fallback: number | null) {
  if (typeof aiValue !== 'number') {
    return fallback
  }

  const normalized = clamp(Math.round(aiValue), 0, 35)

  if (fallback === null) {
    return normalized
  }

  // Prefer the local parser when the model estimate is clearly out of band.
  if (Math.abs(normalized - fallback) >= 6) {
    return fallback
  }

  return normalized
}

function containsProtectedProfileSignal(text: string) {
  return /(?:\d{1,2}\s*岁|年龄|出生|birth|born|dob)/i.test(text)
}

function mentionsConflictingYearsExperience(text: string, fallbackYears: number | null) {
  if (fallbackYears === null) {
    return false
  }

  const match = text.match(/(\d{1,2})\s*(?:\+)?\s*(?:年|years?)(?:[^。\n]{0,12})(?:工作经验|实习经验|从业经验|experience)/i)

  if (!match) {
    return false
  }

  const mentionedYears = Number(match[1])
  return Number.isFinite(mentionedYears) && Math.abs(mentionedYears - fallbackYears) >= 2
}

function hasUnsafeResumeNarrative(text: string, fallbackYears: number | null) {
  return containsProtectedProfileSignal(text) || mentionsConflictingYearsExperience(text, fallbackYears)
}

async function generateDashScopeResumeEnhancement(
  fallback: ResumeAnalysisResult
): Promise<Partial<ResumeAnalysisResult> | null> {
  const apiKey = getProviderApiKey()

  if (!apiKey) {
    return null
  }

  const parsed = await fetchJsonObjectFromChat({
    apiKey,
    model: getResumeAnalysisModel(),
    timeoutMs: DASHSCOPE_RESUME_ANALYSIS_TIMEOUT_MS,
    timeoutLabel: 'AI 简历分析',
    messages: [
      {
        role: 'system',
        content:
          'You refine resume summaries for recruiting workflows. Return one JSON object only. All user-facing strings must be natural Simplified Chinese. Do not mention age, birth year, graduation year, or infer protected traits. Ground every point only in the provided structured resume data. Make strengths and improvements as skill-specific as possible, and preserve technical terms such as Java, Python, SQL, React, Spring Boot, Next.js.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'Refine the recruiter-facing summary and insights only.',
          constraints: {
            summary: '1 concise paragraph in Simplified Chinese.',
            insightsMaxItems: 4,
            highlightsMaxItems: 4,
            allowedInsightTypes: ['strength', 'improvement', 'warning'],
            allowedPriorities: ['high', 'medium', 'low'],
          },
          resume: {
            score: fallback.score,
            summary: fallback.summary,
            contact: fallback.contact,
            profile: fallback.profile,
            skillAnalysis: fallback.skillAnalysis,
            insights: fallback.insights,
            composition: fallback.composition,
          },
          output: {
            summary: 'string',
            highlights: ['string'],
            insights: [
              {
                type: 'strength | improvement | warning',
                title: 'string',
                description: 'string',
                priority: 'high | medium | low',
              },
            ],
          },
        }),
      },
    ],
  })

  if (!parsed) {
    return null
  }

  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
  const highlights = coerceStringArray(parsed.highlights).slice(0, 4)
  const insights = coerceInsights(parsed.insights, fallback.insights).slice(0, 4)

  const insightText = insights
    .map((item) => `${item.title} ${item.description}`)
    .join(' ')

  if ((summary && hasUnsafeResumeNarrative(summary, fallback.profile.yearsExperience)) || hasUnsafeResumeNarrative(insightText, fallback.profile.yearsExperience)) {
    return null
  }

  return {
    source: 'openai',
    summary: summary || fallback.summary,
    profile: {
      ...fallback.profile,
      highlights: highlights.length > 0 ? highlights : fallback.profile.highlights,
    },
    insights,
  }
}

async function generateOpenAIAnalysis(
  text: string,
  fallback: ResumeAnalysisResult
): Promise<ResumeAnalysisResult | null> {
  const apiKey = getProviderApiKey()

  if (!apiKey) {
    return null
  }

  const response = await fetchWithTimeout(getOpenAIUrl('/responses'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RESUME_MODEL || getDefaultTextModel(),
      store: false,
      input: [
        {
        role: 'system',
        content:
            'You analyze resumes for recruiting workflows. Extract only evidence grounded in the resume text. Do not infer protected traits or make hiring decisions. Return concise JSON only. All user-facing text must be natural Simplified Chinese. Preserve technical terms, company names, product names, and programming languages such as Java, Python, SQL, React, and Next.js in their original form. When estimating yearsExperience, count only actual work or internship experience. Never use birth year, age, graduation year, or school enrollment dates as work experience. Make highlights and improvement insights concrete and skill-focused whenever possible.',
        },
        {
          role: 'user',
          content: `请基于以下简历文本做候选人录入与初筛分析，只提取简历中有明确依据的信息。输出面向用户的字段时请使用自然简体中文，并保留技术名词原文。尤其是 yearsExperience 只能根据工作经历或实习经历估算，不能把出生年份、年龄、教育时间、校园经历时间直接算成工作年限：\n\n${text.slice(0, 8000)}`,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'resume_analysis',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              score: { type: 'number', minimum: 0, maximum: 100 },
              summary: { type: 'string' },
              contact: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: ['string', 'null'] },
                  email: { type: ['string', 'null'] },
                  phone: { type: ['string', 'null'] },
                  location: { type: ['string', 'null'] },
                },
                required: ['name', 'email', 'phone', 'location'],
              },
              profile: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  currentTitle: { type: ['string', 'null'] },
                  yearsExperience: { type: ['number', 'null'] },
                  skills: {
                    type: 'array',
                    items: { type: 'string' },
                    maxItems: 8,
                  },
                  education: {
                    type: 'array',
                    items: { type: 'string' },
                    maxItems: 4,
                  },
                  highlights: {
                    type: 'array',
                    items: { type: 'string' },
                    maxItems: 4,
                  },
                },
                required: ['currentTitle', 'yearsExperience', 'skills', 'education', 'highlights'],
              },
              skillAnalysis: {
                type: 'array',
                maxItems: 5,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    skill: { type: 'string' },
                    level: { type: 'number', minimum: 0, maximum: 100 },
                    demand: { type: 'number', minimum: 0, maximum: 100 },
                    match: { type: 'number', minimum: 0, maximum: 100 },
                  },
                  required: ['skill', 'level', 'demand', 'match'],
                },
              },
              insights: {
                type: 'array',
                maxItems: 5,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['strength', 'improvement', 'warning'],
                    },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    priority: {
                      type: 'string',
                      enum: ['high', 'medium', 'low'],
                    },
                  },
                  required: ['type', 'title', 'description', 'priority'],
                },
              },
              composition: {
                type: 'array',
                minItems: 4,
                maxItems: 4,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    name: { type: 'string' },
                    value: { type: 'number', minimum: 0, maximum: 100 },
                    color: { type: 'string' },
                  },
                  required: ['name', 'value', 'color'],
                },
              },
            },
            required: [
              'score',
              'summary',
              'contact',
              'profile',
              'skillAnalysis',
              'insights',
              'composition',
            ],
          },
        },
      },
    }),
  }, RESUME_ANALYSIS_TIMEOUT_MS, 'AI 简历分析')

  if (!response.ok) {
    throw new Error(`OpenAI 简历分析请求失败：${response.status}`)
  }

  const payload = (await response.json()) as unknown
  const outputText = extractOutputText(payload)

  if (!outputText) {
    throw new Error('OpenAI 简历分析未返回结构化结果')
  }

  const parsed = JSON.parse(outputText) as Record<string, unknown>

  const profileValue = isObject(parsed.profile) ? parsed.profile : {}
  const contactValue = isObject(parsed.contact) ? parsed.contact : {}

  return {
    source: 'openai',
    score:
      typeof parsed.score === 'number' ? clamp(Math.round(parsed.score), 0, 100) : fallback.score,
    summary: typeof parsed.summary === 'string' ? parsed.summary : fallback.summary,
    contact: normalizeResumeContactInfo({
      name: typeof contactValue.name === 'string' ? contactValue.name : fallback.contact.name,
      email: typeof contactValue.email === 'string' ? contactValue.email : fallback.contact.email,
      phone: typeof contactValue.phone === 'string' ? contactValue.phone : fallback.contact.phone,
      location:
        typeof contactValue.location === 'string'
          ? contactValue.location
          : fallback.contact.location,
    }),
    profile: {
      currentTitle:
        typeof profileValue.currentTitle === 'string'
          ? profileValue.currentTitle
          : fallback.profile.currentTitle,
      yearsExperience: resolveYearsExperience(profileValue.yearsExperience, fallback.profile.yearsExperience),
      skills: coerceStringArray(profileValue.skills).slice(0, 8).length
        ? coerceStringArray(profileValue.skills).slice(0, 8)
        : fallback.profile.skills,
      education: coerceStringArray(profileValue.education).slice(0, 4).length
        ? coerceStringArray(profileValue.education).slice(0, 4)
        : fallback.profile.education,
      highlights: coerceStringArray(profileValue.highlights).slice(0, 4).length
        ? coerceStringArray(profileValue.highlights).slice(0, 4)
        : fallback.profile.highlights,
    },
    skillAnalysis: coerceSkillAnalysis(parsed.skillAnalysis, fallback.skillAnalysis),
    insights: coerceInsights(parsed.insights, fallback.insights),
    composition: coerceComposition(parsed.composition, fallback.composition),
  }
}

export async function extractResumeText(buffer: Buffer, fileName: string, mimeType: string) {
  const extension = path.extname(fileName).toLowerCase()

  if (extension === '.doc' || mimeType === 'application/msword') {
    throw new Error('当前版本仅支持解析 PDF、DOCX、TXT 和 MD 简历，请先将 DOC 转为 DOCX 或 PDF。')
  }

  if (extension === '.pdf' || mimeType === 'application/pdf') {
    const pdf = await pdfParse(buffer)
    return cleanText(pdf.text)
  }

  if (
    extension === '.docx' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer })
    return cleanText(result.value)
  }

  if (extension === '.txt' || extension === '.md' || mimeType.startsWith('text/')) {
    return cleanText(buffer.toString('utf8'))
  }

  return cleanText(buffer.toString('utf8'))
}

export async function analyzeResumeText(text: string): Promise<ResumeAnalysisResult> {
  const fallback = buildHeuristicAnalysis(text)

  if (!shouldUseAiResumeAnalysis()) {
    return fallback
  }

  try {
    if (shouldPreferDashScope()) {
      const enhanced = await generateDashScopeResumeEnhancement(fallback)

      if (enhanced) {
        return {
          ...fallback,
          ...enhanced,
          profile: enhanced.profile ?? fallback.profile,
          insights: enhanced.insights ?? fallback.insights,
        }
      }
    }

    const openAIAnalysis = await generateOpenAIAnalysis(text, fallback)
    return openAIAnalysis ?? fallback
  } catch (error) {
    console.error('Falling back to heuristic resume analysis:', error)
    return fallback
  }
}
