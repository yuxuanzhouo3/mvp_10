function extractTranscriptText(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  if ('text' in payload && typeof payload.text === 'string' && payload.text.trim()) {
    return payload.text.trim()
  }

  return null
}

export async function transcribeAssessmentAudio(file: File) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OpenAI transcription is not configured. Please set OPENAI_API_KEY first.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`OpenAI transcription failed with ${response.status}: ${detail || 'unknown error'}`)
  }

  const payload = (await response.json()) as unknown
  const transcript = extractTranscriptText(payload)

  if (!transcript) {
    throw new Error('Transcription completed but no transcript text was returned.')
  }

  return transcript
}
