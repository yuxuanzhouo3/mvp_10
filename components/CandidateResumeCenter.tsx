'use client'

import type { ChangeEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, Download, FileText, Loader2, Mail, MapPin, Phone, TrendingUp, Upload, User } from 'lucide-react'

import { getStoredAuthToken } from './AuthProvider'
import { TechnicalTag } from './TechnicalText'
import { downloadResumeOriginalFile } from '@/lib/client/resume-download'
import type { ResumeInsight, ResumeListItem, ResumeRecord } from '@/types/resume'

function getAuthorizedHeaders() {
  const token = getStoredAuthToken()

  if (!token) {
    throw new Error('请先重新登录。')
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

function insightTone(type: ResumeInsight['type']) {
  switch (type) {
    case 'strength':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'improvement':
    default:
      return 'border-sky-200 bg-sky-50 text-sky-700'
  }
}

function insightTitle(type: ResumeInsight['type']) {
  switch (type) {
    case 'strength':
      return '简历亮点'
    case 'warning':
      return '需要注意'
    case 'improvement':
    default:
      return '改进建议'
  }
}

export function CandidateResumeCenter() {
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [activeResume, setActiveResume] = useState<ResumeRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloadingResumeId, setDownloadingResumeId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    void loadResumes()
  }, [])

  const stats = useMemo(() => {
    return {
      total: resumes.length,
      bestScore: resumes[0]?.score ?? 0,
      latest: resumes[0] ? new Date(resumes[0].createdAt).toLocaleDateString() : '暂无',
      bestAction: activeResume?.workflow.recommendedNextAction ?? '上传简历后，系统会给出改进建议。',
    }
  }, [activeResume?.workflow.recommendedNextAction, resumes])

  const groupedInsights = useMemo(() => {
    return {
      strengths: activeResume?.insights.filter((item) => item.type === 'strength') ?? [],
      suggestions:
        activeResume?.insights.filter((item) => item.type === 'improvement' || item.type === 'warning') ?? [],
    }
  }, [activeResume?.insights])

  async function loadResumes(preferredId?: string) {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/resumes?scope=me', {
        cache: 'no-store',
        headers: getAuthorizedHeaders(),
      })
      const payload = (await response.json()) as ResumeListItem[] | { error?: string }

      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(!Array.isArray(payload) && payload.error ? payload.error : '简历列表加载失败。')
      }

      setResumes(payload)
      const nextId = preferredId ?? activeResume?.id ?? payload[0]?.id

      if (nextId) {
        await loadResumeDetail(nextId)
      } else {
        setActiveResume(null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '简历列表加载失败。')
    } finally {
      setLoading(false)
    }
  }

  async function loadResumeDetail(id: string) {
    try {
      setLoadingDetail(true)
      const response = await fetch(`/api/resumes/${id}`, {
        cache: 'no-store',
        headers: getAuthorizedHeaders(),
      })
      const payload = (await response.json()) as ResumeRecord | { error?: string }

      if (!response.ok || !('id' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : '简历详情加载失败。')
      }

      setActiveResume(payload)
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : '简历详情加载失败。')
    } finally {
      setLoadingDetail(false)
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      setUploading(true)
      setError('')
      setMessage('')

      const formData = new FormData()
      formData.append('resume', file)

      const response = await fetch('/api/resumes', {
        method: 'POST',
        headers: getAuthorizedHeaders(),
        body: formData,
      })

      const payload = (await response.json()) as ResumeRecord | { error?: string }
      if (!response.ok || !('id' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : '简历上传失败。')
      }

      setMessage('简历已上传并完成分析。')
      await loadResumes(payload.id)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '简历上传失败。')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function handleDownloadResume(record: Pick<ResumeRecord, 'id' | 'fileName'>) {
    try {
      setDownloadingResumeId(record.id)
      setError('')

      await downloadResumeOriginalFile({
        resumeId: record.id,
        fileName: record.fileName,
        token: getStoredAuthToken(),
      })
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Resume download failed.')
    } finally {
      setDownloadingResumeId(null)
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">正在加载我的简历...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f5f7fb)] p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold text-slate-900">我的简历中心</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            这里会保留邮箱、电话、地点等完整信息，并展示评分、亮点、改进建议和原文预览。
          </p>
        </div>
        <label className="btn-primary inline-flex cursor-pointer items-center gap-2">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span>{uploading ? '上传中...' : '上传新简历'}</span>
          <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.doc,.docx,.txt" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">简历版本</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">当前最佳评分</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{stats.bestScore}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">最近上传</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{stats.latest}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">当前优化重点</p>
          <p className="mt-2 text-sm font-medium leading-7 text-slate-900">{stats.bestAction}</p>
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">简历版本</h3>

          {resumes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
              还没有上传简历，先上传一份开始分析和投递。
            </div>
          )}

          {resumes.map((resume) => (
            <button
              key={resume.id}
              onClick={() => void loadResumeDetail(resume.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                activeResume?.id === resume.id ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-slate-900">{resume.fileName}</p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{resume.score} 分</span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-slate-500">{resume.summary}</p>
            </button>
          ))}
        </div>

        <div className="card">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
              <span className="text-sm text-slate-500">正在加载简历详情...</span>
            </div>
          ) : activeResume ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">{activeResume.fileName}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{activeResume.summary}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownloadResume(activeResume)}
                  disabled={downloadingResumeId === activeResume.id}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadingResumeId === activeResume.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>{downloadingResumeId === activeResume.id ? '下载中...' : '下载原简历'}</span>
                </button>
                <div className="rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-600">
                  简历评分
                  <span className="ml-3 text-2xl font-semibold text-slate-900">{activeResume.score}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <User className="h-4 w-4" />
                    <p className="text-xs">姓名</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">{activeResume.contact.name || '未识别'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Mail className="h-4 w-4" />
                    <p className="text-xs">邮箱</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">{activeResume.contact.email || '未识别'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone className="h-4 w-4" />
                    <p className="text-xs">电话</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">{activeResume.contact.phone || '未识别'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin className="h-4 w-4" />
                    <p className="text-xs">地点</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">{activeResume.contact.location || '未识别'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">当前岗位</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{activeResume.profile.currentTitle || '未识别'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">经验年限</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {activeResume.profile.yearsExperience !== null ? `${activeResume.profile.yearsExperience} 年` : '未识别'}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary-600" />
                  <p className="text-sm font-medium text-slate-900">核心技能</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeResume.profile.skills.length > 0 ? (
                    activeResume.profile.skills.map((skill) => (
                      <TechnicalTag key={skill} text={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600" />
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">暂未识别到明确技能关键词。</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-900">技能亮点</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeResume.profile.highlights.length > 0 ? (
                    activeResume.profile.highlights.map((item) => (
                      <span key={item} className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">上传并解析后，这里会展示更细的技能亮点。</span>
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-900">简历亮点</p>
                  <div className="mt-3 space-y-3">
                    {groupedInsights.strengths.length > 0 ? (
                      groupedInsights.strengths.map((item) => (
                        <div key={`${item.title}-${item.description}`} className={`rounded-2xl border p-3 ${insightTone(item.type)}`}>
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="mt-2 text-sm leading-7">{item.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">暂未生成明显亮点。</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-900">改进建议与提醒</p>
                  <div className="mt-3 space-y-3">
                    {groupedInsights.suggestions.length > 0 ? (
                      groupedInsights.suggestions.map((item) => (
                        <div key={`${item.title}-${item.description}`} className={`rounded-2xl border p-3 ${insightTone(item.type)}`}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{item.title}</p>
                            <span className="text-[11px]">
                              {insightTitle(item.type)} · {item.priority === 'high' ? '优先' : item.priority === 'medium' ? '建议' : '可选'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-7">{item.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">当前没有需要额外补强的项。</p>
                    )}
                  </div>
                </div>
              </div>

              <details className="rounded-2xl bg-slate-50 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
                  展开原文预览
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </summary>
                <div className="mt-4 rounded-2xl bg-white p-4">
                  <p className="whitespace-pre-line text-sm leading-7 text-slate-600">{activeResume.extractedText}</p>
                </div>
              </details>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-slate-300" />
              <p className="mt-4 text-sm text-slate-500">上传或选择一份简历后，这里会显示评分、建议和完整预览。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
