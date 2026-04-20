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
import { useLanguage } from './LanguageProvider'
import { jobStatusLabel, pickLanguage } from '@/lib/i18n'
import type { JobRecord } from '@/types/job'
import type { ResumeListItem } from '@/types/resume'
import type { RecruiterScreeningRecord } from '@/types/screening'

function authHeaders() {
  const token = getStoredAuthToken()
  if (!token) {
    throw new Error('Please sign in again.')
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
  const { language } = useLanguage()
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [screenings, setScreenings] = useState<RecruiterScreeningRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const copy = {
    loadFailed: pickLanguage(language, '招聘概览加载失败。', 'Failed to load the recruiter overview.'),
    jobsFailed: pickLanguage(language, '岗位加载失败。', 'Failed to load jobs.'),
    resumesFailed: pickLanguage(language, '简历加载失败。', 'Failed to load resumes.'),
    screeningFailed: pickLanguage(language, 'AI 初筛加载失败。', 'Failed to load AI screening results.'),
    loading: pickLanguage(language, '正在加载招聘概览...', 'Loading recruiter overview...'),
    title: pickLanguage(language, '招聘方概览', 'Recruiter Overview'),
    heading: pickLanguage(
      language,
      '把岗位、简历和 AI 初筛收敛成一个招聘工作台。',
      'Bring jobs, resumes, and AI screening together in one recruiter workspace.'
    ),
    description: pickLanguage(
      language,
      '先发布 JD，再把所有候选人简历跑进 AI 初筛。系统会自动生成面试题、给出预筛分数和风险提示，用来替代首轮 HR 简历筛查。',
      'Publish the role first, then run candidate resumes through AI screening. The system generates interview questions, screening scores, and risk signals to replace the first resume review pass.'
    ),
    completedScreenings: pickLanguage(language, '已完成初筛', 'Completed Screenings'),
    completedDescription: pickLanguage(language, '份 AI 初筛结果已生成', 'AI screening results generated'),
    strongCandidates: pickLanguage(language, '可推进人选', 'Move-Forward Candidates'),
    strongDescription: pickLanguage(language, '位候选人达到推进阈值', 'candidates reached the advancement threshold'),
    jobs: pickLanguage(language, '我的 JD', 'My Jobs'),
    publishedJobs: pickLanguage(language, '个岗位已发布', 'published jobs'),
    resumePool: pickLanguage(language, '候选人池', 'Candidate Pool'),
    resumePoolDescription: pickLanguage(language, '当前概览统计到的简历数量', 'resumes currently counted in the overview'),
    screening: pickLanguage(language, 'AI 初筛', 'AI Screening'),
    screeningDescription: pickLanguage(language, '已自动出题并生成预筛结论', 'interview prompts and screening summaries generated'),
    moveForward: pickLanguage(language, '可推进候选人', 'Advanceable Candidates'),
    moveForwardDescription: pickLanguage(language, '分数大于等于 72 的候选人', 'candidates scoring 72 or above'),
    jobPipeline: pickLanguage(language, '岗位推进情况', 'Job Pipeline'),
    jobPipelineDescription: pickLanguage(language, '当前招聘方账号下的岗位列表', 'Roles currently owned by this recruiter account'),
    emptyJobs: pickLanguage(
      language,
      '还没有创建岗位。先到“岗位管理”里填写职位描述、岗位需求和招聘信息。',
      'No roles yet. Go to Jobs to create the first one with a description, requirements, and recruiting details.'
    ),
    aiCandidates: pickLanguage(language, 'AI 推荐候选人', 'AI Recommended Candidates'),
    aiCandidatesDescription: pickLanguage(language, '按预筛分排序的候选人', 'Candidates ranked by AI screening score'),
    emptyShortlist: pickLanguage(
      language,
      '还没有 AI 初筛结果。到“AI 初筛”里选择岗位并为候选人跑第一轮自动筛选。',
      'No AI screening result yet. Go to AI Screening to run the first automated pass for candidates.'
    ),
    unnamedCandidate: pickLanguage(language, '未命名候选人', 'Unnamed Candidate'),
    highlightFallback: pickLanguage(language, '已生成岗位匹配亮点与追问方向', 'Generated role-fit highlights and follow-up directions'),
    generatedQuestions: pickLanguage(language, '道 AI 面试题已生成', 'AI interview questions generated'),
    step1: pickLanguage(language, '1. 先发布岗位', '1. Publish the Role'),
    step1Desc: pickLanguage(language, '把岗位职责、技能要求和招聘信息填完整。', 'Complete responsibilities, skill requirements, and recruiting details.'),
    step2: pickLanguage(language, '2. 汇总候选人简历', '2. Gather Candidate Resumes'),
    step2Desc: pickLanguage(language, '把简历导入候选人池，供招聘方统一筛选。', 'Bring resumes into the candidate pool for centralized review.'),
    step3: pickLanguage(language, '3. 跑 AI 初筛', '3. Run AI Screening'),
    step3Desc: pickLanguage(language, '系统自动生成面试题、分数和风险提示。', 'The system generates interview questions, scores, and risk flags automatically.'),
  }

  useEffect(() => {
    async function loadData() {
      if (!getStoredAuthToken()) {
        setError(copy.loadFailed)
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
          throw new Error(!Array.isArray(jobData) && jobData.error ? jobData.error : copy.jobsFailed)
        }

        if (!resumeResponse.ok || !Array.isArray(resumeData)) {
          throw new Error(!Array.isArray(resumeData) && resumeData.error ? resumeData.error : copy.resumesFailed)
        }

        if (!screeningResponse.ok || !Array.isArray(screeningData)) {
          throw new Error(
            !Array.isArray(screeningData) && screeningData.error
              ? screeningData.error
              : copy.screeningFailed
          )
        }

        setJobs(jobData)
        setResumes(resumeData)
        setScreenings(screeningData)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : copy.loadFailed)
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [copy.jobsFailed, copy.loadFailed, copy.resumesFailed, copy.screeningFailed])

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
  const shortlist = useMemo(
    () => screenings.slice().sort((a, b) => b.overallScore - a.overallScore).slice(0, 5),
    [screenings]
  )

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
      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a,#1e293b_55%,#1d4ed8)] px-8 py-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm">
              <Sparkles className="h-4 w-4" />
              <span>{copy.title}</span>
            </div>
            <h2 className="mt-5 text-3xl font-semibold">{copy.heading}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-200">{copy.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{copy.completedScreenings}</p>
              <p className="mt-2 text-2xl font-semibold">{metrics.screenedCandidates}</p>
              <p className="mt-1 text-sm text-slate-300">{copy.completedDescription}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{copy.strongCandidates}</p>
              <p className="mt-2 text-2xl font-semibold">{metrics.strongCandidates}</p>
              <p className="mt-1 text-sm text-slate-300">{copy.strongDescription}</p>
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
          <p className="text-sm text-slate-500">{copy.jobs}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.totalJobs}</p>
          <p className="mt-2 text-sm text-slate-500">
            {metrics.publishedJobs} {copy.publishedJobs}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.resumePool}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.totalResumes}</p>
          <p className="mt-2 text-sm text-slate-500">{copy.resumePoolDescription}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.screening}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.screenedCandidates}</p>
          <p className="mt-2 text-sm text-slate-500">{copy.screeningDescription}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.moveForward}</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{metrics.strongCandidates}</p>
          <p className="mt-2 text-sm text-slate-500">{copy.moveForwardDescription}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{copy.jobPipeline}</h3>
              <p className="mt-1 text-sm text-slate-500">{copy.jobPipelineDescription}</p>
            </div>
            <Briefcase className="h-5 w-5 text-primary-600" />
          </div>

          <div className="mt-5 space-y-3">
            {latestJobs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
                {copy.emptyJobs}
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
                    {jobStatusLabel(job.status, language)}
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
              <h3 className="text-lg font-semibold text-slate-900">{copy.aiCandidates}</h3>
              <p className="mt-1 text-sm text-slate-500">{copy.aiCandidatesDescription}</p>
            </div>
            <Target className="h-5 w-5 text-primary-600" />
          </div>

          <div className="mt-5 space-y-3">
            {shortlist.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
                {copy.emptyShortlist}
              </div>
            )}

            {shortlist.map((record) => (
              <div key={record.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {record.candidateName || copy.unnamedCandidate}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{record.jobTitle}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${recommendationTone(record.overallScore)}`}>
                    {record.overallScore}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{record.summary}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{record.highlights[0] || copy.highlightFallback}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <FileSearch className="h-4 w-4 text-primary-600" />
                  <span>
                    {record.questions.length} {copy.generatedQuestions}
                  </span>
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
              <p className="text-sm font-medium text-slate-900">{copy.step1}</p>
              <p className="mt-1 text-sm text-slate-500">{copy.step1Desc}</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-100 p-3 text-violet-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{copy.step2}</p>
              <p className="mt-1 text-sm text-slate-500">{copy.step2Desc}</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{copy.step3}</p>
              <p className="mt-1 text-sm text-slate-500">{copy.step3Desc}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
