import path from 'path'

import {
  findCloudDocument,
  listCloudDocuments,
  putCloudDocument,
  readLocalJsonFile,
  withCloudBaseFallback,
  writeLocalJsonFile,
} from '@/lib/server/cloudbase'
import type { RecruiterScreeningRecord } from '@/types/screening'

const INDEX_FILE = path.join(process.cwd(), 'data', 'recruiter-screenings', 'index.json')
const RECRUITER_SCREENINGS_COLLECTION = 'recruiter_screenings'

async function readRecruiterScreenings() {
  return readLocalJsonFile<RecruiterScreeningRecord[]>(INDEX_FILE, [])
}

async function writeRecruiterScreenings(records: RecruiterScreeningRecord[]) {
  await writeLocalJsonFile(INDEX_FILE, records)
}

function sortRecruiterScreenings(records: RecruiterScreeningRecord[]) {
  return [...records].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })
}

export async function listRecruiterScreeningsByRecruiter(recruiterUserId: string) {
  return withCloudBaseFallback(
    'listRecruiterScreeningsByRecruiter',
    async () =>
      sortRecruiterScreenings(
        await listCloudDocuments<RecruiterScreeningRecord>(RECRUITER_SCREENINGS_COLLECTION, {
          where: { recruiterUserId },
        })
      ),
    async () =>
      sortRecruiterScreenings(await readRecruiterScreenings()).filter(
        (record) => record.recruiterUserId === recruiterUserId
      )
  )
}

export async function findRecruiterScreeningByJobAndResume(
  recruiterUserId: string,
  jobId: string,
  resumeId: string
) {
  return withCloudBaseFallback(
    'findRecruiterScreeningByJobAndResume',
    async () =>
      findCloudDocument<RecruiterScreeningRecord>(RECRUITER_SCREENINGS_COLLECTION, {
        where: { recruiterUserId, jobId, resumeId },
      }),
    async () => {
      const records = await readRecruiterScreenings()
      return (
        records.find(
          (record) =>
            record.recruiterUserId === recruiterUserId &&
            record.jobId === jobId &&
            record.resumeId === resumeId
        ) ?? null
      )
    }
  )
}

export async function saveRecruiterScreening(record: RecruiterScreeningRecord) {
  await withCloudBaseFallback(
    'saveRecruiterScreening',
    async () => {
      await putCloudDocument(RECRUITER_SCREENINGS_COLLECTION, record.id, record)
    },
    async () => {
      const records = await readRecruiterScreenings()
      const index = records.findIndex((item) => item.id === record.id)

      if (index === -1) {
        records.unshift(record)
      } else {
        records[index] = record
      }

      await writeRecruiterScreenings(sortRecruiterScreenings(records))
    }
  )
}
