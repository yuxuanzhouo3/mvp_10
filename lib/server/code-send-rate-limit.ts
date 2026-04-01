import path from 'path'

import { readLocalJsonFile, writeLocalJsonFile } from '@/lib/server/cloudbase'

const DATA_DIR = path.join(process.cwd(), 'data', 'auth')
const RATE_LIMIT_FILE = path.join(DATA_DIR, 'code-send-rate-limits.json')
const RATE_LIMIT_WINDOW_MS = 1000 * 60
const RATE_LIMIT_RETENTION_MS = 1000 * 60 * 60 * 24

interface VerificationSendRecord {
  key: string
  email: string
  purpose: 'register' | 'reset-password'
  requestedAt: string
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function buildKey(purpose: VerificationSendRecord['purpose'], email: string) {
  return `${purpose}:${normalizeEmail(email)}`
}

async function readRateLimits() {
  const records = await readLocalJsonFile<VerificationSendRecord[]>(RATE_LIMIT_FILE, [])
  const activeRecords = records.filter((record) => {
    return new Date(record.requestedAt).getTime() + RATE_LIMIT_RETENTION_MS > Date.now()
  })

  if (activeRecords.length !== records.length) {
    await writeLocalJsonFile(RATE_LIMIT_FILE, activeRecords)
  }

  return activeRecords
}

export async function assertCodeSendAllowed(
  purpose: VerificationSendRecord['purpose'],
  email: string
) {
  const records = await readRateLimits()
  const existingRecord = records.find((record) => record.key === buildKey(purpose, email))

  if (!existingRecord) {
    return
  }

  const retryAfterMs =
    new Date(existingRecord.requestedAt).getTime() + RATE_LIMIT_WINDOW_MS - Date.now()

  if (retryAfterMs <= 0) {
    return
  }

  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))
  throw new Error(
    `Please wait ${retryAfterSeconds} seconds before requesting another verification code.`
  )
}

export async function recordCodeSend(
  purpose: VerificationSendRecord['purpose'],
  email: string
) {
  const records = await readRateLimits()
  const key = buildKey(purpose, email)
  const nextRecords = records.filter((record) => record.key !== key)

  nextRecords.unshift({
    key,
    email: normalizeEmail(email),
    purpose,
    requestedAt: new Date().toISOString(),
  })

  await writeLocalJsonFile(RATE_LIMIT_FILE, nextRecords)
}
