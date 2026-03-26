import { NextResponse } from 'next/server'

import { requireAuthenticatedUser } from '@/lib/server/auth-helpers'
import { deleteSession } from '@/lib/server/auth-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { token } = await requireAuthenticatedUser(request)
    await deleteSession(token)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logout failed.'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
