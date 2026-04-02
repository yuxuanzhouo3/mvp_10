import { NextResponse } from 'next/server'

import {
  buildDefaultCommunication,
  buildDefaultTasks,
  buildDefaultTimeline,
  buildDefaultWorkflow,
} from '@/lib/server/resume-defaults'
import { analyzeResumeText, extractResumeText } from '@/lib/server/resume-analysis'
import { addResumeRecord, listResumeRecords, saveResumeFile, toResumeListItem } from '@/lib/server/resume-store'
import { isAuthErrorMessage, requireAuthenticatedUser } from '@/lib/server/auth-helpers'
import type { AppUser } from '@/types/auth'
import type { ResumeRecord } from '@/types/resume'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeEmail(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function isResumeOwner(record: ResumeRecord, user: Pick<AppUser, 'id' | 'email'>) {
  if (record.ownerUserId) {
    return record.ownerUserId === user.id
  }

  const userEmail = normalizeEmail(user.email)
  return [record.ownerEmail, record.contact.email].some((value) => normalizeEmail(value) === userEmail)
}

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope')
    const records = await listResumeRecords()

    if (scope === 'all' && user.role === 'admin') {
      return NextResponse.json(records.map(toResumeListItem))
    }

    return NextResponse.json(records.filter((record) => isResumeOwner(record, user)).map(toResumeListItem))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load resumes.'
    const status = isAuthErrorMessage(message) ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const formData = await request.formData()
    const uploaded = formData.get('resume')

    if (!(uploaded instanceof File)) {
      return NextResponse.json({ error: 'Please upload a resume file.' }, { status: 400 })
    }

    if (uploaded.size === 0) {
      return NextResponse.json({ error: 'The uploaded file is empty.' }, { status: 400 })
    }

    if (uploaded.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Resume file size cannot exceed 10MB.' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const buffer = Buffer.from(await uploaded.arrayBuffer())
    const { storedFileName } = await saveResumeFile(id, uploaded.name, buffer)
    const extractedText = await extractResumeText(buffer, uploaded.name, uploaded.type)

    if (!extractedText) {
      return NextResponse.json(
        { error: 'Unable to extract text from this resume. Please upload a text-based PDF or DOCX.' },
        { status: 400 }
      )
    }

    const analysis = await analyzeResumeText(extractedText)
    const workflow = buildDefaultWorkflow({
      contact: analysis.contact,
      score: analysis.score,
      createdAt,
    })
    const communication = buildDefaultCommunication()

    const record: ResumeRecord = {
      id,
      ownerUserId: user.id,
      ownerName: user.name,
      ownerEmail: user.email,
      fileName: uploaded.name,
      mimeType: uploaded.type || 'application/octet-stream',
      fileSize: uploaded.size,
      createdAt,
      storedFileName,
      extractedText,
      ...analysis,
      workflow,
      communication,
      tasks: buildDefaultTasks({
        contact: analysis.contact,
        workflow,
        communication,
        createdAt,
      }),
      timeline: buildDefaultTimeline({
        contact: analysis.contact,
        workflow,
        createdAt,
      }),
    }

    await addResumeRecord(record)
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resume upload failed.'
    const status = isAuthErrorMessage(message) ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
