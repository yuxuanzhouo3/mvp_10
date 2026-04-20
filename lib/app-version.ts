export type AppEdition = 'cn' | 'global'
export type RemoteDataProvider = 'cloudbase' | 'supabase'

function normalizeFlag(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase()
  return trimmed ? trimmed : null
}

export function isCnEdition() {
  const normalized = normalizeFlag(process.env.CN ?? process.env.NEXT_PUBLIC_CN)

  if (!normalized) {
    return true
  }

  if (['0', 'false', 'no', 'off', 'global', 'intl', 'international'].includes(normalized)) {
    return false
  }

  return true
}

export function getAppEdition(): AppEdition {
  return isCnEdition() ? 'cn' : 'global'
}

export function getRemoteDataProvider(): RemoteDataProvider {
  return isCnEdition() ? 'cloudbase' : 'supabase'
}

export function isWechatPayEnabled() {
  return isCnEdition()
}
