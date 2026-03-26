import { promises as fs } from 'fs'
import path from 'path'

import type { JobRecord, JobStatus } from '@/types/job'

const DATA_DIR = path.join(process.cwd(), 'data', 'jobs')
const INDEX_FILE = path.join(DATA_DIR, 'index.json')

const DEFAULT_JOBS: JobRecord[] = [
  {
    id: 'job-ml-platform-01',
    createdAt: '2026-03-23T08:00:00.000Z',
    updatedAt: '2026-03-23T08:00:00.000Z',
    title: 'AI Platform Engineer',
    company: 'Tencent Cloud AI',
    companyTagline: 'Build reliable model serving and evaluation pipelines.',
    status: 'published',
    contactEmail: 'ai-platform@tencent.example.com',
    location: 'Shenzhen, China',
    locationMode: 'hybrid',
    salaryMin: 320000,
    salaryMax: 480000,
    currency: 'CNY',
    type: 'Full-time',
    postedAt: '2026-03-23T08:00:00.000Z',
    industries: ['Technology', 'AI/ML', 'Cloud'],
    requiredSkills: ['Python', 'SQL', 'Docker', 'Machine Learning'],
    preferredSkills: ['Kubernetes', 'LLM', 'Evaluation'],
    minYearsExperience: 1,
    seniority: 'mid',
    description: 'Design internal tooling for model deployment, experiment tracking, and LLM evaluation.',
    highlights: ['Hybrid team', 'Mentored ramp-up', 'Production AI systems'],
  },
  {
    id: 'job-data-science-02',
    createdAt: '2026-03-22T08:00:00.000Z',
    updatedAt: '2026-03-22T08:00:00.000Z',
    title: 'Junior Data Scientist',
    company: 'ByteDance Growth',
    companyTagline: 'Use experimentation and analytics to shape product decisions.',
    status: 'published',
    contactEmail: 'growth-hiring@bytedance.example.com',
    location: 'Shanghai, China',
    locationMode: 'onsite',
    salaryMin: 220000,
    salaryMax: 320000,
    currency: 'CNY',
    type: 'Full-time',
    postedAt: '2026-03-22T08:00:00.000Z',
    industries: ['Technology', 'AI/ML', 'Consumer Internet'],
    requiredSkills: ['Python', 'SQL', 'Data Analysis', 'Statistics'],
    preferredSkills: ['Experimentation', 'Machine Learning', 'Tableau'],
    minYearsExperience: 0,
    seniority: 'entry',
    description: 'Partner with product teams to analyze funnels, measure experiments, and translate data into action.',
    highlights: ['Strong analyst mentorship', 'Fast product cycles', 'Clear progression path'],
  },
  {
    id: 'job-llm-applied-03',
    createdAt: '2026-03-24T02:00:00.000Z',
    updatedAt: '2026-03-24T02:00:00.000Z',
    title: 'Applied LLM Engineer',
    company: 'MiniMax',
    companyTagline: 'Ship LLM-powered product experiences for global users.',
    status: 'published',
    contactEmail: 'llm-hiring@minimax.example.com',
    location: 'Beijing, China',
    locationMode: 'hybrid',
    salaryMin: 380000,
    salaryMax: 560000,
    currency: 'CNY',
    type: 'Full-time',
    postedAt: '2026-03-24T02:00:00.000Z',
    industries: ['AI/ML', 'Technology'],
    requiredSkills: ['Python', 'LLM', 'Prompting', 'Evaluation'],
    preferredSkills: ['Deep Learning', 'AWS', 'Node.js'],
    minYearsExperience: 2,
    seniority: 'senior',
    description: 'Prototype prompt workflows, optimize inference quality, and partner closely with product and research.',
    highlights: ['Frontier AI use cases', 'User-facing product work', 'Cross-functional role'],
  },
  {
    id: 'job-frontend-ai-04',
    createdAt: '2026-03-21T09:00:00.000Z',
    updatedAt: '2026-03-21T09:00:00.000Z',
    title: 'AI Product Frontend Engineer',
    company: 'Moonshot AI',
    companyTagline: 'Create polished interfaces for AI-native products.',
    status: 'published',
    contactEmail: 'frontend-hiring@moonshot.example.com',
    location: 'Remote, China',
    locationMode: 'remote',
    salaryMin: 260000,
    salaryMax: 420000,
    currency: 'CNY',
    type: 'Full-time',
    postedAt: '2026-03-21T09:00:00.000Z',
    industries: ['Technology', 'AI/ML'],
    requiredSkills: ['JavaScript', 'TypeScript', 'React', 'Next.js'],
    preferredSkills: ['LLM', 'Node.js', 'Figma'],
    minYearsExperience: 1,
    seniority: 'mid',
    description: 'Own AI workflow interfaces from exploration to release, with attention to product clarity and speed.',
    highlights: ['Remote-first', 'Fast shipping culture', 'Direct product ownership'],
  },
  {
    id: 'job-qa-ai-05',
    createdAt: '2026-03-20T07:30:00.000Z',
    updatedAt: '2026-03-20T07:30:00.000Z',
    title: 'AI Test Engineer',
    company: 'Baidu Intelligent Cloud',
    companyTagline: 'Raise the quality bar for AI and cloud product delivery.',
    status: 'published',
    contactEmail: 'qa-hiring@baidu.example.com',
    location: 'Guangzhou, China',
    locationMode: 'onsite',
    salaryMin: 180000,
    salaryMax: 260000,
    currency: 'CNY',
    type: 'Full-time',
    postedAt: '2026-03-20T07:30:00.000Z',
    industries: ['Technology', 'Cloud'],
    requiredSkills: ['Python', 'SQL', 'Testing', 'Data Analysis'],
    preferredSkills: ['Machine Learning', 'Linux', 'Automation'],
    minYearsExperience: 0,
    seniority: 'entry',
    description: 'Build automated test coverage for AI workflows and partner with product and engineering to catch failures early.',
    highlights: ['Entry-friendly', 'Automation focus', 'Structured growth path'],
  },
]

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

function normalizeJob(record: JobRecord): JobRecord {
  return {
    ...record,
    createdAt: record.createdAt ?? record.postedAt,
    updatedAt: record.updatedAt ?? record.postedAt,
    status: (record.status ?? 'published') as JobStatus,
    contactEmail: record.contactEmail ?? null,
    requiredSkills: Array.from(new Set(record.requiredSkills.map((item) => item.trim()).filter(Boolean))),
    preferredSkills: Array.from(new Set(record.preferredSkills.map((item) => item.trim()).filter(Boolean))),
    industries: Array.from(new Set(record.industries.map((item) => item.trim()).filter(Boolean))),
    highlights: Array.from(new Set(record.highlights.map((item) => item.trim()).filter(Boolean))),
  }
}

async function readJobs() {
  const records = await readJsonFile<JobRecord[]>(INDEX_FILE, DEFAULT_JOBS)
  return records.map(normalizeJob)
}

async function writeJobs(records: JobRecord[]) {
  await writeJsonFile(INDEX_FILE, records)
}

export async function listJobs() {
  const records = await readJobs()
  return records.sort((left, right) => new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime())
}

export async function listPublishedJobs() {
  const records = await listJobs()
  return records.filter((record) => record.status === 'published')
}

export async function addJob(record: JobRecord) {
  const records = await listJobs()
  records.unshift(normalizeJob(record))
  await writeJobs(records)
}

export async function getJobById(id: string) {
  const records = await readJobs()
  return records.find((record) => record.id === id) ?? null
}

export async function updateJob(id: string, updater: (record: JobRecord) => JobRecord) {
  const records = await readJobs()
  const index = records.findIndex((record) => record.id === id)

  if (index === -1) {
    return null
  }

  records[index] = normalizeJob(updater(records[index]))
  await writeJobs(records)
  return records[index]
}
