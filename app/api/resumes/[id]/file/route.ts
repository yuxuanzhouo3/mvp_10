import { promises as fs } from 'fs'

import { NextResponse } from 'next/server'

import { getCloudTempFileUrl } from '@/lib/server/cloudbase'
import {
  isAuthErrorMessage,
  isPermissionErrorMessage,
  requireAuthenticatedUser,
} from '@/lib/server/auth-helpers'
import { getResumeLocalFilePath, getResumeRecordById } from '@/lib/server/resume-store'
import type { AppUser } from '@/types/auth'
import type { ResumeRecord } from '@/types/resume'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeEmail(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function canAccessResume(record: ResumeRecord, user: AppUser) {
  if (user.role === 'admin') {
    return true
  }

  if (record.ownerUserId) {
    return record.ownerUserId === user.id
  }

  const userEmail = normalizeEmail(user.email)
  return [record.ownerEmail, record.contact.email].some((value) => normalizeEmail(value) === userEmail)
}

async function readCloudResumeFile(cloudFileId: string) {
  const tempUrl = await getCloudTempFileUrl(cloudFileId)

  if (!tempUrl) {
    throw new Error('Cloud resume file URL could not be generated.')
  }

  const response = await fetch(tempUrl, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Cloud resume file download failed with status ${response.status}.`)
  }

  return Buffer.from(await response.arrayBuffer())
}

function buildDownloadHeaders(record: ResumeRecord, contentLength: number) {
  return {
    'Content-Type': record.mimeType || 'application/octet-stream',
    'Content-Length': String(contentLength),
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(record.fileName)}`,
    'Cache-Control': 'no-store',
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const record = await getResumeRecordById(params.id)

    if (!record) {
      return NextResponse.json({ error: 'Resume not found.' }, { status: 404 })
    }

    if (!canAccessResume(record, user)) {
      return NextResponse.json({ error: 'User does not have permission.' }, { status: 403 })
    }

    const fileBuffer = record.cloudFileId
      ? await readCloudResumeFile(record.cloudFileId)
      : await fs.readFile(getResumeLocalFilePath(record.storedFileName))

    return new Response(fileBuffer, {
      status: 200,
      headers: buildDownloadHeaders(record, fileBuffer.byteLength),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to download resume file.'
    const status =
      isAuthErrorMessage(message)
        ? 401
        : isPermissionErrorMessage(message)
          ? 403
          : (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? 404
            : 500
    return NextResponse.json({ error: message }, { status })
  }
}
