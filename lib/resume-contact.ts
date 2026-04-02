import type { ResumeContactInfo } from '@/types/resume'
import { normalizeCityLocation } from '@/lib/location'

const GENDER_SEGMENT_PATTERN =
  /(?:^|[\s,;|/])(?:gender|sex|性别|鎬у埆)\s*[:：]?\s*(?:male|female|man|woman|男|女)\s*/gi
const LOCATION_LABEL_PATTERN =
  /(?:籍贯|location|city|address|所在地|工作地点|期望城市|鍩庡競|鍦板潃)\s*[:：]?\s*/gi
const LOCATION_VALUE_PATTERN =
  /(?:籍贯|location|city|address|所在地|工作地点|期望城市|鍩庡競|鍦板潃)\s*[:：]?\s*([^\n,;|]+)/i

function normalizeNullableString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function sanitizeResumeLocation(value: string | null | undefined) {
  const raw = normalizeNullableString(value)

  if (!raw) {
    return null
  }

  const labeledLocation = raw.match(LOCATION_VALUE_PATTERN)?.[1]?.trim()
  if (labeledLocation) {
    return normalizeCityLocation(labeledLocation)
  }

  const withoutGender = raw.replace(GENDER_SEGMENT_PATTERN, ' ')
  const normalized = withoutGender
    .replace(LOCATION_LABEL_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return normalizeCityLocation(normalized || null)
}

export function normalizeResumeContactInfo(
  contact: Partial<ResumeContactInfo> | null | undefined
): ResumeContactInfo {
  return {
    name: normalizeNullableString(contact?.name),
    email: normalizeNullableString(contact?.email),
    phone: normalizeNullableString(contact?.phone),
    location: sanitizeResumeLocation(contact?.location),
  }
}
