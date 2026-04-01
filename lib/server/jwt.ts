import { jwtVerify, SignJWT } from 'jose'

const AUTH_JWT_ALGORITHM = 'HS256'
const AUTH_JWT_ISSUER = 'mvp_10'
const AUTH_JWT_AUDIENCE = 'mvp_10_users'
const AUTH_JWT_EXPIRES_IN = '7d'

function getJwtSecret() {
  const secret = process.env.AUTH_JWT_SECRET?.trim() || process.env.JWT_SECRET?.trim()

  if (!secret) {
    throw new Error('AUTH_JWT_SECRET is not configured.')
  }

  return new TextEncoder().encode(secret)
}

export async function createAuthToken(userId: string, sessionToken: string) {
  return new SignJWT({ sid: sessionToken })
    .setProtectedHeader({ alg: AUTH_JWT_ALGORITHM })
    .setSubject(userId)
    .setIssuer(AUTH_JWT_ISSUER)
    .setAudience(AUTH_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(AUTH_JWT_EXPIRES_IN)
    .sign(getJwtSecret())
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    algorithms: [AUTH_JWT_ALGORITHM],
    issuer: AUTH_JWT_ISSUER,
    audience: AUTH_JWT_AUDIENCE,
  })

  if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
    throw new Error('Authentication token payload is invalid.')
  }

  return {
    userId: payload.sub,
    sessionToken: payload.sid,
  }
}
