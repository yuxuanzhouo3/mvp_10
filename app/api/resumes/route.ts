import { NextResponse } from 'next/server'

import {
  buildDefaultCommunication,
  buildDefaultTasks,
  buildDefaultTimeline,
  buildDefaultWorkflow,
} from '@/lib/server/resume-defaults'
import { analyzeResumeText, extractResumeText } from '@/lib/server/resume-analysis'
import { addResumeRecord, listResumeRecords, saveResumeFile, toResumeListItem } from '@/lib/server/resume-store'
import type { ResumeRecord } from '@/types/resume'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const records = await listResumeRecords()
  return NextResponse.json(records.map(toResumeListItem))
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const uploaded = formData.get('resume')

    if (!(uploaded instanceof File)) {
      return NextResponse.json({ error: 'No resume file was uploaded.' }, { status: 400 })
    }

    if (uploaded.size === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 })
    }

    if (uploaded.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Resume file must be 10MB or smaller.' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const buffer = Buffer.from(await uploaded.arrayBuffer())
    const { storedFileName } = await saveResumeFile(id, uploaded.name, buffer)
    const extractedText = await extractResumeText(buffer, uploaded.name, uploaded.type)

    if (!extractedText) {
      return NextResponse.json(
        { error: 'The resume could not be parsed into text. Try a text-based PDF or DOCX.' },
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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
