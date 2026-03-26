import path from 'path'

import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

import { normalizeResumeContactInfo } from '@/lib/resume-contact'
import type {
  ResumeAnalysisResult,
  ResumeCompositionItem,
  ResumeContactInfo,
  ResumeInsight,
  ResumeProfile,
  ResumeSkillAnalysis,
} from '@/types/resume'

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

function extractYearsExperience(text: string) {
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
  const candidatePool = inExperienceContext.length > 0 ? inExperienceContext : yearMatches
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
    { name: 'Technical Skills', value: values[0], color: COMPOSITION_COLORS[0] },
    { name: 'Experience', value: values[1], color: COMPOSITION_COLORS[1] },
    { name: 'Education', value: values[2], color: COMPOSITION_COLORS[2] },
    { name: 'Projects', value: values[3], color: COMPOSITION_COLORS[3] },
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

function buildInsights(contact: ResumeContactInfo, profile: ResumeProfile, textLength: number) {
  const insights: ResumeInsight[] = []

  if (contact.email && contact.phone) {
    insights.push({
      type: 'strength',
      title: 'Contact information is complete',
      description: 'The resume includes both email and phone, which makes follow-up easier.',
      priority: 'high',
    })
  }

  if (profile.skills.length >= 5) {
    insights.push({
      type: 'strength',
      title: 'Skills section is rich enough for matching',
      description: `Detected ${profile.skills.length} market-relevant skills that can feed recommendation and screening.`,
      priority: 'high',
    })
  }

  if (profile.yearsExperience && profile.yearsExperience >= 3) {
    insights.push({
      type: 'strength',
      title: 'Work history looks credible',
      description: `The resume shows roughly ${profile.yearsExperience} years of experience, enough for role matching.`,
      priority: 'medium',
    })
  }

  if (!contact.email || !contact.phone) {
    insights.push({
      type: 'warning',
      title: 'Critical contact field is missing',
      description: 'Email or phone could not be extracted confidently. You may need manual review before outreach.',
      priority: 'high',
    })
  }

  if (profile.education.length === 0) {
    insights.push({
      type: 'improvement',
      title: 'Education details are weak or absent',
      description: 'Adding degree, school, or certification details would make background checks and fit analysis clearer.',
      priority: 'medium',
    })
  }

  if (profile.skills.length < 4) {
    insights.push({
      type: 'improvement',
      title: 'Skill keywords could be expanded',
      description: 'The resume has limited structured skill keywords, which may reduce match quality in automated screening.',
      priority: 'medium',
    })
  }

  if (textLength < 350) {
    insights.push({
      type: 'warning',
      title: 'Resume content looks too short',
      description: 'The extracted text is brief, so parsing confidence and downstream AI analysis may be limited.',
      priority: 'medium',
    })
  }

  if (!contact.name && !contact.location && profile.skills.length <= 1) {
    insights.push({
      type: 'warning',
      title: 'OCR extraction may be noisy',
      description: 'Few structured fields were recognized. Manually verify core profile details before screening.',
      priority: 'high',
    })
  }

  if (profile.yearsExperience !== null && profile.yearsExperience >= 20) {
    insights.push({
      type: 'warning',
      title: 'Experience estimate may need manual review',
      description: 'Detected years are unusually high for a resume. Confirm date parsing before making hiring decisions.',
      priority: 'medium',
    })
  }

  return insights.slice(0, 5)
}

function buildSummary(contact: ResumeContactInfo, profile: ResumeProfile, score: number) {
  const title = profile.currentTitle ?? 'candidate'
  const experienceText = profile.yearsExperience
    ? `about ${profile.yearsExperience} years of experience`
    : 'an unclear amount of experience'
  const skillsText = profile.skills.length > 0 ? profile.skills.slice(0, 4).join(', ') : 'limited explicit skill keywords'
  const contactText = [contact.email, contact.phone].filter(Boolean).length >= 2 ? 'complete contact details' : 'partial contact details'

  return `${title} resume parsed with ${contactText}, ${experienceText}, and key skills including ${skillsText}. Current readiness score is ${score}/100.`
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
    yearsExperience: extractYearsExperience(text),
    skills: extractSkills(text),
    education: extractEducation(lines),
    highlights: extractHighlights(lines),
  }

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
    skillAnalysis: buildSkillAnalysis(profile.skills, profile.yearsExperience),
    insights: buildInsights(contact, profile, text.length),
    composition,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

async function generateOpenAIAnalysis(
  text: string,
  fallback: ResumeAnalysisResult
): Promise<ResumeAnalysisResult | null> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return null
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RESUME_MODEL || 'gpt-5',
      store: false,
      input: [
        {
          role: 'system',
          content:
            'You analyze resumes for recruiting workflows. Extract only evidence grounded in the resume text. Do not infer protected traits or make hiring decisions. Return concise JSON only.',
        },
        {
          role: 'user',
          content: `Analyze this resume text for intake and screening:\n\n${text.slice(0, 12000)}`,
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
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`)
  }

  const payload = (await response.json()) as unknown
  const outputText = extractOutputText(payload)

  if (!outputText) {
    throw new Error('OpenAI response did not include structured output text')
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
      yearsExperience:
        typeof profileValue.yearsExperience === 'number'
          ? clamp(Math.round(profileValue.yearsExperience), 0, 35)
          : fallback.profile.yearsExperience,
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
    throw new Error('This MVP currently supports PDF, DOCX, TXT, and MD resume parsing. Convert DOC to DOCX or PDF first.')
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

  try {
    const openAIAnalysis = await generateOpenAIAnalysis(text, fallback)
    return openAIAnalysis ?? fallback
  } catch (error) {
    console.error('Falling back to heuristic resume analysis:', error)
    return fallback
  }
}
