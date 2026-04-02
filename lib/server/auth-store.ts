import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import path from 'path'

import {
  deleteCloudDocument,
  findCloudDocument,
  getCloudDocumentById,
  listCloudDocuments,
  putCloudDocument,
  readLocalJsonFile,
  withCloudBaseFallback,
  writeLocalJsonFile,
} from '@/lib/server/cloudbase'
import type {
  AppUser,
  AuthSession,
  PasswordResetCode,
  RegistrationVerificationCode,
  StoredUser,
  UserRole,
  UserPreferences,
} from '@/types/auth'

const DATA_DIR = path.join(process.cwd(), 'data', 'auth')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json')
const RESET_CODES_FILE = path.join(DATA_DIR, 'reset-codes.json')
const REGISTRATION_CODES_FILE = path.join(DATA_DIR, 'registration-codes.json')

const USERS_COLLECTION = 'auth_users'
const SESSIONS_COLLECTION = 'auth_sessions'
const RESET_CODES_COLLECTION = 'auth_reset_codes'
const REGISTRATION_CODES_COLLECTION = 'auth_registration_codes'
const CODE_RESEND_COOLDOWN_MS = 1000 * 60

function defaultPreferences(role: UserRole): UserPreferences {
  return {
    industries: ['Technology', 'AI/ML'],
    locations: role === 'recruiter' ? ['China'] : ['Remote'],
    experienceLevel: role === 'recruiter' ? 'Hiring team' : '0-2 years',
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function toPublicUser(user: StoredUser): AppUser {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...publicUser } = user
  return publicUser
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const derivedKey = scryptSync(password, salt, 64).toString('hex')
  return { passwordHash: derivedKey, passwordSalt: salt }
}

function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actualHash = scryptSync(password, salt, 64)
  const expectedBuffer = Buffer.from(expectedHash, 'hex')

  if (actualHash.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(actualHash, expectedBuffer)
}

function isExpired(isoTimestamp: string) {
  return new Date(isoTimestamp).getTime() <= Date.now()
}

function sortByCreatedAtDescending<T extends { createdAt: string }>(records: T[]) {
  return [...records].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

function getRemainingCooldownSeconds(createdAt: string) {
  const availableAt = new Date(createdAt).getTime() + CODE_RESEND_COOLDOWN_MS
  return Math.max(1, Math.ceil((availableAt - Date.now()) / 1000))
}

function ensureCodeRequestCooldown(record: { createdAt: string } | null) {
  if (!record) {
    return
  }

  const createdAt = new Date(record.createdAt).getTime()

  if (createdAt + CODE_RESEND_COOLDOWN_MS <= Date.now()) {
    return
  }

  throw new Error(
    `Please wait ${getRemainingCooldownSeconds(record.createdAt)} seconds before requesting another verification code.`
  )
}

async function readUsers() {
  return readLocalJsonFile<StoredUser[]>(USERS_FILE, [])
}

async function writeUsers(users: StoredUser[]) {
  await writeLocalJsonFile(USERS_FILE, users)
}

async function readSessions() {
  const sessions = await readLocalJsonFile<AuthSession[]>(SESSIONS_FILE, [])
  const activeSessions = sessions.filter((session) => !isExpired(session.expiresAt))

  if (activeSessions.length !== sessions.length) {
    await writeLocalJsonFile(SESSIONS_FILE, activeSessions)
  }

  return activeSessions
}

async function writeSessions(sessions: AuthSession[]) {
  await writeLocalJsonFile(SESSIONS_FILE, sessions)
}

async function readResetCodes() {
  const resetCodes = await readLocalJsonFile<PasswordResetCode[]>(RESET_CODES_FILE, [])
  const activeCodes = resetCodes.filter((record) => !isExpired(record.expiresAt))

  if (activeCodes.length !== resetCodes.length) {
    await writeLocalJsonFile(RESET_CODES_FILE, activeCodes)
  }

  return activeCodes
}

async function writeResetCodes(resetCodes: PasswordResetCode[]) {
  await writeLocalJsonFile(RESET_CODES_FILE, resetCodes)
}

async function readRegistrationCodes() {
  const registrationCodes = await readLocalJsonFile<RegistrationVerificationCode[]>(
    REGISTRATION_CODES_FILE,
    []
  )
  const activeCodes = registrationCodes.filter((record) => !isExpired(record.expiresAt))

  if (activeCodes.length !== registrationCodes.length) {
    await writeLocalJsonFile(REGISTRATION_CODES_FILE, activeCodes)
  }

  return activeCodes
}

async function writeRegistrationCodes(registrationCodes: RegistrationVerificationCode[]) {
  await writeLocalJsonFile(REGISTRATION_CODES_FILE, registrationCodes)
}

async function getCloudUserByEmail(email: string) {
  return findCloudDocument<StoredUser>(USERS_COLLECTION, {
    where: { email: normalizeEmail(email) },
  })
}

async function getCloudSessionByToken(token: string) {
  const session = await getCloudDocumentById<AuthSession>(SESSIONS_COLLECTION, token)

  if (!session) {
    return null
  }

  if (isExpired(session.expiresAt)) {
    await deleteCloudDocument(SESSIONS_COLLECTION, token)
    return null
  }

  return session
}

async function getCloudResetCodeByEmail(email: string) {
  const records = sortByCreatedAtDescending(
    await listCloudDocuments<PasswordResetCode>(RESET_CODES_COLLECTION, {
      where: { email: normalizeEmail(email) },
    })
  )

  const activeRecords: PasswordResetCode[] = []

  for (const record of records) {
    if (isExpired(record.expiresAt)) {
      await deleteCloudDocument(RESET_CODES_COLLECTION, record.id)
      continue
    }

    activeRecords.push(record)
  }

  const [latestRecord, ...staleRecords] = activeRecords

  for (const record of staleRecords) {
    await deleteCloudDocument(RESET_CODES_COLLECTION, record.id)
  }

  return latestRecord ?? null
}

async function getCloudRegistrationCodeByEmail(email: string) {
  const records = sortByCreatedAtDescending(
    await listCloudDocuments<RegistrationVerificationCode>(REGISTRATION_CODES_COLLECTION, {
      where: { email: normalizeEmail(email) },
    })
  )

  const activeRecords: RegistrationVerificationCode[] = []

  for (const record of records) {
    if (isExpired(record.expiresAt)) {
      await deleteCloudDocument(REGISTRATION_CODES_COLLECTION, record.id)
      continue
    }

    activeRecords.push(record)
  }

  const [latestRecord, ...staleRecords] = activeRecords

  for (const record of staleRecords) {
    await deleteCloudDocument(REGISTRATION_CODES_COLLECTION, record.id)
  }

  return latestRecord ?? null
}

export async function getUserByEmail(email: string) {
  return withCloudBaseFallback(
    'getUserByEmail',
    async () => getCloudUserByEmail(email),
    async () => {
      const users = await readUsers()
      return users.find((user) => user.email === normalizeEmail(email)) ?? null
    }
  )
}

export async function getUserById(id: string) {
  return withCloudBaseFallback(
    'getUserById',
    async () => getCloudDocumentById<StoredUser>(USERS_COLLECTION, id),
    async () => {
      const users = await readUsers()
      return users.find((user) => user.id === id) ?? null
    }
  )
}

export async function createUser(input: {
  email: string
  password: string
  name: string
  role?: Extract<UserRole, 'candidate' | 'recruiter'>
}) {
  const normalizedEmail = normalizeEmail(input.email)
  const createdAt = new Date().toISOString()
  const { passwordHash, passwordSalt } = hashPassword(input.password)
  const role = input.role === 'recruiter' ? 'recruiter' : 'candidate'
  const user: StoredUser = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    name: input.name.trim(),
    role,
    plan: 'free',
    billingStatus: 'inactive',
    preferences: defaultPreferences(role),
    createdAt,
    passwordHash,
    passwordSalt,
  }

  return withCloudBaseFallback(
    'createUser',
    async () => {
      const existing = await getCloudUserByEmail(normalizedEmail)

      if (existing) {
        throw new Error('An account with this email already exists.')
      }

      await putCloudDocument(USERS_COLLECTION, user.id, user)
      return toPublicUser(user)
    },
    async () => {
      const users = await readUsers()
      const existing = users.find((storedUser) => storedUser.email === normalizedEmail)

      if (existing) {
        throw new Error('An account with this email already exists.')
      }

      users.unshift(user)
      await writeUsers(users)
      return toPublicUser(user)
    }
  )
}

export async function authenticateUser(email: string, password: string) {
  const user = await getUserByEmail(email)

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return null
  }

  return toPublicUser(user)
}

export async function createSession(userId: string) {
  const createdAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
  const session: AuthSession = {
    token: randomBytes(32).toString('hex'),
    userId,
    createdAt,
    expiresAt,
  }

  await withCloudBaseFallback(
    'createSession',
    async () => {
      await putCloudDocument(SESSIONS_COLLECTION, session.token, session)
    },
    async () => {
      const sessions = await readSessions()
      sessions.unshift(session)
      await writeSessions(sessions)
    }
  )

  return session
}

export async function getSessionUser(token: string) {
  return withCloudBaseFallback(
    'getSessionUser',
    async () => {
      const session = await getCloudSessionByToken(token)

      if (!session) {
        return null
      }

      const user = await getCloudDocumentById<StoredUser>(USERS_COLLECTION, session.userId)
      return user ? toPublicUser(user) : null
    },
    async () => {
      const sessions = await readSessions()
      const session = sessions.find((item) => item.token === token)

      if (!session) {
        return null
      }

      const users = await readUsers()
      const user = users.find((item) => item.id === session.userId)
      return user ? toPublicUser(user) : null
    }
  )
}

export async function deleteSession(token: string) {
  await withCloudBaseFallback(
    'deleteSession',
    async () => {
      await deleteCloudDocument(SESSIONS_COLLECTION, token)
    },
    async () => {
      const sessions = await readSessions()
      const nextSessions = sessions.filter((session) => session.token !== token)
      await writeSessions(nextSessions)
    }
  )
}

export async function updateUser(userId: string, updater: (user: StoredUser) => StoredUser) {
  return withCloudBaseFallback(
    'updateUser',
    async () => {
      const existing = await getCloudDocumentById<StoredUser>(USERS_COLLECTION, userId)

      if (!existing) {
        return null
      }

      const nextUser = updater(existing)
      await putCloudDocument(USERS_COLLECTION, userId, nextUser)
      return toPublicUser(nextUser)
    },
    async () => {
      const users = await readUsers()
      const index = users.findIndex((user) => user.id === userId)

      if (index === -1) {
        return null
      }

      users[index] = updater(users[index])
      await writeUsers(users)

      return toPublicUser(users[index])
    }
  )
}

export async function createPasswordResetCode(email: string) {
  const normalizedEmail = normalizeEmail(email)
  const code = `${Math.floor(100000 + Math.random() * 900000)}`
  const { passwordHash: codeHash, passwordSalt: codeSalt } = hashPassword(code)
  const record: PasswordResetCode = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    codeHash,
    codeSalt,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
  }

  await withCloudBaseFallback(
    'createPasswordResetCode',
    async () => {
      const existingRecords = await listCloudDocuments<PasswordResetCode>(RESET_CODES_COLLECTION, {
        where: { email: normalizedEmail },
      })
      const latestRecord = sortByCreatedAtDescending(existingRecords)[0] ?? null
      ensureCodeRequestCooldown(latestRecord)

      for (const existingRecord of existingRecords) {
        await deleteCloudDocument(RESET_CODES_COLLECTION, existingRecord.id)
      }

      await putCloudDocument(RESET_CODES_COLLECTION, record.id, record)
    },
    async () => {
      const resetCodes = await readResetCodes()
      const latestRecord =
        sortByCreatedAtDescending(resetCodes.filter((item) => item.email === normalizedEmail))[0] ??
        null
      ensureCodeRequestCooldown(latestRecord)
      const nextCodes = resetCodes.filter((item) => item.email !== normalizedEmail)
      nextCodes.unshift(record)
      await writeResetCodes(nextCodes)
    }
  )

  return {
    record,
    code,
  }
}

export async function createRegistrationVerificationCode(email: string) {
  const normalizedEmail = normalizeEmail(email)
  const existingUser = await getUserByEmail(normalizedEmail)

  if (existingUser) {
    throw new Error('An account with this email already exists.')
  }

  const code = `${Math.floor(100000 + Math.random() * 900000)}`
  const { passwordHash: codeHash, passwordSalt: codeSalt } = hashPassword(code)
  const record: RegistrationVerificationCode = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    codeHash,
    codeSalt,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
  }

  await withCloudBaseFallback(
    'createRegistrationVerificationCode',
    async () => {
      const existingRecords = await listCloudDocuments<RegistrationVerificationCode>(
        REGISTRATION_CODES_COLLECTION,
        {
          where: { email: normalizedEmail },
        }
      )
      const latestRecord = sortByCreatedAtDescending(existingRecords)[0] ?? null
      ensureCodeRequestCooldown(latestRecord)

      for (const existingRecord of existingRecords) {
        await deleteCloudDocument(REGISTRATION_CODES_COLLECTION, existingRecord.id)
      }

      await putCloudDocument(REGISTRATION_CODES_COLLECTION, record.id, record)
    },
    async () => {
      const registrationCodes = await readRegistrationCodes()
      const latestRecord =
        sortByCreatedAtDescending(
          registrationCodes.filter((item) => item.email === normalizedEmail)
        )[0] ?? null
      ensureCodeRequestCooldown(latestRecord)
      const nextCodes = registrationCodes.filter((item) => item.email !== normalizedEmail)
      nextCodes.unshift(record)
      await writeRegistrationCodes(nextCodes)
    }
  )

  return {
    record,
    code,
  }
}

export async function verifyRegistrationCode(email: string, code: string) {
  const normalizedEmail = normalizeEmail(email)

  return withCloudBaseFallback(
    'verifyRegistrationCode',
    async () => {
      const registrationCode = await getCloudRegistrationCodeByEmail(normalizedEmail)

      if (
        !registrationCode ||
        !verifyPassword(code, registrationCode.codeSalt, registrationCode.codeHash)
      ) {
        return null
      }

      return registrationCode
    },
    async () => {
      const registrationCodes = await readRegistrationCodes()
      const registrationCode = registrationCodes.find((item) => item.email === normalizedEmail)

      if (
        !registrationCode ||
        !verifyPassword(code, registrationCode.codeSalt, registrationCode.codeHash)
      ) {
        return null
      }

      return registrationCode
    }
  )
}

export async function deleteRegistrationVerificationCode(id: string) {
  await withCloudBaseFallback(
    'deleteRegistrationVerificationCode',
    async () => {
      await deleteCloudDocument(REGISTRATION_CODES_COLLECTION, id)
    },
    async () => {
      const registrationCodes = await readRegistrationCodes()
      const nextCodes = registrationCodes.filter((item) => item.id !== id)
      await writeRegistrationCodes(nextCodes)
    }
  )
}

export async function resetPasswordWithCode(email: string, code: string, newPassword: string) {
  const normalizedEmail = normalizeEmail(email)

  return withCloudBaseFallback(
    'resetPasswordWithCode',
    async () => {
      const resetCode = await getCloudResetCodeByEmail(normalizedEmail)

      if (!resetCode || !verifyPassword(code, resetCode.codeSalt, resetCode.codeHash)) {
        return null
      }

      const user = await getCloudUserByEmail(normalizedEmail)

      if (!user) {
        return null
      }

      const { passwordHash, passwordSalt } = hashPassword(newPassword)
      const nextUser: StoredUser = {
        ...user,
        passwordHash,
        passwordSalt,
      }

      await putCloudDocument(USERS_COLLECTION, user.id, nextUser)
      await deleteCloudDocument(RESET_CODES_COLLECTION, resetCode.id)

      return toPublicUser(nextUser)
    },
    async () => {
      const resetCodes = await readResetCodes()
      const resetCode = resetCodes.find((item) => item.email === normalizedEmail)

      if (!resetCode || !verifyPassword(code, resetCode.codeSalt, resetCode.codeHash)) {
        return null
      }

      const users = await readUsers()
      const userIndex = users.findIndex((user) => user.email === normalizedEmail)

      if (userIndex === -1) {
        return null
      }

      const { passwordHash, passwordSalt } = hashPassword(newPassword)
      users[userIndex] = {
        ...users[userIndex],
        passwordHash,
        passwordSalt,
      }

      await writeUsers(users)
      await writeResetCodes(resetCodes.filter((item) => item.id !== resetCode.id))

      return toPublicUser(users[userIndex])
    }
  )
}
