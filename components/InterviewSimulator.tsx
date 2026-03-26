'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Save,
  Sparkles,
  Square,
  Target,
  TrendingUp,
  User,
  Video,
} from 'lucide-react'

import type { AssessmentMode, AssessmentRecord, AssessmentRecommendation } from '@/types/assessment'
import type { JobRecord } from '@/types/job'
import type { ResumeListItem } from '@/types/resume'

type RecordingState = 'idle' | 'recording' | 'paused'

function preferredAudioMimeType() {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return ''
  }

  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus'
  }

  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm'
  }

  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return 'audio/mp4'
  }

  return ''
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(1, '0')}:${(seconds % 60)
    .toString()
    .padStart(2, '0')}`
}

function recommendationLabel(value: AssessmentRecommendation | null) {
  switch (value) {
    case 'strong_yes':
      return 'Strong Yes'
    case 'yes':
      return 'Yes'
    case 'hold':
      return 'Hold'
    case 'no':
      return 'No'
    default:
      return 'Pending'
  }
}

function recommendationColor(value: AssessmentRecommendation | null) {
  switch (value) {
    case 'strong_yes':
      return 'bg-emerald-100 text-emerald-700'
    case 'yes':
      return 'bg-blue-100 text-blue-700'
    case 'hold':
      return 'bg-amber-100 text-amber-700'
    case 'no':
      return 'bg-rose-100 text-rose-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function statusColor(status: AssessmentRecord['status']) {
  switch (status) {
    case 'scored':
      return 'bg-emerald-100 text-emerald-700'
    case 'submitted':
      return 'bg-blue-100 text-blue-700'
    case 'in_progress':
      return 'bg-amber-100 text-amber-700'
    case 'draft':
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function syncRecord(records: AssessmentRecord[], next: AssessmentRecord) {
  const index = records.findIndex((item) => item.id === next.id)
  if (index === -1) {
    return [next, ...records]
  }

  const updated = [...records]
  updated[index] = next
  return updated.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

export function InterviewSimulator() {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [records, setRecords] = useState<AssessmentRecord[]>([])
  const [mode, setMode] = useState<AssessmentMode>('interview')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [transcribingQuestionId, setTranscribingQuestionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingQuestionIdRef = useRef<string | null>(null)

  const activeRecord = useMemo(
    () => records.find((item) => item.id === activeRecordId) ?? null,
    [records, activeRecordId]
  )

  const scoredRecords = useMemo(
    () => records.filter((item) => item.status === 'scored' && item.summary.overallScore !== null),
    [records]
  )

  const stats = useMemo(() => {
    const averageScore =
      scoredRecords.length === 0
        ? 0
        : Math.round(
            scoredRecords.reduce((sum, item) => sum + (item.summary.overallScore ?? 0), 0) / scoredRecords.length
          )

    return {
      total: records.length,
      interviews: records.filter((item) => item.mode === 'interview').length,
      written: records.filter((item) => item.mode === 'written').length,
      averageScore,
    }
  }, [records, scoredRecords])

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError('')

        const [jobResponse, resumeResponse, assessmentResponse] = await Promise.all([
          fetch('/api/jobs?mode=published', { cache: 'no-store' }),
          fetch('/api/resumes', { cache: 'no-store' }),
          fetch('/api/assessments', { cache: 'no-store' }),
        ])

        const jobData = (await jobResponse.json()) as JobRecord[] | { error?: string }
        const resumeData = (await resumeResponse.json()) as ResumeListItem[] | { error?: string }
        const assessmentData = (await assessmentResponse.json()) as AssessmentRecord[] | { error?: string }

        if (!jobResponse.ok || !Array.isArray(jobData)) {
          throw new Error('Failed to load published jobs.')
        }

        if (!resumeResponse.ok || !Array.isArray(resumeData)) {
          throw new Error('Failed to load resume records.')
        }

        if (!assessmentResponse.ok || !Array.isArray(assessmentData)) {
          throw new Error('Failed to load assessment history.')
        }

        setJobs(jobData)
        setResumes(resumeData)
        setRecords(assessmentData)
        setSelectedJobId(jobData[0]?.id ?? '')
        setSelectedResumeId(resumeData[0]?.id ?? '')
        setActiveRecordId(assessmentData[0]?.id ?? null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load assessment studio.')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  useEffect(() => {
    if (recordingState !== 'recording') {
      return
    }

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1)
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [recordingState])

  useEffect(() => {
    if (!activeRecord) {
      setCurrentQuestion(0)
      setElapsedSeconds(0)
      setRecordingState('idle')
      return
    }

    setMode(activeRecord.mode)
    setSelectedJobId((current) => activeRecord.jobId ?? current)
    setSelectedResumeId((current) => activeRecord.resumeId ?? current)
    setCurrentQuestion(0)
    setElapsedSeconds(activeRecord.summary.sessionDurationSeconds)
    setRecordingState(activeRecord.mode === 'interview' && activeRecord.status === 'in_progress' ? 'paused' : 'idle')
  }, [activeRecordId])

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop())
      mediaRecorderRef.current = null
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
  }, [])

  function clearMediaSession() {
    mediaRecorderRef.current = null
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
    audioChunksRef.current = []
    recordingQuestionIdRef.current = null
  }

  function updateActiveRecord(next: AssessmentRecord) {
    setRecords((current) => syncRecord(current, next))
    setActiveRecordId(next.id)
  }

  async function uploadAudioForQuestion(questionId: string, blob: Blob) {
    if (!activeRecord) {
      clearMediaSession()
      return
    }

    try {
      setTranscribingQuestionId(questionId)
      setError('')
      setMessage(`Uploading Q${currentQuestion + 1} audio for transcription...`)

      const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
      const formData = new FormData()
      formData.append('questionId', questionId)
      formData.append('audio', new File([blob], `interview-q${currentQuestion + 1}.${extension}`, { type: blob.type || 'audio/webm' }))

      const response = await fetch(`/api/assessments/${activeRecord.id}/transcribe`, {
        method: 'POST',
        body: formData,
      })

      const data = (await response.json()) as {
        error?: string
        warning?: string | null
        transcript?: string | null
        record?: AssessmentRecord
      }

      if (!response.ok || !data.record) {
        throw new Error(data.error || 'Failed to transcribe interview audio.')
      }

      updateActiveRecord(data.record)

      if (data.warning) {
        setMessage(`Q${currentQuestion + 1} audio saved. ${data.warning}`)
        return
      }

      setMessage(`Q${currentQuestion + 1} audio transcribed and synced into the answer.`)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to transcribe interview audio.')
    } finally {
      setTranscribingQuestionId(null)
      clearMediaSession()
    }
  }

  function syncTranscriptToAnswer(questionId: string) {
    if (!activeRecord) {
      return
    }

    const currentAnswer = activeRecord.answers.find((item) => item.questionId === questionId)

    if (!currentAnswer?.transcript) {
      return
    }

    updateAnswer(questionId, currentAnswer.transcript)
    setMessage('Transcript copied into the editable answer box.')
  }

  async function generateAssessment() {
    try {
      setGenerating(true)
      setError('')
      setMessage('')

      const response = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          jobId: selectedJobId || undefined,
          resumeId: selectedResumeId || undefined,
        }),
      })

      const data = (await response.json()) as AssessmentRecord | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to generate assessment.')
      }

      updateActiveRecord(data)
      setElapsedSeconds(0)
      setRecordingState('idle')
      setMessage('Assessment generated successfully.')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to generate assessment.')
    } finally {
      setGenerating(false)
    }
  }

  function updateAnswer(questionId: string, answer: string) {
    if (!activeRecord) {
      return
    }

    const nextRecord: AssessmentRecord = {
      ...activeRecord,
      answers: activeRecord.answers.map((item) =>
        item.questionId === questionId
          ? {
              ...item,
              answer,
            }
          : item
      ),
    }

    updateActiveRecord(nextRecord)
  }

  async function saveDraft() {
    if (!activeRecord) {
      return
    }

    try {
      setSaving(true)
      setError('')
      setMessage('')

      const hasContent = activeRecord.answers.some((item) => item.answer.trim().length > 0)
      const response = await fetch(`/api/assessments/${activeRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: activeRecord.answers,
          sessionDurationSeconds: elapsedSeconds,
          status: activeRecord.status === 'scored' ? 'scored' : hasContent ? 'in_progress' : 'draft',
        }),
      })

      const data = (await response.json()) as AssessmentRecord | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to save draft.')
      }

      updateActiveRecord(data)
      setMessage('Draft saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save draft.')
    } finally {
      setSaving(false)
    }
  }

  async function submitForScoring() {
    if (!activeRecord) {
      return
    }

    try {
      setScoring(true)
      setError('')
      setMessage('')

      const response = await fetch(`/api/assessments/${activeRecord.id}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: activeRecord.answers,
          sessionDurationSeconds: elapsedSeconds,
        }),
      })

      const data = (await response.json()) as AssessmentRecord | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to score assessment.')
      }

      updateActiveRecord(data)
      setRecordingState('idle')
      setMessage('Assessment scored.')
    } catch (scoreError) {
      setError(scoreError instanceof Error ? scoreError.message : 'Failed to score assessment.')
    } finally {
      setScoring(false)
    }
  }

  async function beginInterviewSession() {
    if (!activeRecord || activeRecord.mode !== 'interview') {
      return
    }

    const activeQuestion = activeRecord.questions[currentQuestion]

    if (!activeQuestion) {
      setError('Please select a question before starting the recording.')
      return
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support microphone recording.')
      return
    }

    if (typeof MediaRecorder === 'undefined') {
      setError('This browser cannot create interview recordings.')
      return
    }

    try {
      setError('')
      setMessage('')
      audioChunksRef.current = []
      recordingQuestionIdRef.current = activeQuestion.id

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = preferredAudioMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

      mediaStreamRef.current = stream
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onerror = () => {
        setError('The interview recording failed. Please try again.')
        setRecordingState('idle')
        clearMediaSession()
      }

      recorder.onstop = () => {
        const questionId = activeQuestion.id
        const recordedBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })

        if (recordedBlob.size === 0) {
          clearMediaSession()
          setMessage('Recording stopped, but no audio was captured.')
          return
        }

        void uploadAudioForQuestion(questionId, recordedBlob)
      }

      const response = await fetch(`/api/assessments/${activeRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: activeRecord.answers,
          sessionDurationSeconds: elapsedSeconds,
          status: 'in_progress',
        }),
      })

      const data = (await response.json()) as AssessmentRecord | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to start interview session.')
      }

      recorder.start(250)
      updateActiveRecord(data)
      setRecordingState('recording')
      setMessage(`Recording Q${currentQuestion + 1}. Stop when this answer is finished, then we'll transcribe it automatically.`)
    } catch (sessionError) {
      clearMediaSession()
      setError(sessionError instanceof Error ? sessionError.message : 'Failed to start interview session.')
    }
  }

  function toggleRecordingPause() {
    const recorder = mediaRecorderRef.current

    if (!recorder) {
      setRecordingState((current) => (current === 'recording' ? 'paused' : 'recording'))
      return
    }

    if (recordingState === 'recording' && recorder.state === 'recording') {
      recorder.pause()
      setRecordingState('paused')
      setMessage('Recording paused. The timer is paused too.')
      return
    }

    if (recordingState === 'paused' && recorder.state === 'paused') {
      recorder.resume()
      setRecordingState('recording')
      setMessage('Recording resumed.')
    }
  }

  function stopInterviewSession() {
    const recorder = mediaRecorderRef.current

    setRecordingState('idle')
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      return
    }

    clearMediaSession()
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Loading assessment studio...</span>
      </div>
    )
  }

  return (
    <div className="notranslate space-y-6" translate="no">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Assessment Studio</h1>
          <p className="mt-2 text-gray-600">
            Generate written tests or interview loops, capture answers, and score candidates in one place.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          With `OPENAI_API_KEY`, generation and scoring upgrade to OpenAI. Without it, the MVP falls back to local scoring rules.
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card"><p className="text-sm text-gray-500">Assessments</p><p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Interview Sessions</p><p className="mt-1 text-2xl font-bold text-violet-700">{stats.interviews}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Written Tests</p><p className="mt-1 text-2xl font-bold text-blue-700">{stats.written}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Average Score</p><p className="mt-1 text-2xl font-bold text-emerald-700">{stats.averageScore}%</p></div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Mode</label>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as AssessmentMode)}
              className="input-field"
              disabled={recordingState !== 'idle' || transcribingQuestionId !== null}
            >
              <option value="interview">Interview Session</option>
              <option value="written">Written Assessment</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Job</label>
            <select
              value={selectedJobId}
              onChange={(event) => setSelectedJobId(event.target.value)}
              className="input-field"
              disabled={recordingState !== 'idle' || transcribingQuestionId !== null}
            >
              <option value="">General role</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} - {job.company}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Candidate Resume</label>
            <select
              value={selectedResumeId}
              onChange={(event) => setSelectedResumeId(event.target.value)}
              className="input-field"
              disabled={recordingState !== 'idle' || transcribingQuestionId !== null}
            >
              <option value="">No linked resume</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.contact.name || resume.fileName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={generateAssessment}
              className="btn-primary flex w-full items-center justify-center gap-2"
              disabled={generating || recordingState !== 'idle' || transcribingQuestionId !== null}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span>{generating ? 'Generating...' : 'Generate Question Set'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="card">
            {activeRecord ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold text-gray-900">{activeRecord.title}</h2>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor(activeRecord.status)}`}>
                        {activeRecord.status}
                      </span>
                      <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700">
                        {activeRecord.source}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{activeRecord.generatedFrom}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" />{activeRecord.jobTitle || 'General role'}</span>
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{activeRecord.candidateName || 'No linked candidate'}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDuration(elapsedSeconds)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={saveDraft}
                      className="btn-secondary flex items-center gap-2"
                      disabled={saving || recordingState !== 'idle' || transcribingQuestionId !== null}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                    </button>
                    <button
                      onClick={submitForScoring}
                      className="btn-primary"
                      disabled={scoring || recordingState !== 'idle' || transcribingQuestionId !== null}
                    >
                      {scoring ? 'Scoring...' : 'Submit and Score'}
                    </button>
                  </div>
                </div>

                {activeRecord.mode === 'interview' && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-col gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Interview Session Controls</h3>
                        <p className="mt-1 text-sm text-gray-600">
                          Continue, pause, and stop the session. The timer pauses together with the recording state.
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                          Current question: Q{currentQuestion + 1}
                          {transcribingQuestionId === activeRecord.questions[currentQuestion]?.id ? ' - transcribing audio...' : ''}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-gray-600">
                          <div className={`h-2.5 w-2.5 rounded-full ${recordingState === 'recording' ? 'bg-red-500 animate-pulse' : recordingState === 'paused' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                          <span>{recordingState === 'recording' ? 'Recording' : recordingState === 'paused' ? 'Paused' : 'Idle'}</span>
                        </div>
                        <div className="rounded-xl border border-white bg-white px-4 py-3">
                          <p className="text-xs uppercase tracking-wide text-gray-500">Recording Time</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900">{formatDuration(elapsedSeconds)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                        {recordingState === 'idle' ? (
                          <button
                            onClick={beginInterviewSession}
                            className="btn-primary flex items-center gap-2"
                            disabled={transcribingQuestionId !== null}
                          >
                            {transcribingQuestionId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            <span>{transcribingQuestionId ? 'Transcribing...' : 'Continue'}</span>
                          </button>
                        ) : (
                          <>
                            <button onClick={toggleRecordingPause} className="btn-secondary flex items-center gap-2">
                              {recordingState === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                              <span>{recordingState === 'paused' ? 'Continue' : 'Pause'}</span>
                            </button>
                            <button onClick={stopInterviewSession} className="btn-primary flex items-center gap-2">
                              <Square className="h-4 w-4" />
                              <span>Stop</span>
                            </button>
                          </>
                        )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="space-y-3 lg:col-span-1">
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        {activeRecord.mode === 'written' ? <FileText className="h-5 w-5 text-blue-600" /> : <Video className="h-5 w-5 text-violet-600" />}
                        <h3 className="text-lg font-semibold text-gray-900">Question Bank</h3>
                      </div>
                      <div className="space-y-3">
                        {activeRecord.questions.map((question, index) => (
                          <button
                            key={question.id}
                            onClick={() => setCurrentQuestion(index)}
                            disabled={recordingState !== 'idle' || transcribingQuestionId !== null}
                            className={`w-full rounded-xl border p-3 text-left transition-colors ${
                              index === currentQuestion ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                            } ${recordingState !== 'idle' || transcribingQuestionId !== null ? 'cursor-not-allowed opacity-70' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-gray-900">Q{index + 1}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                                {question.category}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-3 text-sm text-gray-600">{question.prompt}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 lg:col-span-2">
                    {activeRecord.questions.map((question, index) => {
                      const answer = activeRecord.answers.find((item) => item.questionId === question.id)
                      const isCurrent = currentQuestion === index
                      return (
                        <div key={question.id} className={`rounded-xl border p-4 ${isCurrent ? 'border-primary-400 bg-primary-50/30' : 'border-gray-200 bg-white'}`}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-gray-900 px-2 py-1 text-xs font-medium text-white">Q{index + 1}</span>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{question.difficulty}</span>
                                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">{question.maxScore} pts</span>
                              </div>
                              <p className="mt-3 text-sm font-medium text-gray-900">{question.prompt}</p>
                            </div>
                            {answer?.score !== null && (
                              <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                                {answer?.score ?? 0}/{question.maxScore}
                              </div>
                            )}
                          </div>

                          <div className="mt-4">
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                              {activeRecord.mode === 'written' ? 'Candidate Answer' : 'Interview Notes / Transcript'}
                            </label>
                            <textarea
                              rows={activeRecord.mode === 'written' ? 7 : 5}
                              value={answer?.answer ?? ''}
                              onChange={(event) => updateAnswer(question.id, event.target.value)}
                              className="input-field"
                              placeholder={activeRecord.mode === 'written' ? 'Write the answer here...' : 'Paste or summarize the spoken answer here...'}
                            />
                          </div>

                          {activeRecord.mode === 'interview' && (
                            <div className="mt-4 rounded-lg border border-dashed border-violet-200 bg-violet-50/60 p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="text-sm font-medium text-violet-900">Auto Transcript</p>
                                  <p className="mt-1 text-xs text-violet-700">
                                    {answer?.audioAsset.uploadedAt
                                      ? `Last upload: ${new Date(answer.audioAsset.uploadedAt).toLocaleString()}`
                                      : 'Record this question, stop, and the audio will upload for transcription.'}
                                  </p>
                                </div>
                                {answer?.transcript && (
                                  <button onClick={() => syncTranscriptToAnswer(question.id)} className="btn-secondary text-xs">
                                    Replace Notes With Transcript
                                  </button>
                                )}
                              </div>
                              <p className="mt-3 text-sm text-violet-900">
                                {transcribingQuestionId === question.id
                                  ? 'Transcribing audio...'
                                  : answer?.transcript ||
                                    (answer?.audioAsset.uploadedAt
                                      ? 'Audio saved for this question. Transcript is not available yet.'
                                      : 'No transcript yet for this question.')}
                              </p>
                              {answer?.audioAsset.fileName && (
                                <p className="mt-2 text-xs text-violet-700">
                                  Audio: {answer.audioAsset.fileName} ({answer.audioAsset.mimeType || 'audio file'})
                                </p>
                              )}
                            </div>
                          )}

                          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <div className="rounded-lg bg-gray-50 p-4">
                              <p className="text-sm font-medium text-gray-900">Expected Points</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {question.expectedPoints.map((point) => (
                                  <span key={point} className="rounded-md bg-primary-100 px-2 py-1 text-xs text-primary-700">
                                    {point}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-4">
                              <p className="text-sm font-medium text-gray-900">Evaluator Feedback</p>
                              <p className="mt-2 text-sm text-gray-600">
                                {answer?.feedback ?? 'Feedback appears after scoring.'}
                              </p>
                              {(answer?.strengths.length ?? 0) > 0 && (
                                <p className="mt-2 text-xs text-emerald-700">Strengths: {answer?.strengths.join(', ')}</p>
                              )}
                              {(answer?.gaps.length ?? 0) > 0 && (
                                <p className="mt-1 text-xs text-amber-700">Gaps: {answer?.gaps.join(', ')}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <GraduationCap className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No assessment selected</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Generate a written test or interview session to start scoring candidates.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Scoring Summary</h3>
              <TrendingUp className="h-5 w-5 text-primary-500" />
            </div>
            {activeRecord ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Overall Score</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {activeRecord.summary.overallScore ?? '--'}{activeRecord.summary.overallScore !== null ? '%' : ''}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${recommendationColor(activeRecord.summary.recommendation)}`}>
                    {recommendationLabel(activeRecord.summary.recommendation)}
                  </span>
                </div>

                <div className="space-y-3">
                  {[
                    { key: 'technical', label: 'Technical', value: activeRecord.summary.rubric.technical },
                    { key: 'communication', label: 'Communication', value: activeRecord.summary.rubric.communication },
                    { key: 'structuredThinking', label: 'Structured Thinking', value: activeRecord.summary.rubric.structuredThinking },
                    { key: 'roleFit', label: 'Role Fit', value: activeRecord.summary.rubric.roleFit },
                  ].map((item) => (
                    <div key={item.key}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-medium text-gray-900">{item.value}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${item.value}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">Decision Summary</p>
                  <p className="mt-2 text-sm text-gray-600">{activeRecord.summary.summary}</p>
                  <p className="mt-3 text-sm font-medium text-gray-900">Next Step</p>
                  <p className="mt-1 text-sm text-gray-600">{activeRecord.summary.nextStep}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Generate and score an assessment to see the summary.</p>
            )}
          </div>

          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent History</h3>
              <MessageSquare className="h-5 w-5 text-primary-500" />
            </div>
            <div className="space-y-3">
              {records.length === 0 && (
                <p className="text-sm text-gray-500">No assessment history yet.</p>
              )}
              {records.map((record) => (
                <button
                  key={record.id}
                  onClick={() => setActiveRecordId(record.id)}
                  disabled={recordingState !== 'idle' || transcribingQuestionId !== null}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    activeRecordId === record.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                  } ${recordingState !== 'idle' || transcribingQuestionId !== null ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-gray-900">{record.title}</p>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusColor(record.status)}`}>
                      {record.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {record.mode === 'written' ? 'Written' : 'Interview'} · {record.jobTitle || 'General role'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {record.candidateName || 'No linked candidate'} · {record.summary.overallScore ?? '--'}{record.summary.overallScore !== null ? '%' : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
