import { NextResponse } from 'next/server'

import {
  buildRecommendedNextAction,
  createTimelineEvent,
  syncCandidateTasks,
} from '@/lib/server/resume-defaults'
import { normalizeResumeContactInfo } from '@/lib/resume-contact'
import { getResumeRecordById, updateResumeRecord } from '@/lib/server/resume-store'
import type {
  CandidateOutreachStatus,
  CandidateReviewStatus,
  CandidateStage,
  CandidateTask,
  CandidateTaskChannel,
  CandidateTaskKind,
  CandidateTaskStatus,
  ResumeContactInfo,
} from '@/types/resume'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STAGES: CandidateStage[] = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected']
const REVIEW_STATUSES: CandidateReviewStatus[] = ['pending', 'reviewed']
const OUTREACH_STATUSES: CandidateOutreachStatus[] = ['pending', 'ready', 'contacted', 'responded']
const TASK_STATUSES: CandidateTaskStatus[] = ['todo', 'in_progress', 'done', 'blocked']
const TASK_CHANNELS: CandidateTaskChannel[] = [
  'email',
  'phone',
  'wechat',
  'feishu',
  'linkedin',
  'assessment',
  'manual',
]
const TASK_KINDS: CandidateTaskKind[] = [
  'contact_verification',
  'first_outreach',
  'screening_decision',
  'interview',
  'offer',
  'custom',
]
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isStage(value: unknown): value is CandidateStage {
  return typeof value === 'string' && STAGES.includes(value as CandidateStage)
}

function isReviewStatus(value: unknown): value is CandidateReviewStatus {
  return typeof value === 'string' && REVIEW_STATUSES.includes(value as CandidateReviewStatus)
}

function isOutreachStatus(value: unknown): value is CandidateOutreachStatus {
  return typeof value === 'string' && OUTREACH_STATUSES.includes(value as CandidateOutreachStatus)
}

function isTaskStatus(value: unknown): value is CandidateTaskStatus {
  return typeof value === 'string' && TASK_STATUSES.includes(value as CandidateTaskStatus)
}

function isTaskChannel(value: unknown): value is CandidateTaskChannel {
  return typeof value === 'string' && TASK_CHANNELS.includes(value as CandidateTaskChannel)
}

function isTaskKind(value: unknown): value is CandidateTaskKind {
  return typeof value === 'string' && TASK_KINDS.includes(value as CandidateTaskKind)
}

function isContactPatch(value: unknown): value is Partial<Record<keyof ResumeContactInfo, unknown>> {
  return typeof value === 'object' && value !== null
}

function isTaskArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value)
}

function normalizeNullableString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeTaskArray(input: Array<Record<string, unknown>>, existingTasks: CandidateTask[], now: string) {
  const existingMap = new Map(existingTasks.map((task) => [task.id, task]))
  const nextTasks: CandidateTask[] = []

  for (const rawTask of input) {
    if (typeof rawTask !== 'object' || rawTask === null) {
      continue
    }

    const rawId = typeof rawTask.id === 'string' && rawTask.id.trim() ? rawTask.id.trim() : crypto.randomUUID()
    const existing = existingMap.get(rawId)
    const rawTitle =
      typeof rawTask.title === 'string' && rawTask.title.trim()
        ? rawTask.title.trim()
        : existing?.title ?? ''

    if (!rawTitle) {
      continue
    }

    const status = isTaskStatus(rawTask.status) ? rawTask.status : existing?.status ?? 'todo'
    const channel = isTaskChannel(rawTask.channel) ? rawTask.channel : existing?.channel ?? 'manual'
    const kind = isTaskKind(rawTask.kind) ? rawTask.kind : existing?.kind ?? 'custom'

    nextTasks.push({
      id: rawId,
      kind,
      title: rawTitle,
      description:
        typeof rawTask.description === 'string' && rawTask.description.trim()
          ? rawTask.description.trim()
          : null,
      status,
      channel,
      owner: normalizeNullableString(rawTask.owner),
      dueAt: normalizeNullableString(rawTask.dueAt),
      createdAt:
        typeof rawTask.createdAt === 'string' && rawTask.createdAt.trim()
          ? rawTask.createdAt
          : existing?.createdAt ?? now,
      updatedAt: now,
      completedAt:
        status === 'done'
          ? existing?.completedAt ?? now
          : null,
    })
  }

  return nextTasks
}

function appendTaskTimelineEvents(previousTasks: CandidateTask[], nextTasks: CandidateTask[], createdAt: string) {
  const events = []
  const previousMap = new Map(previousTasks.map((task) => [task.id, task]))
  const nextMap = new Map(nextTasks.map((task) => [task.id, task]))

  for (const task of nextTasks) {
    const previous = previousMap.get(task.id)

    if (!previous) {
      events.push(
        createTimelineEvent({
          type: 'task_created',
          actor: 'recruiter',
          title: `Task created: ${task.title}`,
          description: task.description ?? `Channel: ${task.channel}`,
          createdAt,
        })
      )
      continue
    }

    if (previous.status !== task.status) {
      events.push(
        createTimelineEvent({
          type: 'task_updated',
          actor: 'recruiter',
          title: task.status === 'done' ? `Task completed: ${task.title}` : `Task status updated: ${task.title}`,
          description: `${previous.status} -> ${task.status}`,
          createdAt,
        })
      )
      continue
    }

    if (
      previous.title !== task.title ||
      previous.owner !== task.owner ||
      previous.dueAt !== task.dueAt ||
      previous.channel !== task.channel ||
      previous.description !== task.description
    ) {
      events.push(
        createTimelineEvent({
          type: 'task_updated',
          actor: 'recruiter',
          title: `Task updated: ${task.title}`,
          description: 'Task details were changed.',
          createdAt,
        })
      )
    }
  }

  for (const previous of previousTasks) {
    if (!nextMap.has(previous.id)) {
      events.push(
        createTimelineEvent({
          type: 'task_updated',
          actor: 'recruiter',
          title: `Task removed: ${previous.title}`,
          description: 'The recruiter removed this task from the workflow board.',
          createdAt,
        })
      )
    }
  }

  return events
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const record = await getResumeRecordById(params.id)

  if (!record) {
    return NextResponse.json({ error: 'Resume record not found.' }, { status: 404 })
  }

  return NextResponse.json(record)
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await request.json()) as {
      stage?: unknown
      reviewStatus?: unknown
      outreachStatus?: unknown
      notes?: unknown
      recommendedNextAction?: unknown
      contact?: unknown
      tasks?: unknown
    }

    const updatedRecord = await updateResumeRecord(params.id, (record) => {
      const now = new Date().toISOString()
      const timelineEvents = [...record.timeline]
      const contactPatch = isContactPatch(body.contact) ? body.contact : null
      const tasksPatch = isTaskArray(body.tasks) ? body.tasks : null

      const nextContact: ResumeContactInfo = normalizeResumeContactInfo({
        name:
          contactPatch && 'name' in contactPatch
            ? normalizeNullableString(contactPatch.name)
            : record.contact.name,
        email:
          contactPatch && 'email' in contactPatch
            ? normalizeNullableString(contactPatch.email)
            : record.contact.email,
        phone:
          contactPatch && 'phone' in contactPatch
            ? normalizeNullableString(contactPatch.phone)
            : record.contact.phone,
        location:
          contactPatch && 'location' in contactPatch
            ? normalizeNullableString(contactPatch.location)
            : record.contact.location,
      })

      if (nextContact.email && !EMAIL_PATTERN.test(nextContact.email)) {
        throw new Error('Please enter a valid email address.')
      }

      const hasCompleteContact = Boolean(nextContact.email && nextContact.phone)
      const nextStage = isStage(body.stage) ? body.stage : record.workflow.stage
      const nextReviewStatus = isReviewStatus(body.reviewStatus)
        ? body.reviewStatus
        : record.workflow.reviewStatus
      const nextOutreachStatus = isOutreachStatus(body.outreachStatus)
        ? body.outreachStatus
        : hasCompleteContact
          ? record.workflow.outreachStatus === 'pending'
            ? 'ready'
            : record.workflow.outreachStatus
          : record.workflow.outreachStatus === 'contacted' || record.workflow.outreachStatus === 'responded'
            ? record.workflow.outreachStatus
            : 'pending'
      const nextNotes = typeof body.notes === 'string' ? body.notes : record.workflow.notes
      const nextAction =
        typeof body.recommendedNextAction === 'string'
          ? body.recommendedNextAction
          : buildRecommendedNextAction(nextContact)

      const workflowChanged =
        nextStage !== record.workflow.stage ||
        nextReviewStatus !== record.workflow.reviewStatus ||
        nextOutreachStatus !== record.workflow.outreachStatus ||
        nextAction !== record.workflow.recommendedNextAction

      const contactChanged =
        nextContact.name !== record.contact.name ||
        nextContact.email !== record.contact.email ||
        nextContact.phone !== record.contact.phone ||
        nextContact.location !== record.contact.location

      const notesChanged = nextNotes !== record.workflow.notes

      if (contactChanged) {
        timelineEvents.push(
          createTimelineEvent({
            type: 'contact_updated',
            actor: 'recruiter',
            title: 'Candidate contact details updated',
            description: 'Recruiter corrected or enriched parsed contact fields.',
            createdAt: now,
          })
        )
      }

      if (workflowChanged) {
        timelineEvents.push(
          createTimelineEvent({
            type: 'workflow_updated',
            actor: 'recruiter',
            title: `Workflow updated to ${nextStage}`,
            description: `Review: ${nextReviewStatus}, outreach: ${nextOutreachStatus}.`,
            createdAt: now,
          })
        )
      }

      if (notesChanged && nextNotes.trim() !== record.workflow.notes.trim()) {
        timelineEvents.push(
          createTimelineEvent({
            type: 'note_added',
            actor: 'recruiter',
            title: 'Recruiter notes updated',
            description: nextNotes.trim() ? nextNotes.trim().slice(0, 160) : 'Notes were cleared.',
            createdAt: now,
          })
        )
      }

      const baseRecord = {
        ...record,
        contact: nextContact,
        workflow: {
          ...record.workflow,
          stage: nextStage,
          reviewStatus: nextReviewStatus,
          outreachStatus: nextOutreachStatus,
          notes: nextNotes,
          recommendedNextAction: nextAction,
          lastUpdatedAt: now,
        },
      }

      const draftedTasks = tasksPatch ? normalizeTaskArray(tasksPatch, record.tasks, now) : record.tasks
      const nextTasks = syncCandidateTasks(baseRecord, draftedTasks)

      if (tasksPatch) {
        timelineEvents.push(...appendTaskTimelineEvents(record.tasks, nextTasks, now))
      }

      return {
        ...baseRecord,
        tasks: nextTasks,
        timeline: timelineEvents,
      }
    })

    if (!updatedRecord) {
      return NextResponse.json({ error: 'Resume record not found.' }, { status: 404 })
    }

    return NextResponse.json(updatedRecord)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resume update failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
