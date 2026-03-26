'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Building2, Loader2, Save, Send, ShieldAlert, Users } from 'lucide-react'

import { JobBoardManager } from './JobBoardManager'
import type {
  OrganizationContactInfo,
  OrganizationLead,
  OrganizationStage,
} from '@/types/organization'
import type {
  ModerationReport,
  ModerationReportStatus,
  ModerationSubjectType,
} from '@/types/report'

const ORGANIZATION_STAGES: OrganizationStage[] = [
  'new',
  'qualified',
  'invited',
  'responded',
  'onboarded',
  'rejected',
]

const REPORT_SUBJECT_TYPES: ModerationSubjectType[] = [
  'candidate',
  'employer',
  'interviewer',
  'job',
  'platform',
  'other',
]

const REPORT_STATUSES: ModerationReportStatus[] = ['open', 'reviewing', 'resolved', 'dismissed']

function emptyLeadForm() {
  return { companyName: '', publicText: '' }
}

function emptyReportForm() {
  return {
    subjectType: 'other' as ModerationSubjectType,
    subjectId: '',
    reporterName: '',
    reporterEmail: '',
    reason: '',
    details: '',
  }
}

export function OperationsCenter() {
  const [leads, setLeads] = useState<OrganizationLead[]>([])
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [leadDraft, setLeadDraft] = useState<OrganizationLead | null>(null)
  const [leadForm, setLeadForm] = useState(emptyLeadForm)
  const [reportForm, setReportForm] = useState(emptyReportForm)
  const [loading, setLoading] = useState(true)
  const [creatingLead, setCreatingLead] = useState(false)
  const [savingLead, setSavingLead] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [creatingReport, setCreatingReport] = useState(false)
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null)
  const [inviteFeedback, setInviteFeedback] = useState('')
  const [error, setError] = useState('')

  const selectedLead = useMemo(
    () => leads.find((item) => item.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  )

  const stats = useMemo(() => {
    return {
      employers: leads.length,
      invited: leads.filter((lead) => lead.communication.inviteEmailStatus === 'sent').length,
      onboarded: leads.filter((lead) => lead.workflow.stage === 'onboarded').length,
      openReports: reports.filter((report) => report.status === 'open').length,
    }
  }, [leads, reports])

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    setLeadDraft(selectedLead)
    setInviteFeedback('')
  }, [selectedLead])

  async function loadData() {
    try {
      setLoading(true)
      setError('')

      const [leadResponse, reportResponse] = await Promise.all([
        fetch('/api/organizations', { cache: 'no-store' }),
        fetch('/api/reports', { cache: 'no-store' }),
      ])

      const leadData = (await leadResponse.json()) as OrganizationLead[] | { error?: string }
      const reportData = (await reportResponse.json()) as ModerationReport[] | { error?: string }

      if (!leadResponse.ok || !Array.isArray(leadData)) {
        throw new Error('Failed to load employer leads.')
      }

      if (!reportResponse.ok || !Array.isArray(reportData)) {
        throw new Error('Failed to load moderation reports.')
      }

      setLeads(leadData)
      setReports(reportData)
      setSelectedLeadId((current) => current ?? leadData[0]?.id ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load operations data.')
    } finally {
      setLoading(false)
    }
  }

  async function createLead() {
    if (!leadForm.companyName.trim() && !leadForm.publicText.trim()) {
      setError('Enter a company name or paste public lead text first.')
      return
    }

    try {
      setCreatingLead(true)
      setError('')

      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: leadForm.companyName,
          publicText: leadForm.publicText,
          source: leadForm.publicText.trim() ? 'public_text' : 'manual',
        }),
      })

      const data = (await response.json()) as OrganizationLead | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to create employer lead.')
      }

      setLeads((current) => [data, ...current.filter((item) => item.id !== data.id)])
      setSelectedLeadId(data.id)
      setLeadForm(emptyLeadForm())
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create employer lead.')
    } finally {
      setCreatingLead(false)
    }
  }

  function updateLeadContact<K extends keyof OrganizationContactInfo>(
    field: K,
    value: OrganizationContactInfo[K]
  ) {
    setLeadDraft((current) =>
      current
        ? {
            ...current,
            contact: {
              ...current.contact,
              [field]: value,
            },
          }
        : current
    )
  }

  async function saveLead() {
    if (!leadDraft) {
      return
    }

    try {
      setSavingLead(true)
      setError('')

      const response = await fetch(`/api/organizations/${leadDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: leadDraft.companyName,
          website: leadDraft.website ?? '',
          publicText: leadDraft.publicText,
          stage: leadDraft.workflow.stage,
          notes: leadDraft.workflow.notes,
          recommendedNextAction: leadDraft.workflow.recommendedNextAction,
          contact: leadDraft.contact,
        }),
      })

      const data = (await response.json()) as OrganizationLead | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to save employer lead.')
      }

      setLeads((current) => current.map((item) => (item.id === data.id ? data : item)))
      setLeadDraft(data)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save employer lead.')
    } finally {
      setSavingLead(false)
    }
  }

  async function sendInvite() {
    if (!leadDraft?.contact.email) {
      return
    }

    try {
      setSendingInvite(true)
      setInviteFeedback('')
      setError('')

      const response = await fetch(`/api/organizations/${leadDraft.id}/invite`, {
        method: 'POST',
      })

      const data = (await response.json()) as
        | {
            record?: OrganizationLead | null
            delivery?: { mode: 'smtp' | 'preview'; message: string; text: string }
            error?: string
          }
        | { error?: string }

      if (!response.ok) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to send employer invite.')
      }

      if ('record' in data && data.record && 'id' in data.record) {
        setLeads((current) => current.map((item) => (item.id === data.record!.id ? data.record! : item)))
        setLeadDraft(data.record)
      }

      if ('delivery' in data && data.delivery) {
        setInviteFeedback(
          data.delivery.mode === 'preview'
            ? `${data.delivery.message}\n\n${data.delivery.text}`
            : data.delivery.message
        )
      }
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Failed to send employer invite.')
    } finally {
      setSendingInvite(false)
    }
  }

  async function createReport() {
    if (!reportForm.reason.trim() || !reportForm.details.trim()) {
      setError('Reason and details are required for moderation reports.')
      return
    }

    try {
      setCreatingReport(true)
      setError('')

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportForm),
      })

      const data = (await response.json()) as ModerationReport | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to create report.')
      }

      setReports((current) => [data, ...current])
      setReportForm(emptyReportForm())
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create report.')
    } finally {
      setCreatingReport(false)
    }
  }

  async function updateReportStatus(reportId: string, status: ModerationReportStatus) {
    try {
      setUpdatingReportId(reportId)
      setError('')

      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      const data = (await response.json()) as ModerationReport | { error?: string }
      if (!response.ok || !('id' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to update report.')
      }

      setReports((current) => current.map((item) => (item.id === data.id ? data : item)))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update report.')
    } finally {
      setUpdatingReportId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Operations Center</h1>
          <p className="mt-2 text-gray-600">
            Manage employer onboarding leads and trust-and-safety reports in one place.
          </p>
        </div>
        <div className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This MVP uses public contacts, email, scheduling links, and opt-in chat channels.
          It does not implement phone-to-social reverse lookup or unsolicited private messaging.
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">Employer leads</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.employers}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Invites sent</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{stats.invited}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Onboarded</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.onboarded}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Open reports</p>
          <p className="mt-1 text-2xl font-bold text-rose-700">{stats.openReports}</p>
        </div>
      </div>

      <div className="card">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">JD Publishing Desk</h2>
          <p className="mt-2 text-sm text-gray-600">
            Create, publish, pause, and maintain the real job descriptions that now feed candidate matching.
          </p>
        </div>
        <JobBoardManager />
      </div>

      {loading ? (
        <div className="card flex items-center justify-center py-16">
          <Loader2 className="mr-3 h-5 w-5 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">Loading operations data...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6">
            <div className="card space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Add employer lead</h2>
              </div>
              <input
                type="text"
                value={leadForm.companyName}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, companyName: event.target.value }))
                }
                className="input-field"
                placeholder="Company name"
              />
              <textarea
                rows={8}
                value={leadForm.publicText}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, publicText: event.target.value }))
                }
                className="input-field"
                placeholder="Paste public HR email, contact page text, or a recruiter signature."
              />
              <button
                onClick={createLead}
                className="btn-primary flex w-full items-center justify-center gap-2"
                disabled={creatingLead}
              >
                {creatingLead ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                <span>{creatingLead ? 'Creating...' : 'Create Employer Lead'}</span>
              </button>
            </div>

            <div className="card space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                <h2 className="text-lg font-semibold text-gray-900">Submit report</h2>
              </div>
              <select
                value={reportForm.subjectType}
                onChange={(event) =>
                  setReportForm((current) => ({
                    ...current,
                    subjectType: event.target.value as ModerationSubjectType,
                  }))
                }
                className="input-field"
              >
                {REPORT_SUBJECT_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={reportForm.subjectId}
                onChange={(event) =>
                  setReportForm((current) => ({ ...current, subjectId: event.target.value }))
                }
                className="input-field"
                placeholder="Subject id"
              />
              <input
                type="text"
                value={reportForm.reporterName}
                onChange={(event) =>
                  setReportForm((current) => ({ ...current, reporterName: event.target.value }))
                }
                className="input-field"
                placeholder="Reporter name"
              />
              <input
                type="email"
                value={reportForm.reporterEmail}
                onChange={(event) =>
                  setReportForm((current) => ({ ...current, reporterEmail: event.target.value }))
                }
                className="input-field"
                placeholder="Reporter email"
              />
              <input
                type="text"
                value={reportForm.reason}
                onChange={(event) =>
                  setReportForm((current) => ({ ...current, reason: event.target.value }))
                }
                className="input-field"
                placeholder="Reason"
              />
              <textarea
                rows={5}
                value={reportForm.details}
                onChange={(event) =>
                  setReportForm((current) => ({ ...current, details: event.target.value }))
                }
                className="input-field"
                placeholder="Details"
              />
              <button
                onClick={createReport}
                className="btn-secondary flex w-full items-center justify-center gap-2"
                disabled={creatingReport}
              >
                {creatingReport ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <span>{creatingReport ? 'Submitting...' : 'Submit Report'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-6 xl:col-span-2">
            <div className="card space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Employer queue</h2>
                  <p className="mt-1 text-sm text-gray-500">Leads from manual entry or public contact text.</p>
                </div>
                <button onClick={() => void loadData()} className="btn-secondary">
                  Refresh
                </button>
              </div>
              {leads.length === 0 && <p className="text-sm text-gray-500">No employer leads yet.</p>}
              {leads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    selectedLeadId === lead.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-gray-900">{lead.companyName}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {lead.workflow.stage}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {lead.contact.email || lead.contact.phone || 'No public contact yet'}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">{lead.summary}</p>
                </button>
              ))}
            </div>

            {leadDraft ? (
              <div className="card space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{leadDraft.companyName}</h2>
                    <p className="mt-1 text-sm text-gray-500">{leadDraft.summary}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveLead}
                      className="btn-secondary flex items-center gap-2"
                      disabled={savingLead}
                    >
                      {savingLead ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      <span>{savingLead ? 'Saving...' : 'Save Lead'}</span>
                    </button>
                    <button
                      onClick={sendInvite}
                      className="btn-primary flex items-center gap-2"
                      disabled={!leadDraft.contact.email || sendingInvite}
                    >
                      {sendingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      <span>{sendingInvite ? 'Sending...' : 'Send Invite'}</span>
                    </button>
                  </div>
                </div>

                {inviteFeedback && (
                  <div className="whitespace-pre-line rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    {inviteFeedback}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input
                    type="text"
                    value={leadDraft.companyName}
                    onChange={(event) =>
                      setLeadDraft((current) =>
                        current ? { ...current, companyName: event.target.value } : current
                      )
                    }
                    className="input-field"
                    placeholder="Company name"
                  />
                  <input
                    type="text"
                    value={leadDraft.website ?? ''}
                    onChange={(event) =>
                      setLeadDraft((current) =>
                        current ? { ...current, website: event.target.value || null } : current
                      )
                    }
                    className="input-field"
                    placeholder="Website"
                  />
                  <input
                    type="text"
                    value={leadDraft.contact.contactName ?? ''}
                    onChange={(event) => updateLeadContact('contactName', event.target.value)}
                    className="input-field"
                    placeholder="Contact name"
                  />
                  <input
                    type="email"
                    value={leadDraft.contact.email ?? ''}
                    onChange={(event) => updateLeadContact('email', event.target.value)}
                    className="input-field"
                    placeholder="Email"
                  />
                  <input
                    type="text"
                    value={leadDraft.contact.phone ?? ''}
                    onChange={(event) => updateLeadContact('phone', event.target.value)}
                    className="input-field"
                    placeholder="Phone"
                  />
                  <input
                    type="text"
                    value={leadDraft.contact.location ?? ''}
                    onChange={(event) => updateLeadContact('location', event.target.value)}
                    className="input-field"
                    placeholder="Location"
                  />
                </div>

                <select
                  value={leadDraft.workflow.stage}
                  onChange={(event) =>
                    setLeadDraft((current) =>
                      current
                        ? {
                            ...current,
                            workflow: {
                              ...current.workflow,
                              stage: event.target.value as OrganizationStage,
                            },
                          }
                        : current
                    )
                  }
                  className="input-field"
                >
                  {ORGANIZATION_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={leadDraft.workflow.recommendedNextAction}
                  onChange={(event) =>
                    setLeadDraft((current) =>
                      current
                        ? {
                            ...current,
                            workflow: {
                              ...current.workflow,
                              recommendedNextAction: event.target.value,
                            },
                          }
                        : current
                    )
                  }
                  className="input-field"
                  placeholder="Recommended next action"
                />

                <textarea
                  rows={4}
                  value={leadDraft.workflow.notes}
                  onChange={(event) =>
                    setLeadDraft((current) =>
                      current
                        ? {
                            ...current,
                            workflow: {
                              ...current.workflow,
                              notes: event.target.value,
                            },
                          }
                        : current
                    )
                  }
                  className="input-field"
                  placeholder="Lead notes"
                />

                <textarea
                  rows={6}
                  value={leadDraft.publicText}
                  onChange={(event) =>
                    setLeadDraft((current) =>
                      current ? { ...current, publicText: event.target.value } : current
                    )
                  }
                  className="input-field"
                  placeholder="Public source text"
                />
              </div>
            ) : (
              <div className="card text-sm text-gray-500">
                Select an employer lead to review parsed contact info and send an invite.
              </div>
            )}

            <div className="card space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Moderation queue</h2>
              {reports.length === 0 && <p className="text-sm text-gray-500">No reports submitted yet.</p>}
              {reports.map((report) => (
                <div key={report.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{report.reason}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {report.subjectType}
                        {report.subjectId ? ` - ${report.subjectId}` : ''}
                      </p>
                      <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{report.details}</p>
                    </div>
                    <div className="w-full md:w-48">
                      <select
                        value={report.status}
                        onChange={(event) =>
                          void updateReportStatus(report.id, event.target.value as ModerationReportStatus)
                        }
                        className="input-field"
                        disabled={updatingReportId === report.id}
                      >
                        {REPORT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    <p>
                      Reporter: {report.reporterName || 'Anonymous'}
                      {report.reporterEmail ? ` - ${report.reporterEmail}` : ''}
                    </p>
                    <p>Created: {new Date(report.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
