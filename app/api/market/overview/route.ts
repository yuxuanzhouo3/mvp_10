import { NextResponse } from 'next/server'

import { getMarketOverviewData } from '@/lib/server/backoffice'
import { isAuthErrorMessage, isPermissionErrorMessage, requireUserRoles } from '@/lib/server/auth-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function statusForMessage(message: string) {
  if (isAuthErrorMessage(message)) {
    return 401
  }

  if (isPermissionErrorMessage(message)) {
    return 403
  }

  return 500
}

export async function GET(request: Request) {
  try {
    await requireUserRoles(request, ['admin', 'market'])
    const url = new URL(request.url)
    const month = url.searchParams.get('month')?.trim() || undefined
    const data = await getMarketOverviewData(month)
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load market overview.'
    return NextResponse.json({ error: message }, { status: statusForMessage(message) })
  }
}
