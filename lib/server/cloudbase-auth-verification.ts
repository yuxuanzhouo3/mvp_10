import { randomInt } from 'crypto'

const DEFAULT_EXPIRES_IN_SECONDS = 600

interface CloudBaseSendVerificationResponse {
  verification_id?: unknown
  expires_in?: unknown
  is_user?: unknown
}

interface CloudBaseVerifyVerificationResponse {
  verification_token?: unknown
  expires_in?: unknown
}

interface CloudBaseErrorResponse {
  error?: unknown
  message?: unknown
  error_description?: unknown
}

export class CloudBaseAuthVerificationError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'CloudBaseAuthVerificationError'
    this.code = code
    this.status = status
  }
}

function trimEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function isCloudBaseAuthConfigured() {
  return Boolean(
    trimEnvValue(process.env.CLOUDBASE_AUTH_BASE_URL) ||
      trimEnvValue(process.env.CLOUDBASE_ENV_ID)
  )
}

export function createLocalVerificationCode() {
  return randomInt(0, 1000000).toString().padStart(6, '0')
}

function getCloudBaseAuthBaseUrl() {
  const override = trimEnvValue(process.env.CLOUDBASE_AUTH_BASE_URL)

  if (override) {
    return override.replace(/\/+$/, '')
  }

  const envId = trimEnvValue(process.env.CLOUDBASE_ENV_ID)

  if (!envId) {
    throw new Error('CLOUDBASE_ENV_ID is not configured.')
  }

  return `https://${envId}.api.tcloudbasegateway.com`
}

function getCloudBaseAuthClientId() {
  return trimEnvValue(process.env.CLOUDBASE_AUTH_CLIENT_ID) || trimEnvValue(process.env.CLOUDBASE_ENV_ID)
}

function normalizeErrorMessage(payload: CloudBaseErrorResponse, status: number) {
  if (typeof payload.error_description === 'string' && payload.error_description.trim()) {
    return payload.error_description.trim()
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim()
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim()
  }

  return `CloudBase auth verification request failed with status ${status}.`
}

async function postToCloudBaseAuth<TResponse>(path: string, body: Record<string, unknown>) {
  const clientId = getCloudBaseAuthClientId()
  const response = await fetch(`${getCloudBaseAuthBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...body,
      ...(clientId ? { client_id: clientId } : {}),
    }),
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => ({}))) as TResponse & CloudBaseErrorResponse

  if (!response.ok) {
    const code =
      typeof payload.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : 'cloudbase_auth_verification_failed'

    throw new CloudBaseAuthVerificationError(
      normalizeErrorMessage(payload, response.status),
      code,
      response.status
    )
  }

  return payload
}

export function isCloudBaseAuthVerificationError(error: unknown): error is CloudBaseAuthVerificationError {
  return error instanceof CloudBaseAuthVerificationError
}

export async function sendCloudBaseEmailVerification(email: string) {
  const response = await postToCloudBaseAuth<CloudBaseSendVerificationResponse>(
    '/auth/v1/verification',
    {
      email,
      target: 'ANY',
    }
  )

  if (typeof response.verification_id !== 'string' || !response.verification_id) {
    throw new Error('CloudBase did not return a verification_id.')
  }

  return {
    verificationId: response.verification_id,
    expiresIn:
      typeof response.expires_in === 'number' && Number.isFinite(response.expires_in)
        ? response.expires_in
        : DEFAULT_EXPIRES_IN_SECONDS,
    isUser: typeof response.is_user === 'boolean' ? response.is_user : null,
  }
}

export async function verifyCloudBaseEmailVerificationCode(
  verificationId: string,
  verificationCode: string
) {
  const response = await postToCloudBaseAuth<CloudBaseVerifyVerificationResponse>(
    '/auth/v1/verification/verify',
    {
      verification_id: verificationId,
      verification_code: verificationCode,
    }
  )

  if (typeof response.verification_token !== 'string' || !response.verification_token) {
    throw new Error('CloudBase did not return a verification_token.')
  }

  return {
    verificationToken: response.verification_token,
    expiresIn:
      typeof response.expires_in === 'number' && Number.isFinite(response.expires_in)
        ? response.expires_in
        : DEFAULT_EXPIRES_IN_SECONDS,
  }
}
