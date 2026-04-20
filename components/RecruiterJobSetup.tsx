'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Briefcase, ChevronDown, Loader2, Save, Sparkles } from 'lucide-react'

import {
  jobLocationModeLabel,
  jobSeniorityLabel,
  jobStatusLabel,
  jobTypeLabel,
  pickLanguage,
} from '@/lib/i18n'
import { getStoredAuthToken } from './AuthProvider'
import { useLanguage } from './LanguageProvider'
import type { JobLocationMode, JobRecord, JobSeniority, JobStatus, JobType } from '@/types/job'

function authHeaders(json = false) {
  const token = getStoredAuthToken()
  if (!token) {
    throw new Error('Please sign in again.')
  }

  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  }
}

function splitList(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function emptyForm() {
  return {
    title: '',
    company: '',
    companyTagline: '',
    location: '',
    locationMode: 'onsite' as JobLocationMode,
    salaryMin: '15000',
    salaryMax: '30000',
    type: 'Full-time' as JobType,
    seniority: 'mid' as JobSeniority,
    minYearsExperience: '1',
    status: 'published' as JobStatus,
    description: '',
    requiredSkills: '',
    preferredSkills: '',
    highlights: '',
    contactEmail: '',
  }
}

function statusTone(status: JobStatus) {
  switch (status) {
    case 'published':
      return 'bg-emerald-100 text-emerald-700'
    case 'closed':
      return 'bg-slate-200 text-slate-700'
    case 'draft':
    default:
      return 'bg-amber-100 text-amber-700'
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-2">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </div>
      {children}
    </label>
  )
}

export function RecruiterJobSetup() {
  const { language } = useLanguage()
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  )

  const copy = {
    listFailed: pickLanguage(language, '岗位列表加载失败。', 'Failed to load jobs.'),
    saveFailed: pickLanguage(language, '岗位保存失败。', 'Failed to save the job.'),
    requiredFields: pickLanguage(
      language,
      '请先补全岗位名称、公司名称和岗位描述。',
      'Please fill in the title, company, and job description first.'
    ),
    salaryRangeError: pickLanguage(
      language,
      '最高薪资不能低于最低薪资。',
      'Max salary cannot be lower than min salary.'
    ),
    savePublished: pickLanguage(
      language,
      '岗位已保存并同步到求职者岗位列表。',
      'Job saved and synced to the candidate-facing job list.'
    ),
    saveDraft: pickLanguage(language, '岗位已保存为草稿。', 'Job saved as draft.'),
    loading: pickLanguage(language, '正在加载岗位管理页...', 'Loading job management...'),
    title: pickLanguage(language, '岗位创建与发布', 'Create & Publish Jobs'),
    heading: pickLanguage(
      language,
      '先把岗位写清楚，求职者端才会准确看到并投递。',
      'Define the role clearly so candidates can find it and apply with confidence.'
    ),
    description: pickLanguage(
      language,
      '这里会明确标注每个字段要填写什么。岗位默认可直接发布；如果你暂时不想同步到求职者端，可以改成草稿。',
      'Each field explains what should go in it. Roles can be published by default, or saved as drafts if you are not ready to show them to candidates.'
    ),
    refresh: pickLanguage(language, '刷新岗位', 'Refresh Jobs'),
    total: pickLanguage(language, '岗位总数', 'Total Jobs'),
    published: pickLanguage(language, '已发布', 'Published'),
    draft: pickLanguage(language, '草稿', 'Drafts'),
    closed: pickLanguage(language, '已关闭', 'Closed'),
    newJob: pickLanguage(language, '新建岗位', 'New Job'),
    emptyState: pickLanguage(language, '还没有岗位，先创建第一个岗位。', 'No jobs yet. Create the first role to get started.'),
    editTitle: pickLanguage(language, '编辑岗位', 'Edit Job'),
    createTitle: pickLanguage(language, '创建岗位', 'Create Job'),
    formDescription: pickLanguage(
      language,
      '招聘方创建并保存后，如果状态为“已发布”，求职者岗位推荐页会同步看到该岗位。',
      'Once saved as Published, the role becomes visible on the candidate recommendation page.'
    ),
    saving: pickLanguage(language, '保存中...', 'Saving...'),
    save: pickLanguage(language, '保存岗位', 'Save Job'),
    extraInfo: pickLanguage(language, '展开补充信息', 'Expand Additional Details'),
  }

  const stats = useMemo(() => {
    return {
      total: jobs.length,
      published: jobs.filter((job) => job.status === 'published').length,
      draft: jobs.filter((job) => job.status === 'draft').length,
      closed: jobs.filter((job) => job.status === 'closed').length,
    }
  }, [jobs])

  useEffect(() => {
    void loadJobs()
  }, [])

  useEffect(() => {
    if (!selectedJob) {
      setForm(emptyForm())
      return
    }

    setForm({
      title: selectedJob.title,
      company: selectedJob.company,
      companyTagline: selectedJob.companyTagline,
      location: selectedJob.location,
      locationMode: selectedJob.locationMode,
      salaryMin: String(selectedJob.salaryMin),
      salaryMax: String(selectedJob.salaryMax),
      type: selectedJob.type,
      seniority: selectedJob.seniority,
      minYearsExperience: String(selectedJob.minYearsExperience),
      status: selectedJob.status,
      description: selectedJob.description,
      requiredSkills: selectedJob.requiredSkills.join('，'),
      preferredSkills: selectedJob.preferredSkills.join('，'),
      highlights: selectedJob.highlights.join('，'),
      contactEmail: selectedJob.contactEmail ?? '',
    })
  }, [selectedJob])

  async function loadJobs() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/jobs?scope=mine', {
        cache: 'no-store',
        headers: authHeaders(),
      })
      const payload = (await response.json()) as JobRecord[] | { error?: string }

      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(!Array.isArray(payload) && payload.error ? payload.error : copy.listFailed)
      }

      setJobs(payload)
      setSelectedJobId((current) => current ?? payload[0]?.id ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.listFailed)
    } finally {
      setLoading(false)
    }
  }

  function resetForCreate() {
    setSelectedJobId(null)
    setForm(emptyForm())
    setMessage('')
    setError('')
  }

  async function saveJob() {
    try {
      if (!form.title.trim() || !form.company.trim() || !form.description.trim()) {
        throw new Error(copy.requiredFields)
      }

      if (Number(form.salaryMax) < Number(form.salaryMin)) {
        throw new Error(copy.salaryRangeError)
      }

      setSaving(true)
      setError('')
      setMessage('')

      const response = await fetch(selectedJob ? `/api/jobs/${selectedJob.id}` : '/api/jobs', {
        method: selectedJob ? 'PATCH' : 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          ...form,
          salaryMin: Number(form.salaryMin),
          salaryMax: Number(form.salaryMax),
          minYearsExperience: Number(form.minYearsExperience),
          currency: 'CNY',
          industries: [],
          highlights: splitList(form.highlights),
          requiredSkills: splitList(form.requiredSkills),
          preferredSkills: splitList(form.preferredSkills),
        }),
      })

      const payload = (await response.json()) as JobRecord | { error?: string }
      if (!response.ok || !('id' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : copy.saveFailed)
      }

      setJobs((current) => [payload, ...current.filter((item) => item.id !== payload.id)])
      setSelectedJobId(payload.id)
      setMessage(payload.status === 'published' ? copy.savePublished : copy.saveDraft)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">{copy.loading}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#eef6ff)] p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700">
            <Sparkles className="h-4 w-4" />
            <span>{copy.title}</span>
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900">{copy.heading}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">{copy.description}</p>
        </div>
        <button onClick={() => void loadJobs()} className="btn-secondary">
          {copy.refresh}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">{copy.total}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.published}</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{stats.published}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.draft}</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700">{stats.draft}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.closed}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-700">{stats.closed}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="card space-y-3">
          <button onClick={resetForCreate} className="btn-primary w-full">
            {copy.newJob}
          </button>

          {jobs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
              {copy.emptyState}
            </div>
          )}

          {jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJobId(job.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selectedJobId === job.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{job.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{job.company}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusTone(job.status)}`}>
                  {jobStatusLabel(job.status, language)}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary-600" />
                <h3 className="text-xl font-semibold text-slate-900">
                  {selectedJob ? copy.editTitle : copy.createTitle}
                </h3>
              </div>
              <p className="mt-2 text-sm text-slate-500">{copy.formDescription}</p>
            </div>
            <button onClick={() => void saveJob()} className="btn-primary flex items-center gap-2" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{saving ? copy.saving : copy.save}</span>
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field
              label={pickLanguage(language, '岗位名称', 'Job Title')}
              hint={pickLanguage(language, '例：前端工程师、AI 算法工程师、数据分析师', 'Examples: Frontend Engineer, AI Engineer, Data Analyst')}
            >
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="input-field"
                placeholder={pickLanguage(language, '请输入岗位名称', 'Enter the job title')}
              />
            </Field>

            <Field
              label={pickLanguage(language, '公司名称', 'Company Name')}
              hint={pickLanguage(language, '求职者投递时看到的公司名称', 'The company name visible to candidates')}
            >
              <input
                value={form.company}
                onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
                className="input-field"
                placeholder={pickLanguage(language, '请输入公司名称', 'Enter the company name')}
              />
            </Field>

            <Field
              label={pickLanguage(language, '公司一句话介绍', 'Company Tagline')}
              hint={pickLanguage(language, '可选，用一句话介绍团队或业务方向', 'Optional. Describe the team or business in one sentence')}
            >
              <input
                value={form.companyTagline}
                onChange={(event) => setForm((current) => ({ ...current, companyTagline: event.target.value }))}
                className="input-field"
                placeholder={pickLanguage(language, '例如：负责企业级 AI 生产工具', 'For example: Building enterprise AI productivity tools')}
              />
            </Field>

            <Field
              label={pickLanguage(language, '招聘联系邮箱', 'Recruiting Contact Email')}
              hint={pickLanguage(language, '求职者和系统通知默认使用的联系邮箱', 'The default contact email for candidates and system notices')}
            >
              <input
                value={form.contactEmail}
                onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
                className="input-field"
                placeholder={pickLanguage(language, '请输入招聘邮箱', 'Enter the recruiting email')}
              />
            </Field>

            <Field
              label={pickLanguage(language, '工作地点', 'Location')}
              hint={pickLanguage(language, '例：上海、深圳南山、远程中国区', 'Examples: Shanghai, Shenzhen Nanshan, Remote in APAC')}
            >
              <input
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                className="input-field"
                placeholder={pickLanguage(language, '请输入工作地点', 'Enter the work location')}
              />
            </Field>

            <Field
              label={pickLanguage(language, '办公方式', 'Work Mode')}
              hint={pickLanguage(language, '会直接展示给求职者做筛选', 'Shown directly to candidates for filtering')}
            >
              <select
                value={form.locationMode}
                onChange={(event) => setForm((current) => ({ ...current, locationMode: event.target.value as JobLocationMode }))}
                className="input-field"
              >
                <option value="onsite">{jobLocationModeLabel('onsite', language)}</option>
                <option value="hybrid">{jobLocationModeLabel('hybrid', language)}</option>
                <option value="remote">{jobLocationModeLabel('remote', language)}</option>
              </select>
            </Field>

            <Field
              label={pickLanguage(language, '最低薪资', 'Min Salary')}
              hint={pickLanguage(language, '建议填月薪或年包的下限，求职者可按范围筛选', 'Set the lower end of the range candidates can filter by')}
            >
              <input
                value={form.salaryMin}
                onChange={(event) => setForm((current) => ({ ...current, salaryMin: event.target.value }))}
                className="input-field"
                placeholder={pickLanguage(language, '例如 15000', 'For example 15000')}
              />
            </Field>

            <Field
              label={pickLanguage(language, '最高薪资', 'Max Salary')}
              hint={pickLanguage(language, '建议与最低薪资保持同一口径', 'Use the same unit as the min salary')}
            >
              <input
                value={form.salaryMax}
                onChange={(event) => setForm((current) => ({ ...current, salaryMax: event.target.value }))}
                className="input-field"
                placeholder={pickLanguage(language, '例如 30000', 'For example 30000')}
              />
            </Field>

            <Field
              label={pickLanguage(language, '岗位类型', 'Employment Type')}
              hint={pickLanguage(language, '全职、实习、兼职等', 'Full-time, internship, part-time, and so on')}
            >
              <select
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as JobType }))}
                className="input-field"
              >
                <option value="Full-time">{jobTypeLabel('Full-time', language)}</option>
                <option value="Part-time">{jobTypeLabel('Part-time', language)}</option>
                <option value="Contract">{jobTypeLabel('Contract', language)}</option>
                <option value="Internship">{jobTypeLabel('Internship', language)}</option>
              </select>
            </Field>

            <Field
              label={pickLanguage(language, '岗位级别', 'Seniority')}
              hint={pickLanguage(language, '帮助系统做匹配和 AI 出题', 'Helps matching and AI question generation')}
            >
              <select
                value={form.seniority}
                onChange={(event) => setForm((current) => ({ ...current, seniority: event.target.value as JobSeniority }))}
                className="input-field"
              >
                <option value="entry">{jobSeniorityLabel('entry', language)}</option>
                <option value="mid">{jobSeniorityLabel('mid', language)}</option>
                <option value="senior">{jobSeniorityLabel('senior', language)}</option>
                <option value="lead">{jobSeniorityLabel('lead', language)}</option>
              </select>
            </Field>

            <Field
              label={pickLanguage(language, '最低经验要求', 'Minimum Experience')}
              hint={pickLanguage(language, '填写大致年限，AI 初筛会参考这一项', 'Roughly how many years of experience the role needs')}
            >
              <input
                value={form.minYearsExperience}
                onChange={(event) => setForm((current) => ({ ...current, minYearsExperience: event.target.value }))}
                className="input-field"
                placeholder={pickLanguage(language, '例如 3', 'For example 3')}
              />
            </Field>

            <Field
              label={pickLanguage(language, '岗位状态', 'Job Status')}
              hint={pickLanguage(language, '已发布会同步给求职者；草稿不会出现在求职者端', 'Published roles are visible to candidates. Drafts are not.')}
            >
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as JobStatus }))}
                className="input-field"
              >
                <option value="published">{jobStatusLabel('published', language)}</option>
                <option value="draft">{jobStatusLabel('draft', language)}</option>
                <option value="closed">{jobStatusLabel('closed', language)}</option>
              </select>
            </Field>

            <Field
              label={pickLanguage(language, '岗位描述', 'Job Description')}
              hint={pickLanguage(language, '这里建议写清岗位职责、业务场景，以及候选人必须掌握的技能方向', 'Explain responsibilities, business context, and the core skills candidates need')}
            >
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={7}
                className="input-field"
                placeholder={pickLanguage(
                  language,
                  '请输入岗位职责、岗位需求、候选人需要会的技能，以及你希望招到的人',
                  'Describe responsibilities, requirements, critical skills, and the kind of candidate you want to hire'
                )}
              />
            </Field>
          </div>

          <details className="mt-6 rounded-2xl bg-slate-50 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
              {copy.extraInfo}
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </summary>

            <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field
                label={pickLanguage(language, '必须技能', 'Required Skills')}
                hint={pickLanguage(language, '招聘方筛选候选人和 AI 出题都会优先参考', 'Used by both candidate screening and AI question generation')}
              >
                <input
                  value={form.requiredSkills}
                  onChange={(event) => setForm((current) => ({ ...current, requiredSkills: event.target.value }))}
                  className="input-field"
                  placeholder={pickLanguage(language, '例如 React，TypeScript，Next.js', 'For example React, TypeScript, Next.js')}
                />
              </Field>

              <Field
                label={pickLanguage(language, '加分技能', 'Preferred Skills')}
                hint={pickLanguage(language, '有最好，没有也不影响投递', 'Nice to have, but not strictly required')}
              >
                <input
                  value={form.preferredSkills}
                  onChange={(event) => setForm((current) => ({ ...current, preferredSkills: event.target.value }))}
                  className="input-field"
                  placeholder={pickLanguage(language, '例如 LLM，Node.js，Figma', 'For example LLM, Node.js, Figma')}
                />
              </Field>

              <Field
                label={pickLanguage(language, '岗位亮点', 'Role Highlights')}
                hint={pickLanguage(language, '展示给求职者看的卖点，例如远程、成长空间、导师机制', 'Candidate-facing selling points like remote work or growth opportunities')}
              >
                <input
                  value={form.highlights}
                  onChange={(event) => setForm((current) => ({ ...current, highlights: event.target.value }))}
                  className="input-field"
                  placeholder={pickLanguage(language, '例如 双休，远程协作，成长空间大', 'For example flexible schedule, remote collaboration, strong growth path')}
                />
              </Field>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
