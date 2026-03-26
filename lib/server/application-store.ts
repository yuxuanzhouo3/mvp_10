import { promises as fs } from 'fs'
import path from 'path'

import type { ApplicationRecord } from '@/types/application'

const DATA_DIR = path.join(process.cwd(), 'data', 'applications')
const INDEX_FILE = path.join(DATA_DIR, 'index.json')

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true })
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

async function readApplications() {
  return readJsonFile<ApplicationRecord[]>(INDEX_FILE, [])
}

export async function listApplications() {
  const records = await readApplications()
  return records.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export async function listApplicationsByUserId(userId: string) {
  const records = await listApplications()
  return records.filter((record) => record.userId === userId)
}

export async function listApplicationsByJobId(jobId: string) {
  const records = await listApplications()
  return records.filter((record) => record.jobId === jobId)
}

export async function addApplication(record: ApplicationRecord) {
  const records = await listApplications()
  records.unshift(record)
  await writeJsonFile(INDEX_FILE, records)
}

export async function getApplicationById(id: string) {
  const records = await readApplications()
  return records.find((record) => record.id === id) ?? null
}

export async function findApplicationByUserAndJob(userId: string, jobId: string) {
  const records = await readApplications()
  return records.find((record) => record.userId === userId && record.jobId === jobId) ?? null
}

export async function updateApplication(
  id: string,
  updater: (record: ApplicationRecord) => ApplicationRecord
) {
  const records = await readApplications()
  const index = records.findIndex((record) => record.id === id)

  if (index === -1) {
    return null
  }

  records[index] = updater(records[index])
  await writeJsonFile(INDEX_FILE, records)
  return records[index]
}
