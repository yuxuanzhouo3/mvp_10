import type { OrganizationContactInfo, OrganizationLeadSource } from '@/types/organization'

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const PHONE_PATTERN =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}/
const URL_PATTERN = /https?:\/\/[^\s]+|(?:www\.)?[A-Z0-9.-]+\.[A-Z]{2,}(?:\/[^\s]*)?/i

function cleanText(text: string) {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizePhone(phone: string | null) {
  if (!phone) {
    return null
  }

  const digits = phone.replace(/[^\d+]/g, '')
  return digits.length >= 8 ? digits : null
}

function normalizeWebsite(value: string | null) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return `https://${trimmed.replace(/^www\./i, 'www.')}`
}

function extractCompanyName(lines: string[], fallback: string | null) {
  if (fallback?.trim()) {
    return fallback.trim()
  }

  const candidate = lines.find((line) => {
    if (line.length < 2 || line.length > 80) {
      return false
    }

    if (EMAIL_PATTERN.test(line) || PHONE_PATTERN.test(line) || URL_PATTERN.test(line)) {
      return false
    }

    return !/(recruiter|hr|hiring|phone|email|contact)/i.test(line)
  })

  return candidate ?? 'Unnamed company'
}

function extractContactName(lines: string[]) {
  const line = lines.find((item) => /(recruiter|hr|talent|hiring manager|founder|ceo)/i.test(item))
  return line ?? null
}

function extractLocation(lines: string[]) {
  const line = lines.find((item) => {
    if (EMAIL_PATTERN.test(item) || PHONE_PATTERN.test(item)) {
      return false
    }

    return /remote|[A-Za-z\u4e00-\u9fa5]+,\s*[A-Za-z\u4e00-\u9fa5]+/.test(item)
  })

  return line ?? null
}

function buildSummary(
  companyName: string,
  contact: OrganizationContactInfo,
  source: OrganizationLeadSource,
  publicText: string
) {
  const channels = [contact.email ? 'email' : null, contact.phone ? 'phone' : null]
    .filter(Boolean)
    .join(' and ')
  const channelText = channels || 'limited public contact details'
  const sourceText = source === 'public_text' ? 'parsed public lead text' : 'manual entry'
  const textSignal =
    publicText.length > 240 ? 'enough public context for qualification' : 'light public context'

  return `${companyName} was added from ${sourceText} with ${channelText} and ${textSignal}.`
}

export function analyzeOrganizationLeadText(
  publicText: string,
  manualCompanyName?: string | null
) {
  const cleaned = cleanText(publicText)
  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const companyName = extractCompanyName(lines, manualCompanyName ?? null)
  const contact: OrganizationContactInfo = {
    contactName: extractContactName(lines),
    email: cleaned.match(EMAIL_PATTERN)?.[0] ?? null,
    phone: normalizePhone(cleaned.match(PHONE_PATTERN)?.[0] ?? null),
    location: extractLocation(lines),
  }
  const website = normalizeWebsite(cleaned.match(URL_PATTERN)?.[0] ?? null)

  return {
    companyName,
    website,
    contact,
    publicText: cleaned,
    summary: buildSummary(companyName, contact, 'public_text', cleaned),
  }
}

export function buildManualOrganizationLead(companyName: string) {
  const trimmedCompanyName = companyName.trim() || 'Unnamed company'
  const contact: OrganizationContactInfo = {
    contactName: null,
    email: null,
    phone: null,
    location: null,
  }

  return {
    companyName: trimmedCompanyName,
    website: null,
    contact,
    publicText: '',
    summary: buildSummary(trimmedCompanyName, contact, 'manual', ''),
  }
}
