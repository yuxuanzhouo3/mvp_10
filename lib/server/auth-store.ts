import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

import type {
  AppUser,
  AuthSession,
  PasswordResetCode,
  StoredUser,
  UserPreferences,
} from '@/types/auth'

const DATA_DIR = path.join(process.cwd(), 'data', 'auth')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json')
const RESET_CODES_FILE = path.join(DATA_DIR, 'reset-codes.json')

function defaultPreferences(): UserPreferences {
  return {
    industries: ['Technology', 'AI/ML'],
    locations: ['Remote'],
    experienceLevel: '0-2 years',
  }
}

function toPublicUser(user: StoredUser): AppUser {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...publicUser } = user
  return publicUser
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback
    }

    throw error
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await ensureStore()
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
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

async function readUsers() {
  const users = await readJsonFile<StoredUser[]>(USERS_FILE, [])
  return users
}

async function writeUsers(users: StoredUser[]) {
  await writeJsonFile(USERS_FILE, users)
}

async function readSessions() {
  const sessions = await readJsonFile<AuthSession[]>(SESSIONS_FILE, [])
  const now = Date.now()
  const activeSessions = sessions.filter((session) => new Date(session.expiresAt).getTime() > now)

  if (activeSessions.length !== sessions.length) {
    await writeJsonFile(SESSIONS_FILE, activeSessions)
  }

  return activeSessions
}

async function writeSessions(sessions: AuthSession[]) {
  await writeJsonFile(SESSIONS_FILE, sessions)
}

async function readResetCodes() {
  const resetCodes = await readJsonFile<PasswordResetCode[]>(RESET_CODES_FILE, [])
  const now = Date.now()
  const activeCodes = resetCodes.filter((record) => new Date(record.expiresAt).getTime() > now)

  if (activeCodes.length !== resetCodes.length) {
    await writeJsonFile(RESET_CODES_FILE, activeCodes)
  }

  return activeCodes
}

async function writeResetCodes(resetCodes: PasswordResetCode[]) {
  await writeJsonFile(RESET_CODES_FILE, resetCodes)
}

export async function getUserByEmail(email: string) {
  const users = await readUsers()
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null
}

export async function getUserById(id: string) {
  const users = await readUsers()
  return users.find((user) => user.id === id) ?? null
}

export async function createUser(input: { email: string; password: string; name: string }) {
  const users = await readUsers()
  const existing = users.find((user) => user.email.toLowerCase() === input.email.toLowerCase())

  if (existing) {
    throw new Error('An account with this email already exists.')
  }

  const createdAt = new Date().toISOString()
  const { passwordHash, passwordSalt } = hashPassword(input.password)
  const user: StoredUser = {
    id: crypto.randomUUID(),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    role: 'candidate',
    plan: 'free',
    billingStatus: 'inactive',
    preferences: defaultPreferences(),
    createdAt,
    passwordHash,
    passwordSalt,
  }

  users.unshift(user)
  await writeUsers(users)

  return toPublicUser(user)
}

export async function authenticateUser(email: string, password: string) {
  const user = await getUserByEmail(email)

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return null
  }

  return toPublicUser(user)
}

export async function createSession(userId: string) {
  const sessions = await readSessions()
  const createdAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
  const session: AuthSession = {
    token: randomBytes(32).toString('hex'),
    userId,
    createdAt,
    expiresAt,
  }

  sessions.unshift(session)
  await writeSessions(sessions)

  return session
}

export async function getSessionUser(token: string) {
  const sessions = await readSessions()
  const session = sessions.find((item) => item.token === token)

  if (!session) {
    return null
  }

  const user = await getUserById(session.userId)
  return user ? toPublicUser(user) : null
}

export async function deleteSession(token: string) {
  const sessions = await readSessions()
  const nextSessions = sessions.filter((session) => session.token !== token)
  await writeSessions(nextSessions)
}

export async function updateUser(
  userId: string,
  updater: (user: StoredUser) => StoredUser
) {
  const users = await readUsers()
  const index = users.findIndex((user) => user.id === userId)

  if (index === -1) {
    return null
  }

  users[index] = updater(users[index])
  await writeUsers(users)

  return toPublicUser(users[index])
}

export async function createPasswordResetCode(email: string) {
  const code = `${Math.floor(100000 + Math.random() * 900000)}`
  const resetCodes = await readResetCodes()
  const { passwordHash: codeHash, passwordSalt: codeSalt } = hashPassword(code)
  const record: PasswordResetCode = {
    id: crypto.randomUUID(),
    email: email.trim().toLowerCase(),
    codeHash,
    codeSalt,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
  }

  const nextCodes = resetCodes.filter((item) => item.email !== record.email)
  nextCodes.unshift(record)
  await writeResetCodes(nextCodes)

  return {
    record,
    code,
  }
}

export async function resetPasswordWithCode(email: string, code: string, newPassword: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const resetCodes = await readResetCodes()
  const resetCode = resetCodes.find((item) => item.email === normalizedEmail)

  if (!resetCode || !verifyPassword(code, resetCode.codeSalt, resetCode.codeHash)) {
    return null
  }

  const users = await readUsers()
  const userIndex = users.findIndex((user) => user.email.toLowerCase() === normalizedEmail)

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
