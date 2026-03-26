import { NextResponse } from 'next/server'

import { requireAuthenticatedUser } from '@/lib/server/auth-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    return NextResponse.json(user)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validation failed.'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
