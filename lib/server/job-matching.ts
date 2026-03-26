import type { AppUser } from '@/types/auth'
import type { JobMatchBreakdown, JobRecommendation, JobRecommendationResponse, JobRecord, CandidateMatchingProfile } from '@/types/job'
import type { ResumeRecord } from '@/types/resume'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function postedDaysAgo(postedAt: string) {
  const delta = Date.now() - new Date(postedAt).getTime()
  return Math.max(0, Math.floor(delta / (1000 * 60 * 60 * 24)))
}

function inferExperienceYears(experienceLevel: string) {
  const matches = Array.from(experienceLevel.matchAll(/\d+/g)).map((match) => Number(match[0]))

  if (matches.length === 0) {
    return null
  }

  if (matches.length === 1) {
    return matches[0]
  }

  return Math.round((matches[0] + matches[matches.length - 1]) / 2)
}

export function findBestResumeForUser(user: AppUser, resumes: ResumeRecord[]) {
  const normalizedEmail = normalizeText(user.email)
  const normalizedName = normalizeText(user.name)

  const exactEmail = resumes.find((resume) => normalizeText(resume.contact.email) === normalizedEmail)
  if (exactEmail) {
    return exactEmail
  }

  const exactName = resumes.find((resume) => normalizeText(resume.contact.name) === normalizedName)
  if (exactName) {
    return exactName
  }

  return null
}

export function buildCandidateMatchingProfile(user: AppUser, resume: ResumeRecord | null): CandidateMatchingProfile {
  return {
    candidateName: resume?.contact.name ?? user.name ?? null,
    currentTitle: resume?.profile.currentTitle ?? null,
    location: resume?.contact.location ?? user.preferences.locations[0] ?? null,
    yearsExperience: resume?.profile.yearsExperience ?? inferExperienceYears(user.preferences.experienceLevel),
    skills: dedupe(resume?.profile.skills ?? []),
    industries: dedupe(user.preferences.industries),
    preferredLocations: dedupe(user.preferences.locations),
    experienceLevel: user.preferences.experienceLevel,
    resumeFound: Boolean(resume),
  }
}

function scoreSkills(profile: CandidateMatchingProfile, job: JobRecord) {
  const candidateSkills = profile.skills.map((skill) => normalizeText(skill))
  const required = job.requiredSkills.map((skill) => normalizeText(skill))
  const preferred = job.preferredSkills.map((skill) => normalizeText(skill))
  const matchedRequired = job.requiredSkills.filter((skill) => candidateSkills.includes(normalizeText(skill)))
  const matchedPreferred = job.preferredSkills.filter((skill) => candidateSkills.includes(normalizeText(skill)))
  const missingSkills = job.requiredSkills.filter((skill) => !candidateSkills.includes(normalizeText(skill)))
  const requiredScore = required.length === 0 ? 78 : (matchedRequired.length / required.length) * 100
  const preferredScore = preferred.length === 0 ? 70 : (matchedPreferred.length / preferred.length) * 100
  const fallbackBoost = profile.skills.length === 0 ? 8 : 0

  return {
    score: clamp(Math.round(requiredScore * 0.72 + preferredScore * 0.28 + fallbackBoost), 28, 100),
    matchedSkills: dedupe([...matchedRequired, ...matchedPreferred]).slice(0, 6),
    missingSkills: missingSkills.slice(0, 4),
  }
}

function scoreExperience(profile: CandidateMatchingProfile, job: JobRecord) {
  if (profile.yearsExperience === null) {
    return 62
  }

  const gap = profile.yearsExperience - job.minYearsExperience

  if (gap >= 2) {
    return 95
  }

  if (gap >= 0) {
    return 86
  }

  return clamp(72 + gap * 14, 35, 72)
}

function scoreLocation(profile: CandidateMatchingProfile, job: JobRecord) {
  const preferred = profile.preferredLocations.map((item) => normalizeText(item))
  const candidateLocation = normalizeText(profile.location)
  const jobLocation = normalizeText(job.location)

  if (job.locationMode === 'remote' && preferred.some((item) => item.includes('remote'))) {
    return 96
  }

  if (preferred.some((item) => item && jobLocation.includes(item))) {
    return 92
  }

  if (candidateLocation && jobLocation.includes(candidateLocation)) {
    return 88
  }

  if (job.locationMode === 'hybrid') {
    return 72
  }

  return job.locationMode === 'remote' ? 82 : 55
}

function expectedSeniority(profile: CandidateMatchingProfile) {
  const years = profile.yearsExperience

  if (years === null) {
    return 'entry'
  }

  if (years <= 1) return 'entry'
  if (years <= 3) return 'mid'
  if (years <= 6) return 'senior'
  return 'lead'
}

function scoreGrowth(profile: CandidateMatchingProfile, job: JobRecord) {
  const target = expectedSeniority(profile)
  const ladder = ['entry', 'mid', 'senior', 'lead']
  const delta = Math.abs(ladder.indexOf(target) - ladder.indexOf(job.seniority))

  return clamp(95 - delta * 18, 42, 95)
}

function scoreCompensation(profile: CandidateMatchingProfile, job: JobRecord) {
  const midpoint = (job.salaryMin + job.salaryMax) / 2
  const normalized = job.currency === 'CNY' ? midpoint / 6000 : midpoint / 100
  const years = profile.yearsExperience ?? inferExperienceYears(profile.experienceLevel) ?? 1
  const expectedBand = clamp(50 + years * 6, 55, 90)

  return clamp(Math.round(expectedBand * 0.45 + normalized * 0.55), 58, 96)
}

function buildReasons(profile: CandidateMatchingProfile, job: JobRecord, breakdown: JobMatchBreakdown, matchedSkills: string[], missingSkills: string[]) {
  const reasons: string[] = []

  if (matchedSkills.length > 0) {
    reasons.push(`Matched skills: ${matchedSkills.slice(0, 3).join(', ')}`)
  }

  if (breakdown.location >= 88) {
    reasons.push(`Location fit is strong for ${job.locationMode} work in ${job.location}`)
  }

  if (breakdown.experience >= 85) {
    reasons.push(`Experience level is aligned with the ${job.seniority} hiring bar`)
  }

  if (profile.industries.some((industry) => job.industries.some((item) => normalizeText(item).includes(normalizeText(industry))))) {
    reasons.push(`Industry preference overlaps with ${job.industries.join(', ')}`)
  }

  if (missingSkills.length > 0) {
    reasons.push(`Top skill gap to close: ${missingSkills[0]}`)
  }

  return reasons.slice(0, 4)
}

function buildPersonalizedAdvice(matchScore: number, missingSkills: string[], job: JobRecord) {
  if (matchScore >= 88) {
    return `High-priority role. Tailor your resume toward ${job.requiredSkills.slice(0, 2).join(' and ')} before applying.`
  }

  if (missingSkills.length > 0) {
    return `Promising match. Strengthen or explicitly mention ${missingSkills.slice(0, 2).join(' and ')} to improve your odds.`
  }

  return 'Keep this role in your shortlist and compare it against other nearby matches.'
}

function buildRecommendation(profile: CandidateMatchingProfile, job: JobRecord): JobRecommendation {
  const skillResult = scoreSkills(profile, job)
  const breakdown: JobMatchBreakdown = {
    skills: skillResult.score,
    experience: scoreExperience(profile, job),
    location: scoreLocation(profile, job),
    growth: scoreGrowth(profile, job),
    compensation: scoreCompensation(profile, job),
  }

  const matchScore = Math.round(
    breakdown.skills * 0.42 +
      breakdown.experience * 0.2 +
      breakdown.location * 0.14 +
      breakdown.growth * 0.14 +
      breakdown.compensation * 0.1
  )

  return {
    job,
    matchScore: clamp(matchScore, 0, 100),
    matchedSkills: skillResult.matchedSkills,
    missingSkills: skillResult.missingSkills,
    reasons: buildReasons(profile, job, breakdown, skillResult.matchedSkills, skillResult.missingSkills),
    personalizedAdvice: buildPersonalizedAdvice(matchScore, skillResult.missingSkills, job),
    breakdown,
  }
}

export function buildJobRecommendationResponse(user: AppUser, resume: ResumeRecord | null, jobs: JobRecord[]): JobRecommendationResponse {
  const profile = buildCandidateMatchingProfile(user, resume)
  const recommendations = jobs
    .map((job) => buildRecommendation(profile, job))
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) {
        return right.matchScore - left.matchScore
      }

      return postedDaysAgo(left.job.postedAt) - postedDaysAgo(right.job.postedAt)
    })

  const topSkillGap = recommendations
    .flatMap((item) => item.missingSkills)
    .find((skill) => !profile.skills.some((candidateSkill) => normalizeText(candidateSkill) === normalizeText(skill))) ?? null

  const averageMatch =
    recommendations.length === 0
      ? 0
      : Math.round(recommendations.reduce((sum, item) => sum + item.matchScore, 0) / recommendations.length)

  const bestFocus =
    recommendations[0]?.matchScore >= 88
      ? `Prioritize ${recommendations[0].job.title} at ${recommendations[0].job.company}.`
      : topSkillGap
        ? `Improve ${topSkillGap} coverage to unlock stronger matches.`
        : 'Keep comparing roles and update your profile signals.'

  return {
    profile,
    recommendations,
    summary: {
      totalRoles: recommendations.length,
      averageMatch,
      topSkillGap,
      bestFocus,
    },
  }
}
