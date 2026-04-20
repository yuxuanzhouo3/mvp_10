import { POST as handleWechatMiniLogin } from '@/app/api/wxlogin/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return handleWechatMiniLogin(request)
}
