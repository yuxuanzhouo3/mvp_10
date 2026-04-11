export type PaymentPlanId = 'pro_monthly' | 'pro_quarterly' | 'pro_yearly'
export type PaymentMethod = 'default' | 'wechat'
export type CheckoutMode = 'external' | 'mock' | 'wechat_native'
export type PaymentStatus = 'created' | 'paid' | 'failed'

export interface PaymentPlan {
  id: PaymentPlanId
  name: string
  amount: number
  currency: string
  interval: 'month' | 'quarter' | 'year'
  description: string
}

export interface CheckoutSession {
  id: string
  userId: string
  planId: PaymentPlanId
  amount: number
  currency: string
  mode: CheckoutMode
  paymentMethod: PaymentMethod
  status: PaymentStatus
  createdAt: string
  paidAt: string | null
  externalUrl: string | null
  codeUrl: string | null
  outTradeNo: string | null
  expiresAt: string | null
  transactionId: string | null
  isMock: boolean
}
