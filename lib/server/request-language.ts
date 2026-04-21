import { LANGUAGE_STORAGE_KEY, type Language } from '@/lib/i18n'

function normalizeLanguage(value: string | null | undefined): Language | null {
  const normalized = value?.trim().toLowerCase()

  if (!normalized) {
    return null
  }

  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en'
  }

  if (normalized === 'zh' || normalized.startsWith('zh-')) {
    return 'zh'
  }

  return null
}

function readCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null
  }

  for (const entry of cookieHeader.split(';')) {
    const [rawKey, ...rest] = entry.trim().split('=')

    if (rawKey !== name || rest.length === 0) {
      continue
    }

    try {
      return decodeURIComponent(rest.join('='))
    } catch {
      return rest.join('=')
    }
  }

  return null
}

export function resolveRequestLanguage(request: Request): Language {
  const headerLanguage = normalizeLanguage(request.headers.get('x-language'))
  if (headerLanguage) {
    return headerLanguage
  }

  const cookieLanguage = normalizeLanguage(
    readCookieValue(request.headers.get('cookie'), LANGUAGE_STORAGE_KEY)
  )
  if (cookieLanguage) {
    return cookieLanguage
  }

  const acceptLanguage = request.headers.get('accept-language')
  if (acceptLanguage) {
    for (const entry of acceptLanguage.split(',')) {
      const candidate = normalizeLanguage(entry.split(';')[0])
      if (candidate) {
        return candidate
      }
    }
  }

  return 'zh'
}
