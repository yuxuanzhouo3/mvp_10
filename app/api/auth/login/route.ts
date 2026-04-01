import { NextResponse } from 'next/server'

import { authenticateUser, createSession } from '@/lib/server/auth-store'
import { createAuthToken } from '@/lib/server/jwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: unknown
      password?: unknown
    }

    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const user = await authenticateUser(body.email, body.password)

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    const session = await createSession(user.id)

    const token = await createAuthToken(user.id, session.token)

    return NextResponse.json({
      user,
      token,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
