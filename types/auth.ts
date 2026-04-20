export type UserRole = 'candidate' | 'recruiter' | 'admin' | 'market'
export type UserPlan = 'free' | 'pro' | 'enterprise'
export type BillingStatus = 'inactive' | 'trialing' | 'active' | 'past_due'

export interface UserPreferences {
  industries: string[]
  locations: string[]
  experienceLevel: string
}

export interface AppUser {
  id: string
  email: string
  name: string
  avatar?: string
  authProvider?: 'email' | 'wechat_mp'
  wechatOpenId?: string
  wechatUnionId?: string
  role: UserRole
  plan: UserPlan
  billingStatus: BillingStatus
  aiPaidEnabled?: boolean
  preferences: UserPreferences
  createdAt: string
}

export interface StoredUser extends AppUser {
  passwordHash: string
  passwordSalt: string
}

export interface AuthSession {
  token: string
  userId: string
  createdAt: string
  expiresAt: string
}

export interface OneTimeCodeRecord {
  id: string
  email: string
  verificationId: string
  createdAt: string
  expiresAt: string
  localCodeHash?: string
  localCodeSalt?: string
}

export interface PasswordResetCode extends OneTimeCodeRecord {}

export interface RegistrationVerificationCode extends OneTimeCodeRecord {}
