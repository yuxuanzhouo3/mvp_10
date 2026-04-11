import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.text()

  console.log('Received WeChat Pay webhook payload:', {
    timestamp: new Date().toISOString(),
    bodyLength: body.length,
  })

  return NextResponse.json({
    code: 'SUCCESS',
    message: 'Webhook received.',
  })
}
