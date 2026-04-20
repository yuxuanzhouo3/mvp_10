import { NextResponse } from 'next/server'

import { isAuthErrorMessage, isPermissionErrorMessage, requireUserRoles } from '@/lib/server/auth-helpers'
import { updateUser } from '@/lib/server/auth-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function statusForMessage(message: string) {
  if (isAuthErrorMessage(message)) {
    return 401
  }

  if (isPermissionErrorMessage(message)) {
    return 403
  }

  if (message === 'AI paid access flag is required.') {
    return 400
  }

  if (message === 'User not found.') {
    return 404
  }

  return 500
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireUserRoles(request, ['admin'])
    const params = await context.params
    const body = (await request.json()) as { aiPaidEnabled?: unknown }

    if (typeof body.aiPaidEnabled !== 'boolean') {
      throw new Error('AI paid access flag is required.')
    }

    const aiPaidEnabled = body.aiPaidEnabled
    const user = await updateUser(params.id, (current) => ({
      ...current,
      aiPaidEnabled,
    }))

    if (!user) {
      throw new Error('User not found.')
    }

    return NextResponse.json(user)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update user AI access.'
    return NextResponse.json({ error: message }, { status: statusForMessage(message) })
  }
}
