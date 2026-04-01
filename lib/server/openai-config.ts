const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_DASHSCOPE_RESPONSES_BASE_URL =
  'https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1'
const DEFAULT_DASHSCOPE_CHAT_COMPLETIONS_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DASHSCOPE_RESPONSES_PATH = '/api/v2/apps/protocols/compatible-mode/v1'
const DASHSCOPE_CHAT_COMPLETIONS_PATH = '/compatible-mode/v1'

function trimEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function stripTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '')
}

function stripKnownApiSuffixes(value: string) {
  return stripTrailingSlashes(value)
    .replace(/\/responses$/i, '')
    .replace(/\/audio\/transcriptions$/i, '')
    .replace(/\/chat\/completions$/i, '')
}

export function isDashScopeBaseUrl(value: string) {
  return /\/\/[^/]*dashscope[^/]*\.aliyuncs\.com/i.test(value)
}

function normalizeDashScopeBaseUrl(value: string, targetPath: string) {
  try {
    const url = new URL(stripKnownApiSuffixes(value))
    return `${url.origin}${targetPath}`
  } catch {
    return stripKnownApiSuffixes(value)
  }
}

function getConfiguredBaseUrl() {
  return (
    trimEnvValue(process.env.OPENAI_BASE_URL) ||
    trimEnvValue(process.env.OPENAI_API_BASE_URL) ||
    trimEnvValue(process.env.DASHSCOPE_BASE_URL) ||
    ''
  )
}

export function shouldPreferDashScope() {
  return Boolean(trimEnvValue(process.env.DASHSCOPE_API_KEY)) || isDashScopeBaseUrl(getConfiguredBaseUrl())
}

function normalizeConfiguredResponsesBaseUrl(value: string) {
  const normalized = stripKnownApiSuffixes(value.trim())

  if (!normalized) {
    return shouldPreferDashScope()
      ? DEFAULT_DASHSCOPE_RESPONSES_BASE_URL
      : DEFAULT_OPENAI_BASE_URL
  }

  if (isDashScopeBaseUrl(normalized)) {
    return normalizeDashScopeBaseUrl(normalized, DASHSCOPE_RESPONSES_PATH)
  }

  return normalized
}

function normalizeConfiguredChatCompletionsBaseUrl(value: string) {
  const normalized = stripKnownApiSuffixes(value.trim())

  if (!normalized) {
    return shouldPreferDashScope()
      ? DEFAULT_DASHSCOPE_CHAT_COMPLETIONS_BASE_URL
      : DEFAULT_OPENAI_BASE_URL
  }

  if (isDashScopeBaseUrl(normalized)) {
    return normalizeDashScopeBaseUrl(normalized, DASHSCOPE_CHAT_COMPLETIONS_PATH)
  }

  return normalized
}

export function getProviderApiKey() {
  const openAiKey = trimEnvValue(process.env.OPENAI_API_KEY)
  const dashScopeKey = trimEnvValue(process.env.DASHSCOPE_API_KEY)

  return shouldPreferDashScope() ? dashScopeKey || openAiKey : openAiKey || dashScopeKey
}

export function getDefaultTextModel() {
  return shouldPreferDashScope() ? 'qwen3.5-plus' : 'gpt-5'
}

export function getDefaultFastTextModel() {
  return shouldPreferDashScope() ? 'qwen-turbo' : getDefaultTextModel()
}

export function getOpenAIBaseUrl() {
  return normalizeConfiguredResponsesBaseUrl(getConfiguredBaseUrl())
}

export function getOpenAIChatCompletionsBaseUrl() {
  return normalizeConfiguredChatCompletionsBaseUrl(getConfiguredBaseUrl())
}

export function getOpenAIUrl(path: string, baseUrl = getOpenAIBaseUrl()) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

export function getOpenAIResponsesUrl() {
  return getOpenAIUrl('/responses', getOpenAIBaseUrl())
}

export function getOpenAIChatCompletionsUrl() {
  return getOpenAIUrl('/chat/completions', getOpenAIChatCompletionsBaseUrl())
}

export function shouldDisableThinkingByDefault(model: string) {
  return shouldPreferDashScope() && /qwen/i.test(model)
}
