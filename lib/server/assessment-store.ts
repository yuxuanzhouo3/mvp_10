import { promises as fs } from 'fs'
import path from 'path'

import type { AssessmentAudioAsset, AssessmentAnswer, AssessmentRecord } from '@/types/assessment'

const DATA_DIR = path.join(process.cwd(), 'data', 'assessments')
const INDEX_FILE = path.join(DATA_DIR, 'index.json')
const FILES_DIR = path.join(DATA_DIR, 'files')

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function ensureFilesStore() {
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

async function readAssessmentRecords() {
  const records = await readJsonFile<AssessmentRecord[]>(INDEX_FILE, [])
  return records.map(normalizeAssessmentRecord)
}

function defaultAudioAsset(): AssessmentAudioAsset {
  return {
    fileName: null,
    mimeType: null,
    size: null,
    storedFileName: null,
    uploadedAt: null,
  }
}

function normalizeAnswer(answer: AssessmentAnswer): AssessmentAnswer {
  return {
    ...answer,
    transcript: typeof answer.transcript === 'string' ? answer.transcript : null,
    audioAsset:
      answer.audioAsset && typeof answer.audioAsset === 'object'
        ? {
            fileName: typeof answer.audioAsset.fileName === 'string' ? answer.audioAsset.fileName : null,
            mimeType: typeof answer.audioAsset.mimeType === 'string' ? answer.audioAsset.mimeType : null,
            size: typeof answer.audioAsset.size === 'number' ? answer.audioAsset.size : null,
            storedFileName:
              typeof answer.audioAsset.storedFileName === 'string' ? answer.audioAsset.storedFileName : null,
            uploadedAt: typeof answer.audioAsset.uploadedAt === 'string' ? answer.audioAsset.uploadedAt : null,
          }
        : defaultAudioAsset(),
  }
}

function normalizeAssessmentRecord(record: AssessmentRecord): AssessmentRecord {
  return {
    ...record,
    answers: record.answers.map(normalizeAnswer),
  }
}

export async function listAssessmentRecords() {
  const records = await readAssessmentRecords()
  return records.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

export async function addAssessmentRecord(record: AssessmentRecord) {
  const records = await listAssessmentRecords()
  records.unshift(normalizeAssessmentRecord(record))
  await writeJsonFile(INDEX_FILE, records)
}

export async function getAssessmentRecordById(id: string) {
  const records = await readAssessmentRecords()
  return records.find((record) => record.id === id) ?? null
}

export async function updateAssessmentRecord(
  id: string,
  updater: (record: AssessmentRecord) => AssessmentRecord
) {
  const records = await readAssessmentRecords()
  const index = records.findIndex((record) => record.id === id)

  if (index === -1) {
    return null
  }

  records[index] = normalizeAssessmentRecord(updater(records[index]))
  await writeJsonFile(INDEX_FILE, records)
  return records[index]
}

function sanitizeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-')
}

export async function saveAssessmentAudioFile(
  assessmentId: string,
  questionId: string,
  fileName: string,
  buffer: Buffer
) {
  await ensureFilesStore()

  const storedFileName = `${sanitizeFilePart(assessmentId)}-${sanitizeFilePart(questionId)}-${Date.now()}-${sanitizeFilePart(
    fileName || 'audio.webm'
  )}`
  const absolutePath = path.join(FILES_DIR, storedFileName)

  await fs.writeFile(absolutePath, buffer)

  return {
    absolutePath,
    storedFileName,
  }
}
