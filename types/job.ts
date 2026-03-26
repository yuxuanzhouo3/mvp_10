export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship'
export type JobLocationMode = 'remote' | 'hybrid' | 'onsite'
export type JobSeniority = 'entry' | 'mid' | 'senior' | 'lead'
export type JobStatus = 'draft' | 'published' | 'closed'

export interface JobRecord {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  company: string
  companyTagline: string
  status: JobStatus
  contactEmail: string | null
  location: string
  locationMode: JobLocationMode
  salaryMin: number
  salaryMax: number
  currency: 'USD' | 'CNY'
  type: JobType
  postedAt: string
  industries: string[]
  requiredSkills: string[]
  preferredSkills: string[]
  minYearsExperience: number
  seniority: JobSeniority
  description: string
  highlights: string[]
}

export interface CandidateMatchingProfile {
  candidateName: string | null
  currentTitle: string | null
  location: string | null
  yearsExperience: number | null
  skills: string[]
  industries: string[]
  preferredLocations: string[]
  experienceLevel: string
  resumeFound: boolean
}

export interface JobMatchBreakdown {
  skills: number
  experience: number
  location: number
  growth: number
  compensation: number
}

export interface JobRecommendation {
  job: JobRecord
  matchScore: number
  matchedSkills: string[]
  missingSkills: string[]
  reasons: string[]
  personalizedAdvice: string
  breakdown: JobMatchBreakdown
}

export interface JobRecommendationResponse {
  profile: CandidateMatchingProfile
  recommendations: JobRecommendation[]
  summary: {
    totalRoles: number
    averageMatch: number
    topSkillGap: string | null
    bestFocus: string
  }
}
