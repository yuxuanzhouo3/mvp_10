import { NextResponse } from 'next/server'

import { PAYMENT_PLANS } from '@/lib/server/billing-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(PAYMENT_PLANS)
}
