import { getSessionUser } from '@/lib/server/auth-store'

export async function requireAuthenticatedUser(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null

  if (!token) {
    throw new Error('Authentication token is missing.')
  }

  const user = await getSessionUser(token)

  if (!user) {
    throw new Error('Session is invalid or expired.')
  }

  return { user, token }
}
