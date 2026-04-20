'use client'

import type { ChangeEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  TrendingUp,
  Upload,
  User,
} from 'lucide-react'

import { formatDate, pickLanguage } from '@/lib/i18n'
import { getStoredAuthToken } from './AuthProvider'
import { useLanguage } from './LanguageProvider'
import { TechnicalTag } from './TechnicalText'
import { downloadResumeOriginalFile } from '@/lib/client/resume-download'
import type { ResumeInsight, ResumeListItem, ResumeRecord } from '@/types/resume'

function getAuthorizedHeaders() {
  const token = getStoredAuthToken()

  if (!token) {
    throw new Error('Please sign in again.')
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

function insightTitle(type: ResumeInsight['type'], language: 'zh' | 'en') {
  switch (type) {
    case 'strength':
      return pickLanguage(language, '简历亮点', 'Strength')
    case 'warning':
      return pickLanguage(language, '需要注意', 'Warning')
    case 'improvement':
    default:
      return pickLanguage(language, '改进建议', 'Improvement')
  }
}

export function CandidateResumeCenter() {
  const { language } = useLanguage()
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [activeResume, setActiveResume] = useState<ResumeRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloadingResumeId, setDownloadingResumeId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const copy = {
    title: pickLanguage(language, '我的简历中心', 'Resume Center'),
    description: pickLanguage(
      language,
      '这里会保留邮箱、电话、地点等完整信息，并展示评分、亮点、改进建议和原文预览。',
      'Keep all resume versions here with contact details, scores, strengths, improvements, and extracted text previews.'
    ),
    upload: pickLanguage(language, '上传新简历', 'Upload Resume'),
    uploading: pickLanguage(language, '上传中...', 'Uploading...'),
    total: pickLanguage(language, '简历版本', 'Resume Versions'),
    bestScore: pickLanguage(language, '当前最佳评分', 'Best Score'),
    latest: pickLanguage(language, '最近上传', 'Latest Upload'),
    bestAction: pickLanguage(language, '当前优化重点', 'Current Focus'),
    noDate: pickLanguage(language, '暂无', 'None yet'),
    bestActionFallback: pickLanguage(
      language,
      '上传简历后，系统会给出改进建议。',
      'Upload a resume and the system will suggest what to improve next.'
    ),
    loadFailed: pickLanguage(language, '简历列表加载失败。', 'Failed to load resumes.'),
    detailFailed: pickLanguage(language, '简历详情加载失败。', 'Failed to load the resume detail.'),
    uploadFailed: pickLanguage(language, '简历上传失败。', 'Failed to upload the resume.'),
    uploadSuccess: pickLanguage(language, '简历已上传并完成分析。', 'Resume uploaded and analyzed.'),
    loading: pickLanguage(language, '正在加载我的简历...', 'Loading your resumes...'),
    versions: pickLanguage(language, '简历版本', 'Resume Versions'),
    emptyVersions: pickLanguage(
      language,
      '还没有上传简历，先上传一份开始分析和投递。',
      'No resume yet. Upload one to start analysis and job applications.'
    ),
    loadingDetail: pickLanguage(language, '正在加载简历详情...', 'Loading resume detail...'),
    download: pickLanguage(language, '下载原简历', 'Download Original'),
    downloading: pickLanguage(language, '下载中...', 'Downloading...'),
    score: pickLanguage(language, '简历评分', 'Resume Score'),
    name: pickLanguage(language, '姓名', 'Name'),
    email: pickLanguage(language, '邮箱', 'Email'),
    phone: pickLanguage(language, '电话', 'Phone'),
    location: pickLanguage(language, '地点', 'Location'),
    currentTitle: pickLanguage(language, '当前岗位', 'Current Title'),
    yearsExperience: pickLanguage(language, '经验年限', 'Years of Experience'),
    skills: pickLanguage(language, '核心技能', 'Core Skills'),
    noSkills: pickLanguage(language, '暂未识别到明确技能关键词。', 'No clear skills detected yet.'),
    highlights: pickLanguage(language, '技能亮点', 'Highlight Skills'),
    noHighlights: pickLanguage(
      language,
      '上传并解析后，这里会展示更细的技能亮点。',
      'After analysis, more concrete highlight skills will appear here.'
    ),
    strengths: pickLanguage(language, '简历亮点', 'Strengths'),
    suggestions: pickLanguage(language, '改进建议与提醒', 'Improvements & Alerts'),
    noStrengths: pickLanguage(language, '暂未生成明显亮点。', 'No standout strengths yet.'),
    noSuggestions: pickLanguage(language, '当前没有需要额外补强的项。', 'Nothing urgent to improve right now.'),
    priorityHigh: pickLanguage(language, '优先', 'High'),
    priorityMedium: pickLanguage(language, '建议', 'Medium'),
    priorityLow: pickLanguage(language, '可选', 'Low'),
    preview: pickLanguage(language, '展开原文预览', 'Expand Extracted Text'),
    emptyState: pickLanguage(
      language,
      '上传或选择一份简历后，这里会显示评分、建议和完整预览。',
      'Upload or select a resume to see its score, suggestions, and full preview.'
    ),
    notDetected: pickLanguage(language, '未识别', 'Not detected'),
    notAvailable: pickLanguage(language, '未补充', 'Not provided'),
    downloadFailed: pickLanguage(language, '简历下载失败。', 'Resume download failed.'),
  }

  useEffect(() => {
    void loadResumes()
  }, [])

  const stats = useMemo(() => {
    return {
      total: resumes.length,
      bestScore: resumes[0]?.score ?? 0,
      latest: resumes[0] ? formatDate(resumes[0].createdAt, language) : copy.noDate,
      bestAction: activeResume?.workflow.recommendedNextAction ?? copy.bestActionFallback,
    }
  }, [activeResume?.workflow.recommendedNextAction, copy.bestActionFallback, copy.noDate, language, resumes])

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
        throw new Error(!Array.isArray(payload) && payload.error ? payload.error : copy.loadFailed)
      }

      setResumes(payload)
      const nextId = preferredId ?? activeResume?.id ?? payload[0]?.id

      if (nextId) {
        await loadResumeDetail(nextId)
      } else {
        setActiveResume(null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed)
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
        throw new Error('error' in payload && payload.error ? payload.error : copy.detailFailed)
      }

      setActiveResume(payload)
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : copy.detailFailed)
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
        throw new Error('error' in payload && payload.error ? payload.error : copy.uploadFailed)
      }

      setMessage(copy.uploadSuccess)
      await loadResumes(payload.id)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : copy.uploadFailed)
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
      setError(downloadError instanceof Error ? downloadError.message : copy.downloadFailed)
    } finally {
      setDownloadingResumeId(null)
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
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f5f7fb)] p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold text-slate-900">{copy.title}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">{copy.description}</p>
        </div>
        <label className="btn-primary inline-flex cursor-pointer items-center gap-2">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span>{uploading ? copy.uploading : copy.upload}</span>
          <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.doc,.docx,.txt" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">{copy.total}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.bestScore}</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{stats.bestScore}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.latest}</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{stats.latest}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{copy.bestAction}</p>
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
          <h3 className="text-lg font-semibold text-slate-900">{copy.versions}</h3>

          {resumes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
              {copy.emptyVersions}
            </div>
          )}

          {resumes.map((resume) => (
            <button
              key={resume.id}
              onClick={() => void loadResumeDetail(resume.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                activeResume?.id === resume.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-slate-900">{resume.fileName}</p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {resume.score}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-6 text-slate-500">{resume.summary}</p>
            </button>
          ))}
        </div>

        <div className="card">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-slate-400" />
              <span className="text-sm text-slate-500">{copy.loadingDetail}</span>
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
                  <span>{downloadingResumeId === activeResume.id ? copy.downloading : copy.download}</span>
                </button>
                <div className="rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-600">
                  {copy.score}
                  <span className="ml-3 text-2xl font-semibold text-slate-900">{activeResume.score}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <User className="h-4 w-4" />
                    <p className="text-xs">{copy.name}</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {activeResume.contact.name || copy.notDetected}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Mail className="h-4 w-4" />
                    <p className="text-xs">{copy.email}</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {activeResume.contact.email || copy.notDetected}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone className="h-4 w-4" />
                    <p className="text-xs">{copy.phone}</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {activeResume.contact.phone || copy.notDetected}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin className="h-4 w-4" />
                    <p className="text-xs">{copy.location}</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {activeResume.contact.location || copy.notDetected}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">{copy.currentTitle}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {activeResume.profile.currentTitle || copy.notDetected}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">{copy.yearsExperience}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {activeResume.profile.yearsExperience !== null
                      ? pickLanguage(
                          language,
                          `${activeResume.profile.yearsExperience} 年`,
                          `${activeResume.profile.yearsExperience} years`
                        )
                      : copy.notDetected}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary-600" />
                  <p className="text-sm font-medium text-slate-900">{copy.skills}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeResume.profile.skills.length > 0 ? (
                    activeResume.profile.skills.map((skill) => (
                      <TechnicalTag
                        key={skill}
                        text={skill}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                      />
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">{copy.noSkills}</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-900">{copy.highlights}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeResume.profile.highlights.length > 0 ? (
                    activeResume.profile.highlights.map((item) => (
                      <span key={item} className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">{copy.noHighlights}</span>
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-900">{copy.strengths}</p>
                  <div className="mt-3 space-y-3">
                    {groupedInsights.strengths.length > 0 ? (
                      groupedInsights.strengths.map((item) => (
                        <div key={`${item.title}-${item.description}`} className={`rounded-2xl border p-3 ${insightTone(item.type)}`}>
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="mt-2 text-sm leading-7">{item.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">{copy.noStrengths}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-900">{copy.suggestions}</p>
                  <div className="mt-3 space-y-3">
                    {groupedInsights.suggestions.length > 0 ? (
                      groupedInsights.suggestions.map((item) => (
                        <div key={`${item.title}-${item.description}`} className={`rounded-2xl border p-3 ${insightTone(item.type)}`}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{item.title}</p>
                            <span className="text-[11px]">
                              {insightTitle(item.type, language)} ·{' '}
                              {item.priority === 'high'
                                ? copy.priorityHigh
                                : item.priority === 'medium'
                                  ? copy.priorityMedium
                                  : copy.priorityLow}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-7">{item.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">{copy.noSuggestions}</p>
                    )}
                  </div>
                </div>
              </div>

              <details className="rounded-2xl bg-slate-50 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
                  {copy.preview}
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </summary>
                <div className="mt-4 rounded-2xl bg-white p-4">
                  <p className="whitespace-pre-line text-sm leading-7 text-slate-600">
                    {activeResume.extractedText}
                  </p>
                </div>
              </details>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-slate-300" />
              <p className="mt-4 text-sm text-slate-500">{copy.emptyState}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
