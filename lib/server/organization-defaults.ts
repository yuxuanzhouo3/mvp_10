import type {
  OrganizationCommunication,
  OrganizationContactInfo,
  OrganizationLead,
  OrganizationWorkflow,
} from '@/types/organization'

export function buildOrganizationNextAction(contact: OrganizationContactInfo) {
  if (contact.email) {
    return 'Send an onboarding invite email and include a booking link or opt-in chat channel.'
  }

  if (contact.phone) {
    return 'Email is missing. Use public phone only for compliant manual verification, then request an opt-in email.'
  }

  return 'Find a public business contact or add the lead manually before outreach.'
}

export function buildDefaultOrganizationWorkflow(
  record: Pick<OrganizationLead, 'contact' | 'createdAt'>
): OrganizationWorkflow {
  return {
    stage: 'new',
    recommendedNextAction: buildOrganizationNextAction(record.contact),
    notes: '',
    lastUpdatedAt: record.createdAt,
  }
}

export function buildDefaultOrganizationCommunication(): OrganizationCommunication {
  return {
    inviteEmailStatus: 'not_sent',
    inviteEmailCount: 0,
    inviteEmailLastAttemptAt: null,
    inviteEmailSentAt: null,
    inviteEmailLastError: null,
  }
}

export function normalizeOrganizationLead(record: OrganizationLead): OrganizationLead {
  const workflowDefaults = buildDefaultOrganizationWorkflow(record)
  const communicationDefaults = buildDefaultOrganizationCommunication()

  return {
    ...record,
    workflow: {
      ...workflowDefaults,
      ...record.workflow,
      recommendedNextAction:
        record.workflow?.recommendedNextAction ?? buildOrganizationNextAction(record.contact),
      lastUpdatedAt: record.workflow?.lastUpdatedAt ?? record.createdAt,
    },
    communication: {
      ...communicationDefaults,
      ...record.communication,
    },
  }
}
