import { getSessionUser } from '@/lib/server/auth-store'
import { verifyAuthToken } from '@/lib/server/jwt'
import type { AppUser, UserRole } from '@/types/auth'

const AUTH_ERROR_MESSAGES = new Set([
  'Authentication token is missing.',
  'Session is invalid or expired.',
])

const PERMISSION_ERROR_MESSAGE = 'User does not have permission.'

function getCookieValue(cookieHeader: string, key: string) {
  const pairs = cookieHeader.split(';')

  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.trim().split('=')

    if (rawKey === key) {
      return rest.join('=')
    }
  }

  return null
}

export async function requireAuthenticatedUser(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const cookieHeader = request.headers.get('cookie') ?? ''
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : null
  const cookieToken =
    getCookieValue(cookieHeader, 'auth_token') || getCookieValue(cookieHeader, 'auth-token')
  const token = bearerToken || cookieToken

  if (!token) {
    throw new Error('Authentication token is missing.')
  }

  const { sessionToken } = await verifyAuthToken(token)
  const user = await getSessionUser(sessionToken)

  if (!user) {
    throw new Error('Session is invalid or expired.')
  }

  return { user, token, sessionToken }
}

export function isAuthErrorMessage(message: string) {
  return AUTH_ERROR_MESSAGES.has(message)
}

export function isPermissionErrorMessage(message: string) {
  return message === PERMISSION_ERROR_MESSAGE
}

export function hasUserRole(user: AppUser, roles: UserRole[]) {
  return roles.includes(user.role)
}

export async function requireUserRoles(request: Request, roles: UserRole[]) {
  const auth = await requireAuthenticatedUser(request)

  if (!hasUserRole(auth.user, roles)) {
    throw new Error(PERMISSION_ERROR_MESSAGE)
  }

  return auth
}
