import path from 'path'

import {
  getLocalDataPath,
  getCloudDocumentById,
  listCloudDocuments,
  putCloudDocument,
  readLocalJsonFile,
  withCloudBaseFallback,
  writeLocalJsonFile,
} from '@/lib/server/cloudbase'
import type { AssessmentAudioAsset, AssessmentAnswer, AssessmentRecord } from '@/types/assessment'

const DATA_DIR = getLocalDataPath('assessments')
const INDEX_FILE = path.join(DATA_DIR, 'index.json')
const ASSESSMENTS_COLLECTION = 'assessments'

async function readAssessmentRecords() {
  const records = await readLocalJsonFile<AssessmentRecord[]>(INDEX_FILE, [])
  return records.map(normalizeAssessmentRecord)
}

async function writeAssessmentRecords(records: AssessmentRecord[]) {
  await writeLocalJsonFile(INDEX_FILE, records)
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
    kind: record.kind ?? 'practice',
    applicationId: typeof record.applicationId === 'string' ? record.applicationId : null,
    candidateUserId: typeof record.candidateUserId === 'string' ? record.candidateUserId : null,
    recruiterUserId: typeof record.recruiterUserId === 'string' ? record.recruiterUserId : null,
    recruiterName: typeof record.recruiterName === 'string' ? record.recruiterName : null,
    assignedAt: typeof record.assignedAt === 'string' ? record.assignedAt : null,
    answers: record.answers.map(normalizeAnswer),
  }
}

function sortAssessmentRecords(records: AssessmentRecord[]) {
  return [...records].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

export async function listAssessmentRecords() {
  return withCloudBaseFallback(
    'listAssessmentRecords',
    async () =>
      sortAssessmentRecords(
        (await listCloudDocuments<AssessmentRecord>(ASSESSMENTS_COLLECTION)).map(normalizeAssessmentRecord)
      ),
    async () => sortAssessmentRecords(await readAssessmentRecords())
  )
}

export async function addAssessmentRecord(record: AssessmentRecord) {
  const normalizedRecord = normalizeAssessmentRecord(record)

  await withCloudBaseFallback(
    'addAssessmentRecord',
    async () => {
      await putCloudDocument(ASSESSMENTS_COLLECTION, normalizedRecord.id, normalizedRecord)
    },
    async () => {
      const records = sortAssessmentRecords(await readAssessmentRecords())
      records.unshift(normalizedRecord)
      await writeAssessmentRecords(records)
    }
  )
}

export async function getAssessmentRecordById(id: string) {
  return withCloudBaseFallback(
    'getAssessmentRecordById',
    async () => {
      const record = await getCloudDocumentById<AssessmentRecord>(ASSESSMENTS_COLLECTION, id)
      return record ? normalizeAssessmentRecord(record) : null
    },
    async () => {
      const records = await readAssessmentRecords()
      return records.find((record) => record.id === id) ?? null
    }
  )
}

export async function updateAssessmentRecord(
  id: string,
  updater: (record: AssessmentRecord) => AssessmentRecord
) {
  return withCloudBaseFallback(
    'updateAssessmentRecord',
    async () => {
      const existing = await getCloudDocumentById<AssessmentRecord>(ASSESSMENTS_COLLECTION, id)

      if (!existing) {
        return null
      }

      const nextRecord = normalizeAssessmentRecord(updater(normalizeAssessmentRecord(existing)))
      await putCloudDocument(ASSESSMENTS_COLLECTION, id, nextRecord)
      return nextRecord
    },
    async () => {
      const records = await readAssessmentRecords()
      const index = records.findIndex((record) => record.id === id)

      if (index === -1) {
        return null
      }

      records[index] = normalizeAssessmentRecord(updater(records[index]))
      await writeAssessmentRecords(records)
      return records[index]
    }
  )
}
