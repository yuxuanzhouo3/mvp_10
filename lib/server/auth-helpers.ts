import { getSessionUser } from '@/lib/server/auth-store'
import { verifyAuthToken } from '@/lib/server/jwt'

export async function requireAuthenticatedUser(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null

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
