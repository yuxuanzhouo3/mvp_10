import type { AppUser } from '@/types/auth'
import type { AssessmentRecord } from '@/types/assessment'

export function canAccessAssessmentRecord(user: AppUser, record: AssessmentRecord) {
  if (user.role === 'admin') {
    return true
  }

  if (user.role === 'candidate') {
    return record.candidateUserId === user.id
  }

  return record.recruiterUserId === user.id
}
