import { promises as fs } from 'fs'
import path from 'path'

import { normalizeResumeRecord } from '@/lib/server/resume-defaults'
import type { ResumeListItem, ResumeRecord } from '@/types/resume'

const DATA_DIR = path.join(process.cwd(), 'data', 'resumes')
const FILES_DIR = path.join(DATA_DIR, 'files')
const INDEX_FILE = path.join(DATA_DIR, 'index.json')

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function ensureStore() {
  await fs.mkdir(FILES_DIR, { recursive: true })
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback
    }

    throw error
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await ensureStore()
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readResumeRecords() {
  const records = await readJsonFile<ResumeRecord[]>(INDEX_FILE, [])
  return records.map(normalizeResumeRecord)
}

export async function saveResumeFile(id: string, fileName: string, buffer: Buffer) {
  await ensureStore()

  const storedFileName = `${id}-${sanitizeFileName(fileName)}`
  const storedFilePath = path.join(FILES_DIR, storedFileName)

  await fs.writeFile(storedFilePath, buffer)

  return {
    storedFileName,
    storedFilePath,
  }
}

export async function listResumeRecords() {
  const records = await readResumeRecords()

  return records.sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

export async function addResumeRecord(record: ResumeRecord) {
  const records = await listResumeRecords()
  records.unshift(record)
  await writeJsonFile(INDEX_FILE, records)
}

export async function getResumeRecordById(id: string) {
  const records = await readResumeRecords()
  return records.find((record) => record.id === id) ?? null
}

export async function updateResumeRecord(
  id: string,
  updater: (record: ResumeRecord) => ResumeRecord
) {
  const records = await readResumeRecords()
  const index = records.findIndex((record) => record.id === id)

  if (index === -1) {
    return null
  }

  records[index] = updater(records[index])
  await writeJsonFile(INDEX_FILE, records)

  return records[index]
}

export function toResumeListItem(record: ResumeRecord): ResumeListItem {
  return {
    id: record.id,
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
