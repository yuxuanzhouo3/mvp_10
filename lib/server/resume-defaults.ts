import { normalizeResumeContactInfo } from '@/lib/resume-contact'
import type {
  CandidateTask,
  CandidateTaskChannel,
  CandidateTaskKind,
  CandidateTaskStatus,
  CandidateTimelineActor,
  CandidateTimelineEvent,
  CandidateTimelineEventType,
  ResumeCommunication,
  ResumeContactInfo,
  ResumeRecord,
  ResumeWorkflow,
} from '@/types/resume'

type ResumeTaskSeed = Pick<ResumeRecord, 'contact' | 'workflow' | 'communication' | 'createdAt'>

export function buildRecommendedNextAction(contact: ResumeContactInfo) {
  if (contact.email && contact.phone) {
    return 'Review profile and send first-contact email or interview scheduling link.'
  }

  if (!contact.email && contact.phone) {
    return 'Email is missing. Add a valid email before sending written follow-up or assessment links.'
  }

  if (contact.email && !contact.phone) {
    return 'Phone is missing. Start with email outreach and request a callback number if needed.'
  }

  return 'Manually verify missing contact details before outreach.'
}

export function buildDefaultWorkflow(record: Pick<ResumeRecord, 'contact' | 'score' | 'createdAt'>): ResumeWorkflow {
  const hasCompleteContact = Boolean(record.contact.email && record.contact.phone)
  const reviewStatus = record.score >= 70 ? 'reviewed' : 'pending'

  return {
    stage: 'new',
    reviewStatus,
    outreachStatus: hasCompleteContact ? 'ready' : 'pending',
    recommendedNextAction: buildRecommendedNextAction(record.contact),
    notes: '',
    lastUpdatedAt: record.createdAt,
  }
}

export function buildDefaultCommunication(): ResumeCommunication {
  return {
    receiptEmailStatus: 'not_sent',
    receiptEmailCount: 0,
    receiptEmailLastAttemptAt: null,
    receiptEmailSentAt: null,
    receiptEmailLastError: null,
    interviewInviteEmailStatus: 'not_sent',
    interviewInviteEmailCount: 0,
    interviewInviteEmailLastAttemptAt: null,
    interviewInviteEmailSentAt: null,
    interviewInviteEmailLastError: null,
  }
}

function buildSystemTaskTitle(kind: CandidateTaskKind, record: ResumeTaskSeed) {
  switch (kind) {
    case 'contact_verification':
      return 'Verify candidate contact details'
    case 'first_outreach':
      return record.contact.email
        ? 'Send receipt and invite candidate to the next step'
        : 'Collect a valid email before outreach'
    case 'screening_decision':
      return 'Complete recruiter screening decision'
    case 'interview':
      return 'Send interview invite and capture interview outcomes'
    case 'offer':
      return 'Prepare offer and close the candidate'
    case 'custom':
      return 'Custom follow-up task'
    default:
      return 'Candidate task'
  }
}

function buildSystemTaskDescription(kind: CandidateTaskKind, record: ResumeTaskSeed) {
  switch (kind) {
    case 'contact_verification':
      return 'Check whether email, phone, and location are complete enough for reliable follow-up.'
    case 'first_outreach':
      return record.contact.email
        ? 'Use email to confirm receipt and guide the candidate toward WeChat, Feishu, or interview scheduling.'
        : 'This candidate cannot receive email follow-up yet. Add a valid address first.'
    case 'screening_decision':
      return 'Review resume quality, recruiter notes, and decide whether to reject, interview, or move to assessment.'
    case 'interview':
      return 'Send an interview invite, coordinate scheduling, and capture outcomes in the timeline.'
    case 'offer':
      return 'Finalize compensation, offer decision, and close the loop with the candidate.'
    case 'custom':
      return 'Manual recruiter task.'
    default:
      return null
  }
}

function buildSystemTaskChannel(kind: CandidateTaskKind, record: ResumeTaskSeed): CandidateTaskChannel {
  switch (kind) {
    case 'first_outreach':
      return record.contact.email ? 'email' : 'manual'
    case 'interview':
      return record.contact.email ? 'email' : 'feishu'
    case 'offer':
      return 'manual'
    case 'screening_decision':
      return 'manual'
    case 'contact_verification':
      return 'manual'
    case 'custom':
      return 'manual'
    default:
      return 'manual'
  }
}

function buildSystemTaskStatus(kind: CandidateTaskKind, record: ResumeTaskSeed): CandidateTaskStatus {
  switch (kind) {
    case 'contact_verification':
      return record.contact.email && record.contact.phone ? 'done' : 'in_progress'
    case 'first_outreach':
      if (!record.contact.email && !record.contact.phone) {
        return 'blocked'
      }
      if (
        record.communication.receiptEmailStatus === 'sent' ||
        record.communication.interviewInviteEmailStatus === 'sent' ||
        record.workflow.outreachStatus === 'contacted' ||
        record.workflow.outreachStatus === 'responded'
      ) {
        return 'done'
      }
      return record.contact.email || record.contact.phone ? 'todo' : 'blocked'
    case 'screening_decision':
      if (record.workflow.stage === 'interview' || record.workflow.stage === 'offer' || record.workflow.stage === 'hired' || record.workflow.stage === 'rejected') {
        return 'done'
      }
      if (record.workflow.reviewStatus === 'reviewed' || record.workflow.stage === 'screening') {
        return 'in_progress'
      }
      return 'todo'
    case 'interview':
      if (record.workflow.stage === 'offer' || record.workflow.stage === 'hired') {
        return 'done'
      }
      return record.workflow.stage === 'interview' ? 'in_progress' : 'todo'
    case 'offer':
      if (record.workflow.stage === 'hired') {
        return 'done'
      }
      return record.workflow.stage === 'offer' ? 'in_progress' : 'todo'
    case 'custom':
      return 'todo'
    default:
      return 'todo'
  }
}

function normalizeTimelineEvent(
  event: Partial<CandidateTimelineEvent>,
  fallbackCreatedAt: string
): CandidateTimelineEvent {
  return {
    id: typeof event.id === 'string' && event.id.trim() ? event.id : crypto.randomUUID(),
    type: event.type ?? 'workflow_updated',
    actor: event.actor ?? 'system',
    title: typeof event.title === 'string' && event.title.trim() ? event.title.trim() : 'Timeline event',
    description:
      typeof event.description === 'string' && event.description.trim() ? event.description.trim() : null,
    createdAt:
      typeof event.createdAt === 'string' && event.createdAt.trim() ? event.createdAt : fallbackCreatedAt,
  }
}

function normalizeTask(task: Partial<CandidateTask>, fallbackCreatedAt: string): CandidateTask {
  const status = task.status ?? 'todo'

  return {
    id: typeof task.id === 'string' && task.id.trim() ? task.id : crypto.randomUUID(),
    kind: task.kind ?? 'custom',
    title: typeof task.title === 'string' && task.title.trim() ? task.title.trim() : 'Untitled task',
    description:
      typeof task.description === 'string' && task.description.trim() ? task.description.trim() : null,
    status,
    channel: task.channel ?? 'manual',
    owner: typeof task.owner === 'string' && task.owner.trim() ? task.owner.trim() : null,
    dueAt: typeof task.dueAt === 'string' && task.dueAt.trim() ? task.dueAt : null,
    createdAt:
      typeof task.createdAt === 'string' && task.createdAt.trim() ? task.createdAt : fallbackCreatedAt,
    updatedAt:
      typeof task.updatedAt === 'string' && task.updatedAt.trim() ? task.updatedAt : fallbackCreatedAt,
    completedAt:
      status === 'done'
        ? typeof task.completedAt === 'string' && task.completedAt.trim()
          ? task.completedAt
          : task.updatedAt ?? fallbackCreatedAt
        : null,
  }
}

export function createCandidateTask(
  kind: CandidateTaskKind,
  record: ResumeTaskSeed,
  overrides: Partial<CandidateTask> = {}
): CandidateTask {
  const createdAt = overrides.createdAt ?? record.createdAt
  const status = overrides.status ?? buildSystemTaskStatus(kind, record)

  return normalizeTask(
    {
      id: overrides.id,
      kind,
      title: overrides.title ?? buildSystemTaskTitle(kind, record),
      description: overrides.description ?? buildSystemTaskDescription(kind, record),
      status,
      channel: overrides.channel ?? buildSystemTaskChannel(kind, record),
      owner: overrides.owner,
      dueAt: overrides.dueAt,
      createdAt,
      updatedAt: overrides.updatedAt ?? createdAt,
      completedAt: overrides.completedAt ?? (status === 'done' ? createdAt : null),
    },
    createdAt
  )
}

export function createTimelineEvent(input: {
  type: CandidateTimelineEventType
  actor?: CandidateTimelineActor
  title: string
  description?: string | null
  createdAt?: string
}): CandidateTimelineEvent {
  const createdAt = input.createdAt ?? new Date().toISOString()

  return normalizeTimelineEvent(
    {
      type: input.type,
      actor: input.actor ?? 'system',
      title: input.title,
      description: input.description ?? null,
      createdAt,
    },
    createdAt
  )
}

export function buildDefaultTimeline(record: Pick<ResumeRecord, 'createdAt' | 'contact' | 'workflow'>) {
  return [
    createTimelineEvent({
      type: 'resume_uploaded',
      title: 'Resume uploaded and candidate created',
      description: `Candidate entered intake in stage ${record.workflow.stage}.`,
      createdAt: record.createdAt,
    }),
  ]
}

export function syncCandidateTasks(record: ResumeTaskSeed, existingTasks: CandidateTask[] = []) {
  const now = new Date().toISOString()
  const byKind = new Map<CandidateTaskKind, CandidateTask>()
  const customTasks: CandidateTask[] = []

  for (const task of existingTasks) {
    const normalized = normalizeTask(task, record.createdAt)

    if (normalized.kind === 'custom') {
      customTasks.push(normalized)
      continue
    }

    if (!byKind.has(normalized.kind)) {
      byKind.set(normalized.kind, normalized)
    }
  }

  const requiredKinds: CandidateTaskKind[] = ['contact_verification', 'first_outreach', 'screening_decision']

  if (record.workflow.stage === 'interview' || record.workflow.stage === 'offer' || record.workflow.stage === 'hired') {
    requiredKinds.push('interview')
  }

  if (record.workflow.stage === 'offer' || record.workflow.stage === 'hired') {
    requiredKinds.push('offer')
  }

  const systemTasks = requiredKinds.map((kind) => {
    const existing = byKind.get(kind)
    const nextStatus = buildSystemTaskStatus(kind, record)
    const task = createCandidateTask(kind, record, {
      ...existing,
      status: nextStatus,
      title: existing?.title ?? buildSystemTaskTitle(kind, record),
      description: existing?.description ?? buildSystemTaskDescription(kind, record),
      channel: existing?.channel ?? buildSystemTaskChannel(kind, record),
      owner: existing?.owner ?? null,
      dueAt: existing?.dueAt ?? null,
      createdAt: existing?.createdAt ?? record.createdAt,
      updatedAt:
        existing && existing.status === nextStatus
          ? existing.updatedAt
          : now,
      completedAt:
        nextStatus === 'done'
          ? existing?.completedAt ?? now
          : null,
    })

    return task
  })

  return [...systemTasks, ...customTasks].sort((left, right) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  })
}

export function buildDefaultTasks(record: ResumeTaskSeed) {
  return syncCandidateTasks(record, [])
}

export function normalizeResumeRecord(record: ResumeRecord): ResumeRecord {
  const normalizedContact = normalizeResumeContactInfo(record.contact)
  const workflowDefaults = buildDefaultWorkflow(record)
  const communicationDefaults = buildDefaultCommunication()

  const normalizedRecord: ResumeRecord = {
    ...record,
    contact: normalizedContact,
    workflow: {
      ...workflowDefaults,
      ...record.workflow,
      recommendedNextAction:
        record.workflow?.recommendedNextAction ?? buildRecommendedNextAction(normalizedContact),
      lastUpdatedAt: record.workflow?.lastUpdatedAt ?? record.createdAt,
    },
    communication: {
      ...communicationDefaults,
      ...record.communication,
    },
    tasks: [],
    timeline: [],
  }

  normalizedRecord.tasks = syncCandidateTasks(normalizedRecord, Array.isArray(record.tasks) ? record.tasks : [])
  normalizedRecord.timeline = (
    Array.isArray(record.timeline) && record.timeline.length > 0
      ? record.timeline
      : buildDefaultTimeline(normalizedRecord)
  ).map((event) => normalizeTimelineEvent(event, normalizedRecord.createdAt))

  return normalizedRecord
}
