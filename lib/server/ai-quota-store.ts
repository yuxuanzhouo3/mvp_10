import {
  getCloudDocumentById,
  getLocalDataPath,
  listCloudDocuments,
  putCloudDocument,
  readLocalJsonFile,
  withCloudBaseFallback,
  writeLocalJsonFile,
} from '@/lib/server/cloudbase'
import type { AiMonthlyUsageSummary, AiQuotaConfig, AiUsageRecord } from '@/types/ai'

const AI_QUOTA_CONFIG_FILE = getLocalDataPath('ai', 'quota-config.json')
const AI_USAGE_RECORDS_FILE = getLocalDataPath('ai', 'usage-records.json')
const AI_QUOTA_CONFIG_COLLECTION = 'ai_quota_config'
const AI_USAGE_RECORDS_COLLECTION = 'ai_usage_records'
const DEFAULT_CONFIG_ID = 'default'

function roundCurrency(value: number) {
  return Math.round(value * 10000) / 10000
}

function normalizePositiveNumber(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function buildDefaultAiQuotaConfig(): AiQuotaConfig {
  const now = new Date().toISOString()

  return {
    id: 'default',
    enabled: true,
    monthlyBudgetRmb: 10,
    userLimit: 100,
    perUserMonthlyBudgetRmb: 0.1,
    freeTrialCount: 3,
    updatedAt: now,
    updatedByUserId: null,
  }
}

function normalizeAiQuotaConfig(value: Partial<AiQuotaConfig> | null | undefined): AiQuotaConfig {
  const fallback = buildDefaultAiQuotaConfig()

  return {
    id: 'default',
    enabled: value?.enabled ?? fallback.enabled,
    monthlyBudgetRmb: roundCurrency(
      normalizePositiveNumber(value?.monthlyBudgetRmb ?? fallback.monthlyBudgetRmb, fallback.monthlyBudgetRmb)
    ),
    userLimit: Math.max(
      1,
      Math.round(normalizePositiveNumber(value?.userLimit ?? fallback.userLimit, fallback.userLimit))
    ),
    perUserMonthlyBudgetRmb: roundCurrency(
      normalizePositiveNumber(
        value?.perUserMonthlyBudgetRmb ?? fallback.perUserMonthlyBudgetRmb,
        fallback.perUserMonthlyBudgetRmb
      )
    ),
    freeTrialCount: Math.max(
      1,
      Math.round(normalizePositiveNumber(value?.freeTrialCount ?? fallback.freeTrialCount, fallback.freeTrialCount))
    ),
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt,
    updatedByUserId: typeof value?.updatedByUserId === 'string' ? value.updatedByUserId : null,
  }
}

async function readLocalAiQuotaConfig() {
  const config = await readLocalJsonFile<AiQuotaConfig | null>(AI_QUOTA_CONFIG_FILE, null)
  return normalizeAiQuotaConfig(config)
}

async function writeLocalAiQuotaConfig(config: AiQuotaConfig) {
  await writeLocalJsonFile(AI_QUOTA_CONFIG_FILE, config)
}

async function readLocalAiUsageRecords() {
  return readLocalJsonFile<AiUsageRecord[]>(AI_USAGE_RECORDS_FILE, [])
}

async function writeLocalAiUsageRecords(records: AiUsageRecord[]) {
  await writeLocalJsonFile(AI_USAGE_RECORDS_FILE, records)
}

function sortUsageRecords(records: AiUsageRecord[]) {
  return [...records].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export function getCurrentAiUsageMonth(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function getEstimatedAiUseCost(config: Pick<AiQuotaConfig, 'perUserMonthlyBudgetRmb' | 'freeTrialCount'>) {
  return roundCurrency(config.perUserMonthlyBudgetRmb / Math.max(1, config.freeTrialCount))
}

export async function getAiQuotaConfig() {
  return withCloudBaseFallback(
    'getAiQuotaConfig',
    async () => {
      const config = await getCloudDocumentById<AiQuotaConfig>(AI_QUOTA_CONFIG_COLLECTION, DEFAULT_CONFIG_ID)

      if (!config) {
        const fallback = buildDefaultAiQuotaConfig()
        await putCloudDocument(AI_QUOTA_CONFIG_COLLECTION, DEFAULT_CONFIG_ID, fallback)
        return fallback
      }

      return normalizeAiQuotaConfig(config)
    },
    async () => readLocalAiQuotaConfig()
  )
}

export async function updateAiQuotaConfig(
  updater: (config: AiQuotaConfig) => AiQuotaConfig | Partial<AiQuotaConfig>
) {
  return withCloudBaseFallback(
    'updateAiQuotaConfig',
    async () => {
      const current = await getAiQuotaConfig()
      const nextConfig = normalizeAiQuotaConfig(updater(current))
      await putCloudDocument(AI_QUOTA_CONFIG_COLLECTION, DEFAULT_CONFIG_ID, nextConfig)
      return nextConfig
    },
    async () => {
      const current = await readLocalAiQuotaConfig()
      const nextConfig = normalizeAiQuotaConfig(updater(current))
      await writeLocalAiQuotaConfig(nextConfig)
      return nextConfig
    }
  )
}

export async function listAiUsageRecords(filters?: { month?: string; userId?: string }) {
  const month = filters?.month?.trim() || null
  const userId = filters?.userId?.trim() || null

  return withCloudBaseFallback(
    'listAiUsageRecords',
    async () => {
      const where: Record<string, string> = {}

      if (month) {
        where.month = month
      }

      if (userId) {
        where.userId = userId
      }

      return sortUsageRecords(
        await listCloudDocuments<AiUsageRecord>(AI_USAGE_RECORDS_COLLECTION, {
          where: Object.keys(where).length > 0 ? where : undefined,
          orderBy: { field: 'createdAt', direction: 'desc' },
        })
      )
    },
    async () => {
      let records = sortUsageRecords(await readLocalAiUsageRecords())

      if (month) {
        records = records.filter((record) => record.month === month)
      }

      if (userId) {
        records = records.filter((record) => record.userId === userId)
      }

      return records
    }
  )
}

export async function addAiUsageRecord(record: AiUsageRecord) {
  await withCloudBaseFallback(
    'addAiUsageRecord',
    async () => {
      await putCloudDocument(AI_USAGE_RECORDS_COLLECTION, record.id, record)
    },
    async () => {
      const records = await readLocalAiUsageRecords()
      records.unshift(record)
      await writeLocalAiUsageRecords(sortUsageRecords(records))
    }
  )

  return record
}

export async function getAiMonthlyUsageSummary(month = getCurrentAiUsageMonth()): Promise<AiMonthlyUsageSummary> {
  const records = await listAiUsageRecords({ month })
  const uniqueUsers = new Set(records.map((record) => record.userId))

  return {
    month,
    totalEstimatedSpendRmb: roundCurrency(
      records.reduce((sum, record) => sum + record.estimatedCostRmb, 0)
    ),
    totalUsageCount: records.length,
    activeUserCount: uniqueUsers.size,
  }
}
