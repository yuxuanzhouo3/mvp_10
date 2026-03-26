import { NextResponse } from 'next/server'

import { requireAuthenticatedUser } from '@/lib/server/auth-helpers'
import { buildJobRecommendationResponse, findBestResumeForUser } from '@/lib/server/job-matching'
import { listPublishedJobs } from '@/lib/server/job-store'
import { listResumeRecords } from '@/lib/server/resume-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const [jobs, resumes] = await Promise.all([listPublishedJobs(), listResumeRecords()])
    const resume = findBestResumeForUser(user, resumes)
    const payload = buildJobRecommendationResponse(user, resume, jobs)

    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load recommendations.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
