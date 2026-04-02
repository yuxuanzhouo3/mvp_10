'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, Loader2, Save, Send, Sparkles, Users } from 'lucide-react'

import { getStoredAuthToken } from './AuthProvider'
import type { JobLocationMode, JobRecord, JobStatus, JobType } from '@/types/job'
import type { RecruiterCandidateRecord } from '@/types/recruiter'

function authHeaders(json = false) {
  const token = getStoredAuthToken()
  if (!token) throw new Error('请先重新登录。')
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  }
}

function splitList(value: string) {
  return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
}

function emptyForm() {
  return {
    title: '',
    company: '',
    location: '',
    locationMode: 'onsite' as JobLocationMode,
    salaryMin: '15000',
    salaryMax: '30000',
    type: 'Full-time' as JobType,
    status: 'draft' as JobStatus,
    description: '',
    requiredSkills: '',
    preferredSkills: '',
    contactEmail: '',
  }
}

function statusLabel(status: 'draft' | 'in_progress' | 'submitted' | 'scored') {
  switch (status) {
    case 'draft':
      return '待作答'
    case 'in_progress':
      return '作答中'
    case 'submitted':
      return '已提交'
    case 'scored':
      return '已评分'
    default:
      return status
  }
}

export function RecruiterWorkspace() {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [candidates, setCandidates] = useState<RecruiterCandidateRecord[]>([])
  const [resumeSelection, setResumeSelection] = useState<Record<string, string>>({})
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? null, [jobs, selectedJobId])

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
      location: selectedJob.location,
      locationMode: selectedJob.locationMode,
      salaryMin: String(selectedJob.salaryMin),
      salaryMax: String(selectedJob.salaryMax),
      type: selectedJob.type,
      status: selectedJob.status,
      description: selectedJob.description,
      requiredSkills: selectedJob.requiredSkills.join('，'),
      preferredSkills: selectedJob.preferredSkills.join('，'),
      contactEmail: selectedJob.contactEmail ?? '',
    })
  }, [selectedJob])

  useEffect(() => {
    if (!selectedJobId) {
      setCandidates([])
      setResumeSelection({})
      setNoteDrafts({})
      return
    }

    void loadCandidates(selectedJobId)
  }, [selectedJobId])

  async function loadJobs() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/jobs?scope=mine', { cache: 'no-store', headers: authHeaders() })
      const payload = (await response.json()) as JobRecord[] | { error?: string }
      if (!response.ok || !Array.isArray(payload)) throw new Error(!Array.isArray(payload) && payload.error ? payload.error : '岗位加载失败。')
      setJobs(payload)
      setSelectedJobId((current) => current ?? payload[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '岗位加载失败。')
    } finally {
      setLoading(false)
    }
  }

  async function loadCandidates(jobId: string) {
    try {
      setCandidateLoading(true)
      const response = await fetch(`/api/recruiter/candidates?jobId=${encodeURIComponent(jobId)}`, {
        cache: 'no-store',
        headers: authHeaders(),
      })
      const payload = (await response.json()) as RecruiterCandidateRecord[] | { error?: string }
      if (!response.ok || !Array.isArray(payload)) throw new Error(!Array.isArray(payload) && payload.error ? payload.error : '候选人加载失败。')
      setCandidates(payload)
      setResumeSelection(Object.fromEntries(payload.map((item) => [item.application.id, item.selectedResume?.id ?? ''])))
      setNoteDrafts(Object.fromEntries(payload.map((item) => [item.application.id, item.application.notes])))
    } catch (err) {
      setError(err instanceof Error ? err.message : '候选人加载失败。')
    } finally {
      setCandidateLoading(false)
    }
  }

  async function saveJob() {
    try {
      if (!form.title.trim() || !form.company.trim() || !form.description.trim()) throw new Error('请先补全岗位名称、公司和岗位描述。')
      setSaving(true)
      setError('')
      setMessage('')
      const url = selectedJob ? `/api/jobs/${selectedJob.id}` : '/api/jobs'
      const method = selectedJob ? 'PATCH' : 'POST'
      const response = await fetch(url, {
        method,
        headers: authHeaders(true),
        body: JSON.stringify({
          ...form,
          salaryMin: Number(form.salaryMin),
          salaryMax: Number(form.salaryMax),
          minYearsExperience: 0,
          seniority: 'entry',
          currency: 'CNY',
          industries: [],
          highlights: [],
          requiredSkills: splitList(form.requiredSkills),
          preferredSkills: splitList(form.preferredSkills),
        }),
      })
      const payload = (await response.json()) as JobRecord | { error?: string }
      if (!response.ok || !('id' in payload)) throw new Error('error' in payload && payload.error ? payload.error : '岗位保存失败。')
      setJobs((current) => [payload, ...current.filter((item) => item.id !== payload.id)])
      setSelectedJobId(payload.id)
      setMessage(selectedJob ? '岗位已保存。' : '岗位已创建。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '岗位保存失败。')
    } finally {
      setSaving(false)
    }
  }

  async function patchApplication(applicationId: string, body: Record<string, unknown>, success: string) {
    try {
      setActingId(applicationId)
      setError('')
      setMessage('')
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as { id?: string; error?: string }
      if (!response.ok || !payload.id) throw new Error(payload.error || '候选人更新失败。')
      if (selectedJobId) await loadCandidates(selectedJobId)
      setMessage(success)
    } catch (err) {
      setError(err instanceof Error ? err.message : '候选人更新失败。')
    } finally {
      setActingId(null)
    }
  }

  async function postAction(url: string, applicationId: string, resumeId: string, success: string) {
    try {
      setActingId(applicationId)
      setError('')
      setMessage('')
      const response = await fetch(url, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ applicationId, resumeId, mode: 'interview' }),
      })
      const payload = (await response.json()) as { id?: string; error?: string }
      if (!response.ok || !payload.id) throw new Error(payload.error || '操作失败。')
      if (selectedJobId) await loadCandidates(selectedJobId)
      setMessage(success)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败。')
    } finally {
      setActingId(null)
    }
  }

  if (loading) {
    return <div className="card flex items-center justify-center py-16"><Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" /><span className="text-sm text-slate-500">正在加载招聘工作台...</span></div>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f5faff)] p-6 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700"><Sparkles className="h-4 w-4" /><span>招聘工作台</span></div>
        <h2 className="mt-4 text-3xl font-semibold text-slate-900">岗位、候选人、AI 初筛和发题放在一起。</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">候选人只会出现在真实投递过的岗位里。你可以先选简历，再跑 AI 初筛，最后发题并查看系统回传的评分。</p>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /><span>{error}</span></div></div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="card space-y-3">
          <button onClick={() => { setSelectedJobId(null); setForm(emptyForm()) }} className="btn-secondary w-full">新建岗位</button>
          {jobs.map((job) => (
            <button key={job.id} onClick={() => setSelectedJobId(job.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedJobId === job.id ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <p className="truncate text-sm font-medium text-slate-900">{job.title}</p>
              <p className="mt-1 text-xs text-slate-500">{job.company}</p>
            </button>
          ))}
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedJob ? '编辑岗位' : '创建岗位'}</h3>
                <p className="mt-1 text-sm text-slate-500">核心信息直接可见，技能要求放在可展开区域。</p>
              </div>
              <button onClick={() => void saveJob()} className="btn-primary flex items-center gap-2" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{saving ? '保存中...' : '保存岗位'}</span>
              </button>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="input-field" placeholder="岗位名称" />
              <input value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} className="input-field" placeholder="公司名称" />
              <input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="input-field" placeholder="工作地点" />
              <select value={form.locationMode} onChange={(event) => setForm((current) => ({ ...current, locationMode: event.target.value as JobLocationMode }))} className="input-field"><option value="onsite">现场</option><option value="hybrid">混合</option><option value="remote">远程</option></select>
              <input value={form.salaryMin} onChange={(event) => setForm((current) => ({ ...current, salaryMin: event.target.value }))} className="input-field" placeholder="最低薪资" />
              <input value={form.salaryMax} onChange={(event) => setForm((current) => ({ ...current, salaryMax: event.target.value }))} className="input-field" placeholder="最高薪资" />
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={5} className="input-field md:col-span-2" placeholder="岗位职责、岗位需求、招聘重点" />
            </div>
            <details className="mt-5 rounded-2xl bg-slate-50 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">展开岗位补充信息<ChevronDown className="h-4 w-4 text-slate-400" /></summary>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as JobType }))} className="input-field"><option value="Full-time">全职</option><option value="Part-time">兼职</option><option value="Contract">合同制</option><option value="Internship">实习</option></select>
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as JobStatus }))} className="input-field"><option value="draft">草稿</option><option value="published">已发布</option><option value="closed">已关闭</option></select>
                <input value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} className="input-field" placeholder="招聘联系邮箱" />
                <input value={form.requiredSkills} onChange={(event) => setForm((current) => ({ ...current, requiredSkills: event.target.value }))} className="input-field md:col-span-2" placeholder="必须技能，支持中文逗号分隔" />
                <input value={form.preferredSkills} onChange={(event) => setForm((current) => ({ ...current, preferredSkills: event.target.value }))} className="input-field md:col-span-2" placeholder="加分技能，支持中文逗号分隔" />
              </div>
            </details>
          </div>

          {selectedJob && (
            <div className="card">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary-600" /><div><h3 className="text-lg font-semibold text-slate-900">岗位候选人</h3><p className="mt-1 text-sm text-slate-500">只显示真实投递到该岗位的候选人。</p></div></div>
                <button onClick={() => void loadCandidates(selectedJob.id)} className="btn-secondary">刷新候选人</button>
              </div>

              {candidateLoading ? <div className="flex items-center justify-center py-14"><Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" /><span className="text-sm text-slate-500">正在加载候选人...</span></div> : candidates.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">这个岗位还没有收到带简历的投递。</div> : <div className="space-y-4">
                {candidates.map((candidate) => {
                  const selectedResumeId = resumeSelection[candidate.application.id] ?? ''
                  const selectedResume = candidate.availableResumes.find((item) => item.id === selectedResumeId) ?? candidate.selectedResume
                  const assessment = candidate.latestAssessment
                  return (
                    <div key={candidate.application.id} className="rounded-[24px] border border-slate-200 p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-lg font-semibold text-slate-900">{candidate.application.userName}</h4>
                          <p className="mt-1 text-sm text-slate-600">{candidate.application.userEmail}</p>
                          <p className="mt-3 text-sm leading-7 text-slate-600">{selectedResume?.summary || '当前还没有可用的简历摘要。'}</p>
                        </div>
                        <div className="grid w-full gap-3 xl:w-[300px]">
                          <select value={selectedResumeId} onChange={(event) => setResumeSelection((current) => ({ ...current, [candidate.application.id]: event.target.value }))} className="input-field">
                            {candidate.availableResumes.length === 0 && <option value="">暂无可选简历</option>}
                            {candidate.availableResumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.fileName} / {resume.score} 分</option>)}
                          </select>
                          <button onClick={() => void patchApplication(candidate.application.id, { resumeId: selectedResumeId }, '已保存候选人所选简历。')} className="btn-secondary" disabled={!selectedResumeId || actingId === candidate.application.id}>保存简历选择</button>
                          <button onClick={() => void postAction('/api/recruiter/screenings', candidate.application.id, selectedResumeId, `已完成 ${candidate.application.userName} 的 AI 初筛。`)} className="btn-secondary" disabled={!selectedResumeId || actingId === candidate.application.id}>{candidate.screening ? '重新跑 AI 初筛' : '运行 AI 初筛'}</button>
                          <button onClick={() => void postAction('/api/assessments', candidate.application.id, selectedResumeId, `已向 ${candidate.application.userName} 发送 AI 题目。`)} className="btn-primary flex items-center justify-center gap-2" disabled={!selectedResumeId || actingId === candidate.application.id}>{actingId === candidate.application.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}<span>{assessment ? '再次发送 AI 题目' : '发送 AI 题目'}</span></button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-medium text-slate-900">AI 初筛</p><p className="mt-3 text-sm leading-7 text-slate-600">{candidate.screening ? candidate.screening.summary : '还没有生成 AI 初筛结果。'}</p></div>
                        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-medium text-slate-900">题目回传</p><p className="mt-3 text-sm leading-7 text-slate-600">{assessment ? assessment.summary.summary : '还没有给候选人发送 AI 题目。'}</p></div>
                      </div>

                      <details className="mt-4 rounded-2xl bg-slate-50 p-4">
                        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">展开更多信息<ChevronDown className="h-4 w-4 text-slate-400" /></summary>
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div>
                            <p className="text-sm font-medium text-slate-900">流程备注</p>
                            <textarea rows={4} value={noteDrafts[candidate.application.id] ?? ''} onChange={(event) => setNoteDrafts((current) => ({ ...current, [candidate.application.id]: event.target.value }))} className="input-field mt-3" placeholder="写一点补充判断、面试关注点或流程备注" />
                            <button onClick={() => void patchApplication(candidate.application.id, { notes: noteDrafts[candidate.application.id] ?? '' }, '候选人备注已保存。')} className="btn-secondary mt-3">保存备注</button>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">当前结果</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-600">
                              {candidate.screening && <p>初筛结果：{candidate.screening.overallScore} 分 / {candidate.screening.recommendation === 'strong_yes' ? '强烈推荐' : candidate.screening.recommendation === 'yes' ? '推荐' : candidate.screening.recommendation === 'hold' ? '待定' : '不推荐'}</p>}
                              {assessment && <p>回传状态：{assessment.summary.overallScore !== null ? `${assessment.summary.overallScore} 分 / ${assessment.summary.recommendation === 'strong_yes' ? '强烈推荐' : assessment.summary.recommendation === 'yes' ? '推荐' : assessment.summary.recommendation === 'hold' ? '待定' : '不推荐'}` : statusLabel(assessment.status)}</p>}
                              {selectedResume?.profile.skills.length ? <p>简历技能：{selectedResume.profile.skills.join('、')}</p> : <p>当前简历暂无技能关键词。</p>}
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  )
                })}
              </div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
