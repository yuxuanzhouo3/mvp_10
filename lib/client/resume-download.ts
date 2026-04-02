interface ResumeDownloadInput {
  resumeId: string
  fileName: string
  token: string | null
}

export async function downloadResumeOriginalFile({ resumeId, fileName, token }: ResumeDownloadInput) {
  if (!token) {
    throw new Error('Please sign in again before downloading the resume.')
  }

  const response = await fetch(`/api/resumes/${resumeId}/file`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const contentType = response.headers.get('content-type') ?? ''

  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { error?: string }
      throw new Error(payload.error || 'Failed to download the original resume file.')
    }

    throw new Error('Failed to download the original resume file.')
  }

  const blob = await response.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000)
}
