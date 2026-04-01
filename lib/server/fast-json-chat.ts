import {
  getOpenAIChatCompletionsUrl,
  shouldDisableThinkingByDefault,
} from '@/lib/server/openai-config'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface FetchJsonChatOptions {
  apiKey: string
  model: string
  messages: ChatMessage[]
  timeoutMs: number
  timeoutLabel: string
  temperature?: number
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractChatCompletionText(payload: unknown) {
  if (!isObject(payload) || !Array.isArray(payload.choices)) {
    return null
  }

  for (const choice of payload.choices) {
    if (!isObject(choice) || !isObject(choice.message)) {
      continue
    }

    const message = choice.message

    if (typeof message.content === 'string' && message.content.trim()) {
      return message.content.trim()
    }

    if (!Array.isArray(message.content)) {
      continue
    }

    const parts = message.content
      .filter((item): item is Record<string, unknown> => isObject(item))
      .map((item) => {
        if (typeof item.text === 'string') {
          return item.text
        }

        if (item.type === 'text' && typeof item.content === 'string') {
          return item.content
        }

        return ''
      })
      .filter(Boolean)

    if (parts.length > 0) {
      return parts.join('\n').trim()
    }
  }

  return null
}

export async function fetchJsonObjectFromChat({
  apiKey,
  model,
  messages,
  timeoutMs,
  timeoutLabel,
  temperature = 0.2,
}: FetchJsonChatOptions) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
      response_format: {
        type: 'json_object',
      },
    }

    if (shouldDisableThinkingByDefault(model)) {
      body.enable_thinking = false
    }

    const response = await fetch(getOpenAIChatCompletionsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Chat completions request failed with ${response.status}`)
    }

    const payload = (await response.json()) as unknown
    const text = extractChatCompletionText(payload)

    if (!text) {
      return null
    }

    return JSON.parse(text) as Record<string, unknown>
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${timeoutLabel}超时，已回退到本地规则`)
    }

    throw error
  } finally {
    clearTimeout(timer)
  }
}
