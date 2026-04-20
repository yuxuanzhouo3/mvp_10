import path from 'path'

import { getRemoteDataProvider } from '@/lib/app-version'
import {
  ensureLocalDir,
  getLocalDataPath,
  getCloudDocumentById,
  listCloudDocuments,
  putCloudDocument,
  readLocalJsonFile,
  uploadCloudFile,
  withCloudBaseFallback,
  writeLocalBufferFile,
  writeLocalJsonFile,
} from '@/lib/server/cloudbase'
import { normalizeResumeRecord } from '@/lib/server/resume-defaults'
import type { ResumeListItem, ResumeRecord, ResumeStorageProvider } from '@/types/resume'

const DATA_DIR = getLocalDataPath('resumes')
const FILES_DIR = path.join(DATA_DIR, 'files')
const INDEX_FILE = path.join(DATA_DIR, 'index.json')
const RESUMES_COLLECTION = 'resumes'

interface SavedResumeFile {
  storedFileName: string
  storedFilePath: string
  cloudFileId: string | null
  storageProvider: ResumeStorageProvider
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getStoragePathPrefix() {
  const customPrefix =
    process.env.REMOTE_STORAGE_PATH_PREFIX?.trim().replace(/^[\\/]+|[\\/]+$/g, '') ||
    process.env.SUPABASE_STORAGE_PATH_PREFIX?.trim().replace(/^[\\/]+|[\\/]+$/g, '') ||
    process.env.CLOUDBASE_STORAGE_PATH_PREFIX?.trim().replace(/^[\\/]+|[\\/]+$/g, '')
  return customPrefix || 'resumes'
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

export function getResumeLocalFilePath(storedFileName: string) {
  return path.join(FILES_DIR, storedFileName)
}

export async function saveResumeFile(id: string, fileName: string, buffer: Buffer): Promise<SavedResumeFile> {
  const storedFileName = `${id}-${sanitizeFileName(fileName)}`
  const storedFilePath = getResumeLocalFilePath(storedFileName)

  return withCloudBaseFallback<SavedResumeFile>(
    'saveResumeFile',
    async () => {
      const cloudPath = `${getStoragePathPrefix()}/${id}/${storedFileName}`
      const result = await uploadCloudFile(cloudPath, buffer)

      if (!result.fileID) {
        throw new Error('Remote storage upload did not return a file reference.')
      }

      return {
        storedFileName,
        storedFilePath,
        cloudFileId: result.fileID,
        storageProvider: getRemoteDataProvider(),
      }
    },
    async () => {
      await ensureLocalDir(FILES_DIR)
      await writeLocalBufferFile(storedFilePath, buffer)

      return {
        storedFileName,
        storedFilePath,
        cloudFileId: null,
        storageProvider: 'local' as const,
      }
    }
  )
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
    cloudFileId: record.cloudFileId,
    storageProvider: record.storageProvider,
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
