'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Briefcase,
  CheckCircle2,
  FileSearch,
  Loader2,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'

import { getStoredAuthToken } from './AuthProvider'
import type { JobRecord } from '@/types/job'
import type { ResumeListItem } from '@/types/resume'
import type { RecruiterScreeningRecord } from '@/types/screening'

function authHeaders() {
  const token = getStoredAuthToken()
  if (!token) {
    throw new Error('请重新登录后加载招聘方概览。')
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

function recommendationTone(score: number) {
  if (score >= 85) return 'bg-emerald-100 text-emerald-700'
  if (score >= 72) return 'bg-blue-100 text-blue-700'
  if (score >= 58) return 'bg-amber-100 text-amber-700'
  return 'bg-rose-100 text-rose-700'
}

export function RecruiterOverview() {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [screenings, setScreenings] = useState<RecruiterScreeningRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      if (!getStoredAuthToken()) {
        setError('请重新登录后加载招聘方概览。')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const [jobResponse, resumeResponse, screeningResponse] = await Promise.all([
          fetch('/api/jobs?scope=mine', {
            cache: 'no-store',
            headers: authHeaders(),
          }),
          fetch('/api/resumes', {
            cache: 'no-store',
            headers: authHeaders(),
          }),
          fetch('/api/recruiter/screenings', {
            cache: 'no-store',
            headers: authHeaders(),
          }),
        ])

        const jobData = (await jobResponse.json()) as JobRecord[] | { error?: string }
        const resumeData = (await resumeResponse.json()) as ResumeListItem[] | { error?: string }
        const screeningData = (await screeningResponse.json()) as RecruiterScreeningRecord[] | { error?: string }

        if (!jobResponse.ok || !Array.isArray(jobData)) {
          throw new Error(!Array.isArray(jobData) && jobData.error ? jobData.error : '岗位加载失败。')
        }

        if (!resumeResponse.ok || !Array.isArray(resumeData)) {
          throw new Error(!Array.isArray(resumeData) && resumeData.error ? resumeData.error : '简历加载失败。')
        }

        if (!screeningResponse.ok || !Array.isArray(screeningData)) {
          throw new Error(
            !Array.isArray(screeningData) && screeningData.error ? screeningData.error : 'AI 初筛加载失败。'
          )
        }

        setJobs(jobData)
        setResumes(resumeData)
        setScreenings(screeningData)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '招聘概览加载失败。')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  const metrics = useMemo(() => {
    return {
      totalJobs: jobs.length,
      publishedJobs: jobs.filter((job) => job.status === 'published').length,
      totalResumes: resumes.length,
      screenedCandidates: screenings.length,
      strongCandidates: screenings.filter((record) => record.overallScore >= 72).length,
    }
  }, [jobs, resumes, screenings])

  const latestJobs = useMemo(() => jobs.slice(0, 4), [jobs])
  const shortlist = useMemo(() => screenings.slice().sort((a, b) => b.overallScore - a.overallScore).slice(0, 5), [screenings])

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">正在加载招聘概览...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a,#1e293b_55%,#1d4ed8)] px-8 py-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm">
              <Sparkles className="h-4 w-4" />
              <span>招聘方概览</span>
            </div>
            <h2 className="mt-5 text-3xl font-semibold">把岗位、简历和 AI 初筛收敛成一个招聘工作台。</h2>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              先发布 JD，再把所有候选人简历跑过 AI 初筛。系统会自动生成面试题、给出预筛分数和风险提示，
              用来替代首轮 HR 简历筛查。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">已完成初筛</p>
              <p className="mt-2 text-2xl font-semibold">{metrics.screenedCandidates}</p>
              <p className="mt-1 text-sm text-slate-300">份 AI 初筛结果已生成</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">可推进人选</p>
              <p className="mt-2 text-2xl font-semibold">{metrics.strongCandidates}</p>
              <p className="mt-1 text-sm text-slate-300">位候选人达到推进阈值</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">我的 JD</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.totalJobs}</p>
          <p className="mt-2 text-sm text-slate-500">{metrics.publishedJobs} 个岗位已发布</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">候选人池</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.totalResumes}</p>
          <p className="mt-2 text-sm text-slate-500">当前概览统计到的简历数量</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">AI 初筛</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.screenedCandidates}</p>
          <p className="mt-2 text-sm text-slate-500">已自动出题并生成预筛结论</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">可推进候选人</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{metrics.strongCandidates}</p>
          <p className="mt-2 text-sm text-slate-500">分数大于等于 72 的候选人</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">岗位推进情况</h3>
              <p className="mt-1 text-sm text-slate-500">当前招聘方账号下的岗位列表</p>
            </div>
            <Briefcase className="h-5 w-5 text-primary-600" />
          </div>

          <div className="mt-5 space-y-3">
            {latestJobs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
                还没有创建岗位。先到“岗位管理”里填写职位描述、岗位需求和招聘信息。
              </div>
            )}

            {latestJobs.map((job) => (
              <div key={job.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{job.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {job.company} · {job.location}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      job.status === 'published'
                        ? 'bg-emerald-100 text-emerald-700'
                        : job.status === 'draft'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{job.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
            <h3 className="text-lg font-semibold text-slate-900">AI 推荐候选人</h3>
              <p className="mt-1 text-sm text-slate-500">按预筛分排序的候选人</p>
            </div>
            <Target className="h-5 w-5 text-primary-600" />
          </div>

          <div className="mt-5 space-y-3">
            {shortlist.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
                还没有 AI 初筛结果。到“AI 初筛”里选择岗位并为候选人跑第一轮自动筛选。
              </div>
            )}

            {shortlist.map((record) => (
              <div key={record.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{record.candidateName || '未命名候选人'}</p>
                    <p className="mt-1 text-sm text-slate-500">{record.jobTitle}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${recommendationTone(record.overallScore)}`}>
                    {record.overallScore} 分
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{record.summary}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{record.highlights[0] || '已生成岗位匹配亮点与追问方向'}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <FileSearch className="h-4 w-4 text-primary-600" />
                  <span>{record.questions.length} 道 AI 面试题已生成</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">1. 先发布岗位</p>
              <p className="mt-1 text-sm text-slate-500">把岗位职责、技能要求和招聘信息填完整。</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-100 p-3 text-violet-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">2. 汇总候选人简历</p>
              <p className="mt-1 text-sm text-slate-500">把简历导入候选人池，供招聘方统一筛选。</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">3. 跑 AI 初筛</p>
              <p className="mt-1 text-sm text-slate-500">系统自动生成面试题、分数和风险提示。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
