import path from 'path'

import {
  getCloudDocumentById,
  listCloudDocuments,
  putCloudDocument,
  readLocalJsonFile,
  withCloudBaseFallback,
  writeLocalJsonFile,
} from '@/lib/server/cloudbase'
import type { ModerationReport } from '@/types/report'

const INDEX_FILE = path.join(process.cwd(), 'data', 'reports', 'index.json')
const REPORTS_COLLECTION = 'reports'

async function readReports() {
  return readLocalJsonFile<ModerationReport[]>(INDEX_FILE, [])
}

async function writeReports(records: ModerationReport[]) {
  await writeLocalJsonFile(INDEX_FILE, records)
}

function sortReports(records: ModerationReport[]) {
  return [...records].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

export async function listModerationReports() {
  return withCloudBaseFallback(
    'listModerationReports',
    async () => sortReports(await listCloudDocuments<ModerationReport>(REPORTS_COLLECTION)),
    async () => sortReports(await readReports())
  )
}

export async function addModerationReport(record: ModerationReport) {
  await withCloudBaseFallback(
    'addModerationReport',
    async () => {
      await putCloudDocument(REPORTS_COLLECTION, record.id, record)
    },
    async () => {
      const records = sortReports(await readReports())
      records.unshift(record)
      await writeReports(records)
    }
  )
}

export async function updateModerationReport(
  id: string,
  updater: (record: ModerationReport) => ModerationReport
) {
  return withCloudBaseFallback(
    'updateModerationReport',
    async () => {
      const existing = await getCloudDocumentById<ModerationReport>(REPORTS_COLLECTION, id)

      if (!existing) {
        return null
      }

      const nextRecord = updater(existing)
      await putCloudDocument(REPORTS_COLLECTION, id, nextRecord)

      return nextRecord
    },
    async () => {
      const records = await readReports()
      const index = records.findIndex((record) => record.id === id)

      if (index === -1) {
        return null
      }

      records[index] = updater(records[index])
      await writeReports(records)

      return records[index]
    }
  )
}
