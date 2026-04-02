'use client'

import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Loader2, Plus, Save, Users } from 'lucide-react'

import { getStoredAuthToken } from './AuthProvider'
import type { ApplicationRecord, ApplicationStage } from '@/types/application'
import type { JobLocationMode, JobRecord, JobSeniority, JobStatus, JobType } from '@/types/job'

const JOB_TYPES: JobType[] = ['Full-time', 'Part-time', 'Contract', 'Internship']
const LOCATION_MODES: JobLocationMode[] = ['remote', 'hybrid', 'onsite']
const SENIORITIES: JobSeniority[] = ['entry', 'mid', 'senior', 'lead']
const STATUSES: JobStatus[] = ['draft', 'published', 'closed']
const APPLICATION_STAGES: ApplicationStage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn']

function createEmptyJobForm() {
  return {
    title: '',
    company: '',
    companyTagline: '',
    status: 'draft' as JobStatus,
    contactEmail: '',
    location: 'Remote, China',
    locationMode: 'remote' as JobLocationMode,
    salaryMin: '200000',
    salaryMax: '300000',
    currency: 'CNY' as 'CNY' | 'USD',
    type: 'Full-time' as JobType,
    industries: 'Technology, AI/ML',
    requiredSkills: 'Python, SQL',
    preferredSkills: '',
    minYearsExperience: '0',
    seniority: 'entry' as JobSeniority,
    description: '',
    highlights: '',
  }
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function stageLabel(stage: ApplicationStage) {
  switch (stage) {
    case 'applied':
      return 'Applied'
    case 'screening':
      return 'Screening'
    case 'interview':
      return 'Interview'
    case 'offer':
      return 'Offer'
    case 'hired':
      return 'Hired'
    case 'rejected':
      return 'Rejected'
    case 'withdrawn':
      return 'Withdrawn'
    default:
      return stage
  }
}

function stagePill(stage: ApplicationStage) {
  switch (stage) {
    case 'screening':
      return 'bg-sky-100 text-sky-700'
    case 'interview':
      return 'bg-violet-100 text-violet-700'
    case 'offer':
      return 'bg-amber-100 text-amber-700'
    case 'hired':
      return 'bg-emerald-100 text-emerald-700'
    case 'rejected':
      return 'bg-rose-100 text-rose-700'
    case 'withdrawn':
      return 'bg-slate-100 text-slate-700'
    default:
      return 'bg-blue-100 text-blue-700'
  }
}

function upsertApplication(records: ApplicationRecord[], next: ApplicationRecord) {
  const index = records.findIndex((item) => item.id === next.id)
  if (index === -1) {
    return [next, ...records]
  }

  const updated = [...records]
  updated[index] = next
  return updated.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

function getAuthorizedHeaders(includeJson = false) {
  const token = getStoredAuthToken()

  if (!token) {
    throw new Error('Please sign in again to manage recruiter workflows.')
  }

  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  }
}

export function JobBoardManager() {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [applicationNotes, setApplicationNotes] = useState<Record<string, string>>({})
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [form, setForm] = useState(createEmptyJobForm())
  const [loading, setLoading] = useState(true)
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedJob = useMemo(
    () => jobs.find((item) => item.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  )

  const stats = useMemo(
    () => ({
      total: jobs.length,
      published: jobs.filter((job) => job.status === 'published').length,
      draft: jobs.filter((job) => job.status === 'draft').length,
      closed: jobs.filter((job) => job.status === 'closed').length,
    }),
    [jobs]
  )

  const funnel = useMemo(() => {
    return {
      total: applications.length,
      applied: applications.filter((item) => item.stage === 'applied').length,
      screening: applications.filter((item) => item.stage === 'screening').length,
      interview: applications.filter((item) => item.stage === 'interview').length,
      offer: applications.filter((item) => item.stage === 'offer' || item.stage === 'hired').length,
      rejected: applications.filter((item) => item.stage === 'rejected').length,
      withdrawn: applications.filter((item) => item.stage === 'withdrawn').length,
    }
  }, [applications])

  useEffect(() => {
    void loadJobs()
  }, [])

  useEffect(() => {
    if (!selectedJob) {
      setForm(createEmptyJobForm())
      return
    }

    setForm({
      title: selectedJob.title,
      company: selectedJob.company,
      companyTagline: selectedJob.companyTagline,
      status: selectedJob.status,
      contactEmail: selectedJob.contactEmail ?? '',
      location: selectedJob.location,
      locationMode: selectedJob.locationMode,
      salaryMin: String(selectedJob.salaryMin),
      salaryMax: String(selectedJob.salaryMax),
      currency: selectedJob.currency,
      type: selectedJob.type,
      industries: selectedJob.industries.join(', '),
      requiredSkills: selectedJob.requiredSkills.join(', '),
      preferredSkills: selectedJob.preferredSkills.join(', '),
      minYearsExperience: String(selectedJob.minYearsExperience),
      seniority: selectedJob.seniority,
      description: selectedJob.description,
      highlights: selectedJob.highlights.join(', '),
    })
  }, [selectedJob])

  useEffect(() => {
    if (!selectedJobId) {
      setApplications([])
      setApplicationNotes({})
      return
    }

    void loadApplications(selectedJobId)
  }, [selectedJobId])

  async function loadJobs() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/jobs?scope=mine', {
        cache: 'no-store',
        headers: getAuthorizedHeaders(),
      })
      const data = (await response.json()) as JobRecord[] | { error?: string }

      if (!response.ok || !Array.isArray(data)) {
        throw new Error('Failed to load jobs.')
      }

      setJobs(data)
      setSelectedJobId((current) => current ?? data[0]?.id ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load jobs.')
    } finally {
      setLoading(false)
    }
  }

  async function loadApplications(jobId: string) {
    try {
      setApplicationsLoading(true)
      const response = await fetch(`/api/applications?jobId=${encodeURIComponent(jobId)}`, {
        cache: 'no-store',
        headers: getAuthorizedHeaders(),
      })
      const data = (await response.json()) as ApplicationRecord[] | { error?: string }

      if (!response.ok || !Array.isArray(data)) {
        throw new Error('Failed to load applicants.')
      }

      setApplications(data)
      setApplicationNotes(
        Object.fromEntries(data.map((item) => [item.id, item.notes]))
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load applicants.')
    } finally {
      setApplicationsLoading(false)
    }
  }

  async function createJob() {
    if (!form.title.trim() || !form.company.trim() || !form.description.trim()) {
      setError('Title, company, and description are required.')
      return
    }

    try {
      setCreating(true)
      setError('')
      setMessage('')

      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: getAuthorizedHeaders(true),
        body: JSON.stringify({
          ...form,
          industries: splitCsv(form.industries),
          requiredSkills: splitCsv(form.requiredSkills),
          preferredSkills: splitCsv(form.preferredSkills),
          highlights: splitCsv(form.highlights),
          salaryMin: Number(form.salaryMin),
          salaryMax: Number(form.salaryMax),
          minYearsExperience: Number(form.minYearsExperience),
        }),
      })

      const data = (await response.json()) as JobRecord | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to create job.')
      }

      setJobs((current) => [data, ...current.filter((item) => item.id !== data.id)])
      setSelectedJobId(data.id)
      setMessage('Job created successfully.')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create job.')
    } finally {
      setCreating(false)
    }
  }

  async function saveJob() {
    if (!selectedJob) {
      return
    }

    try {
      setSaving(true)
      setError('')
      setMessage('')

      const response = await fetch(`/api/jobs/${selectedJob.id}`, {
        method: 'PATCH',
        headers: getAuthorizedHeaders(true),
        body: JSON.stringify({
          ...form,
          industries: splitCsv(form.industries),
          requiredSkills: splitCsv(form.requiredSkills),
          preferredSkills: splitCsv(form.preferredSkills),
          highlights: splitCsv(form.highlights),
          salaryMin: Number(form.salaryMin),
          salaryMax: Number(form.salaryMax),
          minYearsExperience: Number(form.minYearsExperience),
        }),
      })

      const data = (await response.json()) as JobRecord | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to update job.')
      }

      setJobs((current) => current.map((item) => (item.id === data.id ? data : item)))
      setMessage('Job updated successfully.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update job.')
    } finally {
      setSaving(false)
    }
  }

  async function patchApplication(applicationId: string, payload: { stage?: ApplicationStage; notes?: string }) {
    try {
      setUpdatingApplicationId(applicationId)
      setError('')
      setMessage('')

      const response = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: getAuthorizedHeaders(true),
        body: JSON.stringify(payload),
      })

      const data = (await response.json()) as ApplicationRecord | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to update applicant.')
      }

      setApplications((current) => upsertApplication(current, data))
      setApplicationNotes((current) => ({ ...current, [data.id]: data.notes }))
      setMessage(`Updated ${data.userName}'s application.`)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update applicant.')
    } finally {
      setUpdatingApplicationId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card"><p className="text-sm text-gray-500">Total JD</p><p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Published</p><p className="mt-1 text-2xl font-bold text-emerald-700">{stats.published}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Draft</p><p className="mt-1 text-2xl font-bold text-amber-700">{stats.draft}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Closed</p><p className="mt-1 text-2xl font-bold text-slate-700">{stats.closed}</p></div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      {loading ? (
        <div className="card flex items-center justify-center py-12">
          <Loader2 className="mr-3 h-5 w-5 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">Loading job board...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-4">
            <div className="card">
              <div className="mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Create or select a JD</h2>
              </div>
              <button onClick={() => { setSelectedJobId(null); setForm(createEmptyJobForm()); setMessage('') }} className="btn-secondary mb-4 flex w-full items-center justify-center gap-2">
                <Plus className="h-4 w-4" />
                <span>New Job Draft</span>
              </button>
              <div className="space-y-3">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => { setSelectedJobId(job.id); setMessage('') }}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      selectedJobId === job.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-gray-900">{job.title}</p>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                        job.status === 'published' ? 'bg-emerald-100 text-emerald-700' : job.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                      }`}>{job.status}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-gray-500">{job.company} - {job.location}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6 xl:col-span-2">
            <div className="card">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{selectedJob ? 'Edit JD' : 'Create JD'}</h2>
                <button onClick={selectedJob ? saveJob : createJob} className="btn-primary flex items-center gap-2" disabled={saving || creating}>
                  {saving || creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{selectedJob ? (saving ? 'Saving...' : 'Save JD') : (creating ? 'Creating...' : 'Create JD')}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="input-field" placeholder="Job title" />
                <input value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} className="input-field" placeholder="Company" />
                <input value={form.companyTagline} onChange={(event) => setForm((current) => ({ ...current, companyTagline: event.target.value }))} className="input-field" placeholder="Company tagline" />
                <input value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} className="input-field" placeholder="Recruiting email" />
                <input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="input-field" placeholder="Location" />
                <select value={form.locationMode} onChange={(event) => setForm((current) => ({ ...current, locationMode: event.target.value as JobLocationMode }))} className="input-field">{LOCATION_MODES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as JobType }))} className="input-field">{JOB_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as JobStatus }))} className="input-field">{STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <input value={form.salaryMin} onChange={(event) => setForm((current) => ({ ...current, salaryMin: event.target.value }))} className="input-field" placeholder="Salary min" />
                <input value={form.salaryMax} onChange={(event) => setForm((current) => ({ ...current, salaryMax: event.target.value }))} className="input-field" placeholder="Salary max" />
                <select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value as 'CNY' | 'USD' }))} className="input-field"><option value="CNY">CNY</option><option value="USD">USD</option></select>
                <select value={form.seniority} onChange={(event) => setForm((current) => ({ ...current, seniority: event.target.value as JobSeniority }))} className="input-field">{SENIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <input value={form.minYearsExperience} onChange={(event) => setForm((current) => ({ ...current, minYearsExperience: event.target.value }))} className="input-field" placeholder="Min years experience" />
                <input value={form.industries} onChange={(event) => setForm((current) => ({ ...current, industries: event.target.value }))} className="input-field md:col-span-2" placeholder="Industries, comma separated" />
                <input value={form.requiredSkills} onChange={(event) => setForm((current) => ({ ...current, requiredSkills: event.target.value }))} className="input-field md:col-span-2" placeholder="Required skills, comma separated" />
                <input value={form.preferredSkills} onChange={(event) => setForm((current) => ({ ...current, preferredSkills: event.target.value }))} className="input-field md:col-span-2" placeholder="Preferred skills, comma separated" />
                <input value={form.highlights} onChange={(event) => setForm((current) => ({ ...current, highlights: event.target.value }))} className="input-field md:col-span-2" placeholder="Highlights, comma separated" />
                <textarea rows={6} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="input-field md:col-span-2" placeholder="Job description" />
              </div>
            </div>

            {selectedJob && (
              <div className="card space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Applicant Funnel</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Live applications for {selectedJob.title} at {selectedJob.company}
                    </p>
                  </div>
                  <button onClick={() => void loadApplications(selectedJob.id)} className="btn-secondary">
                    Refresh Funnel
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3"><p className="text-xs uppercase tracking-wide text-gray-500">Applicants</p><p className="mt-2 text-2xl font-bold text-gray-900">{funnel.total}</p></div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"><p className="text-xs uppercase tracking-wide text-blue-700">Applied</p><p className="mt-2 text-2xl font-bold text-blue-900">{funnel.applied}</p></div>
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3"><p className="text-xs uppercase tracking-wide text-sky-700">Screening</p><p className="mt-2 text-2xl font-bold text-sky-900">{funnel.screening}</p></div>
                  <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3"><p className="text-xs uppercase tracking-wide text-violet-700">Interview</p><p className="mt-2 text-2xl font-bold text-violet-900">{funnel.interview}</p></div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><p className="text-xs uppercase tracking-wide text-amber-700">Offer+</p><p className="mt-2 text-2xl font-bold text-amber-900">{funnel.offer}</p></div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3"><p className="text-xs uppercase tracking-wide text-rose-700">Rejected</p><p className="mt-2 text-2xl font-bold text-rose-900">{funnel.rejected}</p></div>
                </div>

                {applicationsLoading ? (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 py-12">
                    <Loader2 className="mr-3 h-5 w-5 animate-spin text-gray-400" />
                    <span className="text-sm text-gray-500">Loading applicants...</span>
                  </div>
                ) : applications.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">
                    No applications yet. Publish this JD and let candidates start applying.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {applications.map((application) => (
                      <div key={application.id} className="rounded-xl border border-gray-200 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-gray-900">{application.userName}</p>
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${stagePill(application.stage)}`}>{stageLabel(application.stage)}</span>
                              <span className="rounded-full bg-primary-100 px-2 py-1 text-xs font-medium text-primary-700">{application.matchScore}% match</span>
                            </div>
                            <p className="mt-1 text-sm text-gray-600">{application.userEmail}</p>
                            <p className="mt-2 text-xs text-gray-500">
                              Applied {new Date(application.createdAt).toLocaleString()} · Resume {application.resumeId ? 'linked' : 'not linked'}
                            </p>
                          </div>

                          <div className="w-full lg:w-56">
                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">Stage</label>
                            <select
                              value={application.stage}
                              onChange={(event) => void patchApplication(application.id, { stage: event.target.value as ApplicationStage })}
                              className="input-field"
                              disabled={updatingApplicationId === application.id}
                            >
                              {APPLICATION_STAGES.map((stage) => (
                                <option key={stage} value={stage}>
                                  {stageLabel(stage)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">Notes</label>
                          <textarea
                            rows={3}
                            value={applicationNotes[application.id] ?? ''}
                            onChange={(event) =>
                              setApplicationNotes((current) => ({
                                ...current,
                                [application.id]: event.target.value,
                              }))
                            }
                            className="input-field"
                            placeholder="Screening summary, interviewer notes, next step..."
                          />
                        </div>

                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Users className="h-4 w-4" />
                            <span>Updated {new Date(application.updatedAt).toLocaleString()}</span>
                          </div>
                          <button
                            onClick={() => void patchApplication(application.id, { notes: applicationNotes[application.id] ?? '' })}
                            className="btn-secondary"
                            disabled={updatingApplicationId === application.id}
                          >
                            {updatingApplicationId === application.id ? 'Saving...' : 'Save Notes'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
