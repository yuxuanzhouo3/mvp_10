import { promises as fs } from 'fs'
import path from 'path'

import type { ModerationReport } from '@/types/report'

const DATA_DIR = path.join(process.cwd(), 'data', 'reports')
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

export async function listModerationReports() {
  const records = await readJsonFile<ModerationReport[]>(INDEX_FILE, [])

  return records.sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

export async function addModerationReport(record: ModerationReport) {
  const records = await listModerationReports()
  records.unshift(record)
  await writeJsonFile(INDEX_FILE, records)
}

export async function updateModerationReport(
  id: string,
  updater: (record: ModerationReport) => ModerationReport
) {
  const records = await listModerationReports()
  const index = records.findIndex((record) => record.id === id)

  if (index === -1) {
    return null
  }

  records[index] = updater(records[index])
  await writeJsonFile(INDEX_FILE, records)

  return records[index]
}
