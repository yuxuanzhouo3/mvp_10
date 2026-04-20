import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

import * as cloudbase from '@cloudbase/node-sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { getRemoteDataProvider, isCnEdition, type RemoteDataProvider } from '@/lib/app-version'

const DEFAULT_PAGE_SIZE = 100
const cloudFallbackWarnings = new Set<string>()
const ensuredCollections = new Set<string>()

type CloudDatabase = ReturnType<cloudbase.CloudBase['database']>

type SupabaseDocumentsRow = {
  document: Record<string, unknown> | null
}

interface SupabaseRuntimeConfig {
  url: string
  serviceRoleKey: string
  schema: string
  documentsTable: string
  storageBucket: string
}

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
let cachedSupabase: SupabaseClient<any, any, any, any, any> | null | undefined

function trimEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function getRemoteProvider(): RemoteDataProvider {
  return getRemoteDataProvider()
}

function shouldPreferLocalStorage() {
  return (
    trimEnvValue(process.env.DATA_PREFER_LOCAL) === '1' ||
    trimEnvValue(process.env.CLOUDBASE_PREFER_LOCAL) === '1'
  )
}

function getDefaultLocalDataRoot() {
  if (process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), 'mvp_10-data')
  }

  return path.join(process.cwd(), 'data')
}

export function getLocalDataRoot() {
  return trimEnvValue(process.env.LOCAL_DATA_DIR) || getDefaultLocalDataRoot()
}

export function getLocalDataPath(...segments: string[]) {
  return path.join(getLocalDataRoot(), ...segments)
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

function getSupabaseConfig(): SupabaseRuntimeConfig | null {
  const url = trimEnvValue(process.env.SUPABASE_URL)
  const serviceRoleKey = trimEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!url || !serviceRoleKey) {
    return null
  }

  return {
    url,
    serviceRoleKey,
    schema: trimEnvValue(process.env.SUPABASE_SCHEMA) || 'public',
    documentsTable: trimEnvValue(process.env.SUPABASE_DOCUMENTS_TABLE) || 'app_documents',
    storageBucket: trimEnvValue(process.env.SUPABASE_STORAGE_BUCKET) || 'app-assets',
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function warnCloudFallback(operation: string, error: unknown) {
  const cacheKey = `${getRemoteProvider()}:${operation}`

  if (cloudFallbackWarnings.has(cacheKey)) {
    return
  }

  cloudFallbackWarnings.add(cacheKey)
  console.warn(`[${getRemoteProvider()}] ${operation} fell back to local storage: ${getErrorMessage(error)}`)
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
  return /already exists?|宸插瓨鍦▅table exists?|table exist|collection exists?|resource\s*exist|exists/i.test(message)
}

function getCollectionCacheKey(collectionName: string) {
  const provider = getRemoteProvider()
  const env = trimEnvValue(process.env.CLOUDBASE_ENV_ID) ?? trimEnvValue(process.env.SUPABASE_URL) ?? 'local'
  const database = trimEnvValue(process.env.CLOUDBASE_DATABASE_NAME) ?? trimEnvValue(process.env.SUPABASE_DOCUMENTS_TABLE) ?? 'default'
  const instance = trimEnvValue(process.env.CLOUDBASE_DATABASE_INSTANCE) ?? trimEnvValue(process.env.SUPABASE_SCHEMA) ?? 'default'

  return [provider, env, database, instance, collectionName].join(':')
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

function getSupabaseClient() {
  if (cachedSupabase !== undefined) {
    return cachedSupabase
  }

  const config = getSupabaseConfig()

  if (!config) {
    cachedSupabase = null
    return cachedSupabase
  }

  cachedSupabase = createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: config.schema,
    },
  })

  return cachedSupabase
}

export function isCloudBaseEnabled() {
  return !shouldPreferLocalStorage() && getRemoteProvider() === 'cloudbase' && getCloudBaseAppConfig() !== null
}

export function isSupabaseEnabled() {
  return !shouldPreferLocalStorage() && getRemoteProvider() === 'supabase' && getSupabaseConfig() !== null
}

function isRemoteStorageEnabled() {
  return isCloudBaseEnabled() || isSupabaseEnabled()
}

export function getCloudBaseRuntimeConfig() {
  const supabaseConfig = getSupabaseConfig()

  return {
    edition: isCnEdition() ? 'cn' : 'global',
    provider: getRemoteProvider(),
    enabled: isRemoteStorageEnabled(),
    preferLocal: shouldPreferLocalStorage(),
    envId: trimEnvValue(process.env.CLOUDBASE_ENV_ID),
    databaseName: trimEnvValue(process.env.CLOUDBASE_DATABASE_NAME),
    databaseInstance: trimEnvValue(process.env.CLOUDBASE_DATABASE_INSTANCE),
    supabaseUrl: supabaseConfig?.url ?? null,
    supabaseSchema: supabaseConfig?.schema ?? null,
    supabaseDocumentsTable: supabaseConfig?.documentsTable ?? null,
    supabaseStorageBucket: supabaseConfig?.storageBucket ?? null,
  }
}

function requireSupabaseConfig() {
  const config = getSupabaseConfig()

  if (!config) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.')
  }

  return config
}

function requireSupabaseClient() {
  const client = getSupabaseClient()

  if (!client) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.')
  }

  return client
}

export function requireCloudDb() {
  if (getRemoteProvider() !== 'cloudbase') {
    throw new Error('CloudBase is not the active remote provider for the current edition.')
  }

  const db = getCloudDb()

  if (!db) {
    throw new Error('CloudBase is not configured. Set CLOUDBASE_ENV_ID first.')
  }

  return db
}

export function requireCloudApp() {
  if (getRemoteProvider() !== 'cloudbase') {
    throw new Error('CloudBase is not the active remote provider for the current edition.')
  }

  const app = getCloudApp()

  if (!app) {
    throw new Error('CloudBase is not configured. Set CLOUDBASE_ENV_ID first.')
  }

  return app
}

export async function uploadCloudFile(cloudPath: string, fileContent: Buffer) {
  if (isSupabaseEnabled()) {
    const client = requireSupabaseClient()
    const config = requireSupabaseConfig()
    const { data, error } = await client.storage.from(config.storageBucket).upload(cloudPath, fileContent, {
      upsert: true,
    })

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`)
    }

    return {
      fileID: data?.path ?? cloudPath,
    }
  }

  const app = requireCloudApp()
  return app.uploadFile({
    cloudPath,
    fileContent,
  })
}

export async function getCloudTempFileUrl(fileID: string, maxAge = 3600) {
  if (isSupabaseEnabled()) {
    const client = requireSupabaseClient()
    const config = requireSupabaseConfig()
    const { data, error } = await client.storage.from(config.storageBucket).createSignedUrl(fileID, maxAge)

    if (error) {
      throw new Error(`Supabase signed URL creation failed: ${error.message}`)
    }

    return data?.signedUrl ?? null
  }

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
  if (isSupabaseEnabled()) {
    const client = requireSupabaseClient()
    const config = requireSupabaseConfig()
    const { error } = await client.storage.from(config.storageBucket).remove([fileID])

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`)
    }

    return
  }

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

function compareDocumentValues(left: unknown, right: unknown) {
  if (left === right) {
    return 0
  }

  if (left === undefined || left === null) {
    return -1
  }

  if (right === undefined || right === null) {
    return 1
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  const leftDate = typeof left === 'string' ? Date.parse(left) : Number.NaN
  const rightDate = typeof right === 'string' ? Date.parse(right) : Number.NaN

  if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
    return leftDate - rightDate
  }

  return String(left).localeCompare(String(right), 'en')
}

function applyDocumentOrder<T>(documents: T[], orderBy: CloudListOptions['orderBy']) {
  if (!orderBy) {
    return documents
  }

  const direction = orderBy.direction === 'desc' ? -1 : 1

  return [...documents].sort((left, right) => {
    const leftValue = (left as Record<string, unknown>)[orderBy.field]
    const rightValue = (right as Record<string, unknown>)[orderBy.field]
    return compareDocumentValues(leftValue, rightValue) * direction
  })
}

function normalizeSupabaseDocuments<T>(rows: SupabaseDocumentsRow[]) {
  return rows
    .map((row) => row.document)
    .filter((document): document is Record<string, unknown> => Boolean(document))
    .map((document) => document as T)
}

async function listSupabaseDocuments<T>(collectionName: string, options: CloudListOptions = {}) {
  const client = requireSupabaseClient()
  const config = requireSupabaseConfig()
  const where = options.where ? sanitizeCloudObject(options.where) : null
  const rows: SupabaseDocumentsRow[] = []
  let offset = 0

  while (true) {
    let query = client
      .from(config.documentsTable)
      .select('document')
      .eq('collection', collectionName)
      .range(offset, offset + DEFAULT_PAGE_SIZE - 1)

    if (where && Object.keys(where).length > 0) {
      query = query.contains('document', where)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`)
    }

    const batch = (data ?? []) as SupabaseDocumentsRow[]
    rows.push(...batch)

    if (batch.length < DEFAULT_PAGE_SIZE) {
      break
    }

    offset += batch.length
  }

  const documents = applyDocumentOrder(normalizeSupabaseDocuments<T>(rows), options.orderBy)
  return typeof options.limit === 'number' ? documents.slice(0, options.limit) : documents
}

async function getSupabaseDocumentById<T>(collectionName: string, id: string) {
  const client = requireSupabaseClient()
  const config = requireSupabaseConfig()
  const { data, error } = await client
    .from(config.documentsTable)
    .select('document')
    .eq('collection', collectionName)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`Supabase get failed: ${error.message}`)
  }

  return (data?.document as T | null | undefined) ?? null
}

async function putSupabaseDocument<T extends object>(collectionName: string, id: string, value: T) {
  const client = requireSupabaseClient()
  const config = requireSupabaseConfig()
  const { error } = await client.from(config.documentsTable).upsert(
    {
      collection: collectionName,
      id,
      document: sanitizeCloudObject(value as Record<string, unknown>),
    },
    {
      onConflict: 'collection,id',
    }
  )

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`)
  }
}

async function deleteSupabaseDocument(collectionName: string, id: string) {
  const client = requireSupabaseClient()
  const config = requireSupabaseConfig()
  const { error } = await client.from(config.documentsTable).delete().eq('collection', collectionName).eq('id', id)

  if (error) {
    throw new Error(`Supabase delete failed: ${error.message}`)
  }
}

export async function listCloudDocuments<T>(collectionName: string, options: CloudListOptions = {}) {
  if (isSupabaseEnabled()) {
    return listSupabaseDocuments<T>(collectionName, options)
  }

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
  if (isSupabaseEnabled()) {
    return getSupabaseDocumentById<T>(collectionName, id)
  }

  const db = requireCloudDb()
  await ensureCloudCollection(collectionName)

  const response = await db.collection(collectionName).doc(id).get()
  const documents = normalizeCloudDocuments<T>((response.data ?? []) as unknown[])

  return documents[0] ?? null
}

export async function putCloudDocument<T extends object>(collectionName: string, id: string, value: T) {
  if (isSupabaseEnabled()) {
    await putSupabaseDocument(collectionName, id, value)
    return
  }

  const db = requireCloudDb()
  await ensureCloudCollection(collectionName)

  await db.collection(collectionName).doc(id).set(sanitizeCloudObject(value as Record<string, unknown>))
}

export async function deleteCloudDocument(collectionName: string, id: string) {
  if (isSupabaseEnabled()) {
    await deleteSupabaseDocument(collectionName, id)
    return
  }

  const db = requireCloudDb()
  await ensureCloudCollection(collectionName)

  await db.collection(collectionName).doc(id).remove()
}

export async function withCloudBaseFallback<T>(
  operation: string,
  cloudOperation: () => Promise<T>,
  localOperation: () => Promise<T>
) {
  if (!isRemoteStorageEnabled()) {
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
