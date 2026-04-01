import path from 'path'

import {
  findCloudDocument,
  getCloudDocumentById,
  listCloudDocuments,
  putCloudDocument,
  readLocalJsonFile,
  withCloudBaseFallback,
  writeLocalJsonFile,
} from '@/lib/server/cloudbase'
import type { ApplicationRecord } from '@/types/application'

const INDEX_FILE = path.join(process.cwd(), 'data', 'applications', 'index.json')
const APPLICATIONS_COLLECTION = 'applications'

async function readApplications() {
  return readLocalJsonFile<ApplicationRecord[]>(INDEX_FILE, [])
}

async function writeApplications(records: ApplicationRecord[]) {
  await writeLocalJsonFile(INDEX_FILE, records)
}

function sortApplications(records: ApplicationRecord[]) {
  return [...records].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export async function listApplications() {
  return withCloudBaseFallback(
    'listApplications',
    async () => sortApplications(await listCloudDocuments<ApplicationRecord>(APPLICATIONS_COLLECTION)),
    async () => sortApplications(await readApplications())
  )
}

export async function listApplicationsByUserId(userId: string) {
  return withCloudBaseFallback(
    'listApplicationsByUserId',
    async () =>
      sortApplications(
        await listCloudDocuments<ApplicationRecord>(APPLICATIONS_COLLECTION, {
          where: { userId },
        })
      ),
    async () => sortApplications(await readApplications()).filter((record) => record.userId === userId)
  )
}

export async function listApplicationsByJobId(jobId: string) {
  return withCloudBaseFallback(
    'listApplicationsByJobId',
    async () =>
      sortApplications(
        await listCloudDocuments<ApplicationRecord>(APPLICATIONS_COLLECTION, {
          where: { jobId },
        })
      ),
    async () => sortApplications(await readApplications()).filter((record) => record.jobId === jobId)
  )
}

export async function addApplication(record: ApplicationRecord) {
  await withCloudBaseFallback(
    'addApplication',
    async () => {
      await putCloudDocument(APPLICATIONS_COLLECTION, record.id, record)
    },
    async () => {
      const records = sortApplications(await readApplications())
      records.unshift(record)
      await writeApplications(records)
    }
  )
}

export async function getApplicationById(id: string) {
  return withCloudBaseFallback(
    'getApplicationById',
    async () => getCloudDocumentById<ApplicationRecord>(APPLICATIONS_COLLECTION, id),
    async () => {
      const records = await readApplications()
      return records.find((record) => record.id === id) ?? null
    }
  )
}

export async function findApplicationByUserAndJob(userId: string, jobId: string) {
  return withCloudBaseFallback(
    'findApplicationByUserAndJob',
    async () =>
      findCloudDocument<ApplicationRecord>(APPLICATIONS_COLLECTION, {
        where: { userId, jobId },
      }),
    async () => {
      const records = await readApplications()
      return records.find((record) => record.userId === userId && record.jobId === jobId) ?? null
    }
  )
}

export async function updateApplication(
  id: string,
  updater: (record: ApplicationRecord) => ApplicationRecord
) {
  return withCloudBaseFallback(
    'updateApplication',
    async () => {
      const existing = await getCloudDocumentById<ApplicationRecord>(APPLICATIONS_COLLECTION, id)

      if (!existing) {
        return null
      }

      const nextRecord = updater(existing)
      await putCloudDocument(APPLICATIONS_COLLECTION, id, nextRecord)
      return nextRecord
    },
    async () => {
      const records = await readApplications()
      const index = records.findIndex((record) => record.id === id)

      if (index === -1) {
        return null
      }

      records[index] = updater(records[index])
      await writeApplications(records)
      return records[index]
    }
  )
}
