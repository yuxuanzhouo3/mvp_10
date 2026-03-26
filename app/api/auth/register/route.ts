import { NextResponse } from 'next/server'

import { createSession, createUser } from '@/lib/server/auth-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: unknown
      password?: unknown
      name?: unknown
    }

    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 })
    }

    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    if (typeof body.password !== 'string' || body.password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      )
    }

    const user = await createUser({
      email: body.email,
      password: body.password,
      name: body.name,
    })
    const session = await createSession(user.id)

    return NextResponse.json({
      user,
      token: session.token,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
