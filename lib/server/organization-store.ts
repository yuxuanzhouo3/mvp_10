import { promises as fs } from 'fs'
import path from 'path'

import { normalizeOrganizationLead } from '@/lib/server/organization-defaults'
import type { OrganizationLead } from '@/types/organization'

const DATA_DIR = path.join(process.cwd(), 'data', 'organizations')
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

async function readOrganizationLeads() {
  const records = await readJsonFile<OrganizationLead[]>(INDEX_FILE, [])
  return records.map(normalizeOrganizationLead)
}

export async function listOrganizationLeads() {
  const records = await readOrganizationLeads()

  return records.sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

export async function addOrganizationLead(record: OrganizationLead) {
  const records = await listOrganizationLeads()
  records.unshift(record)
  await writeJsonFile(INDEX_FILE, records)
}

export async function getOrganizationLeadById(id: string) {
  const records = await readOrganizationLeads()
  return records.find((record) => record.id === id) ?? null
}

export async function updateOrganizationLead(
  id: string,
  updater: (record: OrganizationLead) => OrganizationLead
) {
  const records = await readOrganizationLeads()
  const index = records.findIndex((record) => record.id === id)

  if (index === -1) {
    return null
  }

  records[index] = updater(records[index])
  await writeJsonFile(INDEX_FILE, records)

  return records[index]
}
