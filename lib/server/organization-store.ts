import path from 'path'

import {
  getCloudDocumentById,
  listCloudDocuments,
  putCloudDocument,
  readLocalJsonFile,
  withCloudBaseFallback,
  writeLocalJsonFile,
} from '@/lib/server/cloudbase'
import { normalizeOrganizationLead } from '@/lib/server/organization-defaults'
import type { OrganizationLead } from '@/types/organization'

const INDEX_FILE = path.join(process.cwd(), 'data', 'organizations', 'index.json')
const ORGANIZATIONS_COLLECTION = 'organizations'

async function readOrganizationLeads() {
  const records = await readLocalJsonFile<OrganizationLead[]>(INDEX_FILE, [])
  return records.map(normalizeOrganizationLead)
}

async function writeOrganizationLeads(records: OrganizationLead[]) {
  await writeLocalJsonFile(INDEX_FILE, records)
}

function sortOrganizationLeads(records: OrganizationLead[]) {
  return [...records].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

export async function listOrganizationLeads() {
  return withCloudBaseFallback(
    'listOrganizationLeads',
    async () =>
      sortOrganizationLeads(
        (await listCloudDocuments<OrganizationLead>(ORGANIZATIONS_COLLECTION)).map(normalizeOrganizationLead)
      ),
    async () => sortOrganizationLeads(await readOrganizationLeads())
  )
}

export async function addOrganizationLead(record: OrganizationLead) {
  await withCloudBaseFallback(
    'addOrganizationLead',
    async () => {
      await putCloudDocument(ORGANIZATIONS_COLLECTION, record.id, normalizeOrganizationLead(record))
    },
    async () => {
      const records = sortOrganizationLeads(await readOrganizationLeads())
      records.unshift(record)
      await writeOrganizationLeads(records)
    }
  )
}

export async function getOrganizationLeadById(id: string) {
  return withCloudBaseFallback(
    'getOrganizationLeadById',
    async () => {
      const record = await getCloudDocumentById<OrganizationLead>(ORGANIZATIONS_COLLECTION, id)
      return record ? normalizeOrganizationLead(record) : null
    },
    async () => {
      const records = await readOrganizationLeads()
      return records.find((record) => record.id === id) ?? null
    }
  )
}

export async function updateOrganizationLead(
  id: string,
  updater: (record: OrganizationLead) => OrganizationLead
) {
  return withCloudBaseFallback(
    'updateOrganizationLead',
    async () => {
      const existing = await getCloudDocumentById<OrganizationLead>(ORGANIZATIONS_COLLECTION, id)

      if (!existing) {
        return null
      }

      const nextRecord = normalizeOrganizationLead(updater(normalizeOrganizationLead(existing)))
      await putCloudDocument(ORGANIZATIONS_COLLECTION, id, nextRecord)

      return nextRecord
    },
    async () => {
      const records = await readOrganizationLeads()
      const index = records.findIndex((record) => record.id === id)

      if (index === -1) {
        return null
      }

      records[index] = updater(records[index])
      await writeOrganizationLeads(records)

      return records[index]
    }
  )
}
