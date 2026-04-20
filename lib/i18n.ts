import type { UserRole } from '@/types/auth'
import type {
  AssessmentDifficulty,
  AssessmentKind,
  AssessmentQuestionCategory,
  AssessmentRecommendation,
  AssessmentStatus,
} from '@/types/assessment'
import type { ApplicationStage } from '@/types/application'
import type { JobLocationMode, JobRecord, JobSeniority, JobStatus, JobType } from '@/types/job'

export type Language = 'zh' | 'en'

export const LANGUAGE_STORAGE_KEY = 'app_language'

export function pickLanguage<T>(language: Language, zh: T, en: T) {
  return language === 'en' ? en : zh
}

export function applicationStageLabel(stage: ApplicationStage, language: Language) {
  switch (stage) {
    case 'applied':
      return pickLanguage(language, '已投递', 'Applied')
    case 'screening':
      return pickLanguage(language, '初筛中', 'Screening')
    case 'interview':
      return pickLanguage(language, '面试中', 'Interviewing')
    case 'offer':
      return pickLanguage(language, 'Offer 阶段', 'Offer Stage')
    case 'hired':
      return pickLanguage(language, '已录用', 'Hired')
    case 'rejected':
      return pickLanguage(language, '未通过', 'Rejected')
    case 'withdrawn':
      return pickLanguage(language, '已撤回', 'Withdrawn')
    default:
      return stage
  }
}

export function assessmentStatusLabel(status: AssessmentStatus, language: Language) {
  switch (status) {
    case 'draft':
      return pickLanguage(language, '待作答', 'Draft')
    case 'in_progress':
      return pickLanguage(language, '作答中', 'In Progress')
    case 'submitted':
      return pickLanguage(language, '已提交，待评分', 'Submitted, Awaiting Score')
    case 'scored':
      return pickLanguage(language, '已评分', 'Scored')
    default:
      return status
  }
}

export function assessmentRecommendationLabel(
  value: AssessmentRecommendation | null | undefined,
  language: Language
) {
  switch (value) {
    case 'strong_yes':
      return pickLanguage(language, '强烈推荐', 'Strong Yes')
    case 'yes':
      return pickLanguage(language, '推荐', 'Yes')
    case 'hold':
      return pickLanguage(language, '待复核', 'Hold')
    case 'no':
      return pickLanguage(language, '不推荐', 'No')
    default:
      return pickLanguage(language, '待评估', 'Pending')
  }
}

export function recruiterRecommendationLabel(
  value: AssessmentRecommendation | null | undefined,
  language: Language
) {
  switch (value) {
    case 'strong_yes':
      return pickLanguage(language, '强烈推荐', 'Strong Yes')
    case 'yes':
      return pickLanguage(language, '推荐', 'Yes')
    case 'hold':
      return pickLanguage(language, '待复核', 'Hold')
    case 'no':
      return pickLanguage(language, '谨慎推进', 'Caution')
    default:
      return pickLanguage(language, '待评估', 'Pending')
  }
}

export function assessmentKindLabel(kind: AssessmentKind, language: Language) {
  return kind === 'practice'
    ? pickLanguage(language, '岗位自测', 'Practice Interview')
    : pickLanguage(language, '招聘方发题', 'Assigned by Recruiter')
}

export function assessmentCategoryLabel(
  value: AssessmentQuestionCategory,
  language: Language
) {
  switch (value) {
    case 'technical':
      return pickLanguage(language, '技术能力', 'Technical')
    case 'problem_solving':
      return pickLanguage(language, '问题解决', 'Problem Solving')
    case 'behavioral':
      return pickLanguage(language, '行为案例', 'Behavioral')
    case 'communication':
      return pickLanguage(language, '沟通表达', 'Communication')
    case 'role_fit':
    default:
      return pickLanguage(language, '岗位匹配', 'Role Fit')
  }
}

export function assessmentDifficultyLabel(value: AssessmentDifficulty, language: Language) {
  switch (value) {
    case 'easy':
      return pickLanguage(language, '简单', 'Easy')
    case 'medium':
      return pickLanguage(language, '中等', 'Medium')
    case 'hard':
      return pickLanguage(language, '困难', 'Hard')
    default:
      return value
  }
}

export function jobLocationModeLabel(mode: JobLocationMode, language: Language) {
  switch (mode) {
    case 'remote':
      return pickLanguage(language, '远程', 'Remote')
    case 'hybrid':
      return pickLanguage(language, '混合', 'Hybrid')
    case 'onsite':
    default:
      return pickLanguage(language, '现场', 'On-site')
  }
}

export function jobStatusLabel(status: JobStatus, language: Language) {
  switch (status) {
    case 'published':
      return pickLanguage(language, '已发布', 'Published')
    case 'closed':
      return pickLanguage(language, '已关闭', 'Closed')
    case 'draft':
    default:
      return pickLanguage(language, '草稿', 'Draft')
  }
}

export function jobTypeLabel(type: JobType, language: Language) {
  switch (type) {
    case 'Full-time':
      return pickLanguage(language, '全职', 'Full-time')
    case 'Part-time':
      return pickLanguage(language, '兼职', 'Part-time')
    case 'Contract':
      return pickLanguage(language, '合同制', 'Contract')
    case 'Internship':
      return pickLanguage(language, '实习', 'Internship')
    default:
      return type
  }
}

export function jobSeniorityLabel(level: JobSeniority, language: Language) {
  switch (level) {
    case 'entry':
      return pickLanguage(language, '初级', 'Entry')
    case 'mid':
      return pickLanguage(language, '中级', 'Mid')
    case 'senior':
      return pickLanguage(language, '高级', 'Senior')
    case 'lead':
      return pickLanguage(language, '负责人', 'Lead')
    default:
      return level
  }
}

export function roleLabel(role: UserRole | undefined | null, language: Language) {
  if (role === 'recruiter') {
    return pickLanguage(language, '招聘方', 'Recruiter')
  }

  if (role === 'admin') {
    return pickLanguage(language, '管理员', 'Admin')
  }

  return pickLanguage(language, '求职者', 'Candidate')
}

export function workspaceViewLabel(role: UserRole | undefined | null, language: Language) {
  if (role === 'recruiter' || role === 'admin') {
    return pickLanguage(language, '招聘方视角', 'Recruiter View')
  }

  return pickLanguage(language, '求职者视角', 'Candidate View')
}

export function relativeTimeLabel(value: string, language: Language) {
  const diff = Date.now() - new Date(value).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))

  if (hours < 1) return pickLanguage(language, '刚刚', 'Just now')
  if (hours < 24) {
    return pickLanguage(language, `${hours} 小时前`, `${hours}h ago`)
  }

  const days = Math.floor(hours / 24)
  if (days < 30) {
    return pickLanguage(language, `${days} 天前`, `${days}d ago`)
  }

  const months = Math.floor(days / 30)
  return pickLanguage(language, `${months} 个月前`, `${months}mo ago`)
}

export function postedLabel(postedAt: string, language: Language) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(postedAt).getTime()) / (1000 * 60 * 60 * 24))
  )
  return days === 0
    ? pickLanguage(language, '今天发布', 'Posted today')
    : pickLanguage(language, `${days} 天前发布`, `Posted ${days}d ago`)
}

export function formatCurrency(value: number, currency: JobRecord['currency'], language: Language) {
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCurrencyRange(job: JobRecord, language: Language) {
  return `${formatCurrency(job.salaryMin, job.currency, language)} - ${formatCurrency(
    job.salaryMax,
    job.currency,
    language
  )}`
}

export function formatDate(value: string, language: Language) {
  return new Date(value).toLocaleDateString(language === 'en' ? 'en-US' : 'zh-CN')
}
