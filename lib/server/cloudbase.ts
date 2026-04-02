import { promises as fs } from 'fs'
import path from 'path'

import * as cloudbase from '@cloudbase/node-sdk'

const DEFAULT_PAGE_SIZE = 100
const cloudFallbackWarnings = new Set<string>()
const ensuredCollections = new Set<string>()

type CloudDatabase = ReturnType<cloudbase.CloudBase['database']>

export interface CloudListOptions {
  where?: Record<string, unknown>
  orderBy?: {
    field: string
    direction?: 'asc' | 'desc'
  }
  limit?: number
}

let cachedApp: cloudbase.CloudBase | null | undefined
let cachedDb: CloudDatabase | null | undefined

function trimEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function shouldPreferLocalStorage() {
  return trimEnvValue(process.env.CLOUDBASE_PREFER_LOCAL) === '1'
}

function getCloudBaseAppConfig(): cloudbase.ICloudBaseConfig | null {
  const env = trimEnvValue(process.env.CLOUDBASE_ENV_ID)

  if (!env) {
    return null
  }

  const secretId = trimEnvValue(process.env.TENCENTCLOUD_SECRETID)
  const secretKey = trimEnvValue(process.env.TENCENTCLOUD_SECRETKEY)
  const sessionToken = trimEnvValue(process.env.TENCENTCLOUD_SESSIONTOKEN)
  const accessKey = trimEnvValue(process.env.CLOUDBASE_APIKEY)

  const config: cloudbase.ICloudBaseConfig = {
    env,
  }

  if (secretId && secretKey) {
    config.secretId = secretId
    config.secretKey = secretKey
  }

  if (sessionToken) {
    config.sessionToken = sessionToken
  }

  if (accessKey) {
    config.accessKey = accessKey
  }

  return config
}

function getCloudBaseDbConfig(): cloudbase.ICloudBaseDBConfig {
  const instance = trimEnvValue(process.env.CLOUDBASE_DATABASE_INSTANCE)
  const database = trimEnvValue(process.env.CLOUDBASE_DATABASE_NAME)

  const config: cloudbase.ICloudBaseDBConfig = {}

  if (instance) {
    config.instance = instance
  }

  if (database) {
    config.database = database
  }

  return config
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function warnCloudFallback(operation: string, error: unknown) {
  if (cloudFallbackWarnings.has(operation)) {
    return
  }

  cloudFallbackWarnings.add(operation)
  console.warn(`[cloudbase] ${operation} fell back to local storage: ${getErrorMessage(error)}`)
}

function sanitizeCloudValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeCloudValue(item))
  }

  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).flatMap(([key, item]) => {
      if (item === undefined) {
        return []
      }

      return [[key, sanitizeCloudValue(item)]]
    })

    return Object.fromEntries(entries)
  }

  return value
}

function sanitizeCloudObject(value: Record<string, unknown>) {
  return sanitizeCloudValue(value) as Record<string, unknown>
}

function normalizeCloudDocuments<T>(documents: unknown[]) {
  return documents.map((document) => {
    const normalized = document as Record<string, unknown>
    const { _id: _cloudDocumentId, ...rest } = normalized
    return rest as T
  })
}

function isCollectionExistsError(error: unknown) {
  const message = getErrorMessage(error)
  return /already exists?|已存在|table exists?|table exist|collection exists?|resource\s*exist|exists/i.test(message)
}

function getCollectionCacheKey(collectionName: string) {
  const env = trimEnvValue(process.env.CLOUDBASE_ENV_ID) ?? 'local'
  const database = trimEnvValue(process.env.CLOUDBASE_DATABASE_NAME) ?? 'default'
  const instance = trimEnvValue(process.env.CLOUDBASE_DATABASE_INSTANCE) ?? 'default'

  return [env, database, instance, collectionName].join(':')
}

function getCloudApp() {
  if (cachedApp !== undefined) {
    return cachedApp
  }

  const config = getCloudBaseAppConfig()

  if (!config) {
    cachedApp = null
    return cachedApp
  }

  cachedApp = cloudbase.init(config)
  return cachedApp
}

function getCloudDb() {
  if (cachedDb !== undefined) {
    return cachedDb
  }

  const app = getCloudApp()

  if (!app) {
    cachedDb = null
    return cachedDb
  }

  cachedDb = app.database(getCloudBaseDbConfig())
  return cachedDb
}

export function isCloudBaseEnabled() {
  return !shouldPreferLocalStorage() && getCloudBaseAppConfig() !== null
}

export function getCloudBaseRuntimeConfig() {
  return {
    enabled: isCloudBaseEnabled(),
    preferLocal: shouldPreferLocalStorage(),
    envId: trimEnvValue(process.env.CLOUDBASE_ENV_ID),
    databaseName: trimEnvValue(process.env.CLOUDBASE_DATABASE_NAME),
    databaseInstance: trimEnvValue(process.env.CLOUDBASE_DATABASE_INSTANCE),
  }
}

export function requireCloudDb() {
  const db = getCloudDb()

  if (!db) {
    throw new Error('CloudBase is not configured. Set CLOUDBASE_ENV_ID first.')
  }

  return db
}

export function requireCloudApp() {
  const app = getCloudApp()

  if (!app) {
    throw new Error('CloudBase is not configured. Set CLOUDBASE_ENV_ID first.')
  }

  return app
}

export async function uploadCloudFile(cloudPath: string, fileContent: Buffer) {
  const app = requireCloudApp()
  return app.uploadFile({
    cloudPath,
    fileContent,
  })
}

export async function getCloudTempFileUrl(fileID: string, maxAge = 3600) {
  const app = requireCloudApp()
  const result = await app.getTempFileURL({
    fileList: [
      {
        fileID,
        maxAge,
      },
    ],
  })

  return result.fileList?.[0]?.tempFileURL ?? null
}

export async function deleteCloudFile(fileID: string) {
  const app = requireCloudApp()
  return app.deleteFile({
    fileList: [fileID],
  })
}

async function ensureCloudCollection(collectionName: string) {
  const cacheKey = getCollectionCacheKey(collectionName)

  if (ensuredCollections.has(cacheKey)) {
    return
  }

  const db = requireCloudDb()

  try {
    await db.createCollection(collectionName)
  } catch (error) {
    if (!isCollectionExistsError(error)) {
      throw error
    }
  }

  ensuredCollections.add(cacheKey)
}

async function executeCloudQuery<T>(query: any, limit?: number) {
  const results: T[] = []
  let offset = 0
  let remaining = typeof limit === 'number' ? limit : null

  while (remaining === null || remaining > 0) {
    const pageSize = Math.min(remaining ?? DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE)
    const response = await query.skip(offset).limit(pageSize).get()
    const batch = normalizeCloudDocuments<T>((response.data ?? []) as unknown[])

    results.push(...batch)

    if (batch.length < pageSize) {
      break
    }

    offset += batch.length

    if (remaining !== null) {
      remaining -= batch.length
    }
  }

  return results
}

export async function listCloudDocuments<T>(collectionName: string, options: CloudListOptions = {}) {
  const db = requireCloudDb()
  await ensureCloudCollection(collectionName)

  let query: any = db.collection(collectionName)
  const where = options.where ? sanitizeCloudObject(options.where) : null

  if (where && Object.keys(where).length > 0) {
    query = query.where(where)
  }

  if (options.orderBy) {
    query = query.orderBy(options.orderBy.field, options.orderBy.direction ?? 'asc')
  }

  return executeCloudQuery<T>(query, options.limit)
}

export async function findCloudDocument<T>(collectionName: string, options: Omit<CloudListOptions, 'limit'>) {
  const documents = await listCloudDocuments<T>(collectionName, {
    ...options,
    limit: 1,
  })

  return documents[0] ?? null
}

export async function getCloudDocumentById<T>(collectionName: string, id: string) {
  const db = requireCloudDb()
  await ensureCloudCollection(collectionName)

  const response = await db.collection(collectionName).doc(id).get()
  const documents = normalizeCloudDocuments<T>((response.data ?? []) as unknown[])

  return documents[0] ?? null
}

export async function putCloudDocument<T extends object>(collectionName: string, id: string, value: T) {
  const db = requireCloudDb()
  await ensureCloudCollection(collectionName)

  await db.collection(collectionName).doc(id).set(sanitizeCloudObject(value as Record<string, unknown>))
}

export async function deleteCloudDocument(collectionName: string, id: string) {
  const db = requireCloudDb()
  await ensureCloudCollection(collectionName)

  await db.collection(collectionName).doc(id).remove()
}

export async function withCloudBaseFallback<T>(
  operation: string,
  cloudOperation: () => Promise<T>,
  localOperation: () => Promise<T>
) {
  if (!isCloudBaseEnabled()) {
    return localOperation()
  }

  try {
    return await cloudOperation()
  } catch (error) {
    warnCloudFallback(operation, error)
    return localOperation()
  }
}

export async function ensureLocalDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function readLocalJsonFile<T>(filePath: string, fallback: T): Promise<T> {
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

export async function writeLocalJsonFile(filePath: string, value: unknown) {
  await ensureLocalDir(path.dirname(filePath))
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function writeLocalBufferFile(filePath: string, buffer: Buffer) {
  await ensureLocalDir(path.dirname(filePath))
  await fs.writeFile(filePath, buffer)
}
