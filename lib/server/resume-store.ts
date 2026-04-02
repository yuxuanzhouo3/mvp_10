import path from 'path'

import {
  ensureLocalDir,
  getCloudDocumentById,
  listCloudDocuments,
  putCloudDocument,
  readLocalJsonFile,
  withCloudBaseFallback,
  writeLocalBufferFile,
  writeLocalJsonFile,
} from '@/lib/server/cloudbase'
import { normalizeResumeRecord } from '@/lib/server/resume-defaults'
import type { ResumeListItem, ResumeRecord } from '@/types/resume'

const DATA_DIR = path.join(process.cwd(), 'data', 'resumes')
const FILES_DIR = path.join(DATA_DIR, 'files')
const INDEX_FILE = path.join(DATA_DIR, 'index.json')
const RESUMES_COLLECTION = 'resumes'

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function readResumeRecords() {
  const records = await readLocalJsonFile<ResumeRecord[]>(INDEX_FILE, [])
  return records.map(normalizeResumeRecord)
}

async function writeResumeRecords(records: ResumeRecord[]) {
  await writeLocalJsonFile(INDEX_FILE, records)
}

function sortResumeRecords(records: ResumeRecord[]) {
  return [...records].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

export async function saveResumeFile(id: string, fileName: string, buffer: Buffer) {
  await ensureLocalDir(FILES_DIR)

  const storedFileName = `${id}-${sanitizeFileName(fileName)}`
  const storedFilePath = path.join(FILES_DIR, storedFileName)

  await writeLocalBufferFile(storedFilePath, buffer)

  return {
    storedFileName,
    storedFilePath,
  }
}

export async function listResumeRecords() {
  return withCloudBaseFallback(
    'listResumeRecords',
    async () =>
      sortResumeRecords((await listCloudDocuments<ResumeRecord>(RESUMES_COLLECTION)).map(normalizeResumeRecord)),
    async () => sortResumeRecords(await readResumeRecords())
  )
}

export async function listResumeRecordsByOwner(ownerUserId: string) {
  const records = await listResumeRecords()
  return records.filter((record) => record.ownerUserId === ownerUserId)
}

export async function addResumeRecord(record: ResumeRecord) {
  const normalizedRecord = normalizeResumeRecord(record)

  await withCloudBaseFallback(
    'addResumeRecord',
    async () => {
      await putCloudDocument(RESUMES_COLLECTION, normalizedRecord.id, normalizedRecord)
    },
    async () => {
      const records = sortResumeRecords(await readResumeRecords())
      records.unshift(normalizedRecord)
      await writeResumeRecords(records)
    }
  )
}

export async function getResumeRecordById(id: string) {
  return withCloudBaseFallback(
    'getResumeRecordById',
    async () => {
      const record = await getCloudDocumentById<ResumeRecord>(RESUMES_COLLECTION, id)
      return record ? normalizeResumeRecord(record) : null
    },
    async () => {
      const records = await readResumeRecords()
      return records.find((record) => record.id === id) ?? null
    }
  )
}

export async function updateResumeRecord(
  id: string,
  updater: (record: ResumeRecord) => ResumeRecord
) {
  return withCloudBaseFallback(
    'updateResumeRecord',
    async () => {
      const existing = await getCloudDocumentById<ResumeRecord>(RESUMES_COLLECTION, id)

      if (!existing) {
        return null
      }

      const nextRecord = normalizeResumeRecord(updater(normalizeResumeRecord(existing)))
      await putCloudDocument(RESUMES_COLLECTION, id, nextRecord)

      return nextRecord
    },
    async () => {
      const records = await readResumeRecords()
      const index = records.findIndex((record) => record.id === id)

      if (index === -1) {
        return null
      }

      records[index] = updater(records[index])
      await writeResumeRecords(records)

      return records[index]
    }
  )
}

export function toResumeListItem(record: ResumeRecord): ResumeListItem {
  return {
    id: record.id,
    ownerUserId: record.ownerUserId,
    ownerName: record.ownerName,
    ownerEmail: record.ownerEmail,
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    createdAt: record.createdAt,
    storedFileName: record.storedFileName,
    score: record.score,
    summary: record.summary,
    source: record.source,
    contact: record.contact,
    profile: record.profile,
    skillAnalysis: record.skillAnalysis,
    insights: record.insights,
    composition: record.composition,
    workflow: record.workflow,
    communication: record.communication,
    tasks: record.tasks,
    timeline: record.timeline,
    textPreview: record.extractedText.slice(0, 280).trim(),
  }
}
