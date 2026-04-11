'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  CreditCard,
  Download,
  Edit,
  Loader2,
  Save,
  Shield,
  Trash2,
  User,
} from 'lucide-react'

import { getStoredAuthToken, useAuth } from './AuthProvider'
import { WechatPaymentDialog } from './WechatPaymentDialog'
import type { PaymentMethod, PaymentPlan } from '@/types/billing'

const SETTINGS_NAV_ITEMS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'billing', label: 'Billing', icon: CreditCard },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'privacy', label: 'Privacy', icon: Shield },
  { key: 'data', label: 'Data & Export', icon: Download },
] as const

export function Settings() {
  const { user, refreshUser } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [isEditing, setIsEditing] = useState(false)
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [billingActionKey, setBillingActionKey] = useState<string | null>(null)
  const [billingMessage, setBillingMessage] = useState('')
  const [activeWechatCheckout, setActiveWechatCheckout] = useState<{
    amount: number
    checkoutSessionId: string
    codeUrl: string
    expiresAt: string | null
    isMock: boolean
    planName: string
  } | null>(null)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    location: 'San Francisco, CA',
    experience: user?.preferences.experienceLevel || '5-10 years',
    industries: user?.preferences.industries || ['Technology', 'AI/ML'],
    notifications: {
      email: true,
      push: true,
      sms: false,
    },
  })

  useEffect(() => {
    setFormData((current) => ({
      ...current,
      name: user?.name || '',
      email: user?.email || '',
      experience: user?.preferences.experienceLevel || current.experience,
      industries: user?.preferences.industries || current.industries,
    }))
  }, [user])

  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        maximumFractionDigits: 0,
      }),
    []
  )

  useEffect(() => {
    void loadPlans()
  }, [])

  const currentPlanLabel = useMemo(() => {
    if (!user) {
      return 'Free'
    }

    if (user.plan === 'pro') {
      return 'Pro'
    }

    if (user.plan === 'enterprise') {
      return 'Enterprise'
    }

    return 'Free'
  }, [user])

  const roleLabel = useMemo(() => {
    if (!user) return 'Guest'
    if (user.role === 'recruiter') return 'Recruiter'
    if (user.role === 'admin') return 'Admin'
    return 'Candidate'
  }, [user])

  async function loadPlans() {
    try {
      const response = await fetch('/api/billing/plans', { cache: 'no-store' })
      const data = (await response.json()) as PaymentPlan[]

      if (response.ok) {
        setPlans(data)
      }
    } catch (error) {
      console.error('Failed to load billing plans:', error)
    }
  }

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleNotificationChange = (type: string, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [type]: value,
      },
    }))
  }

  const saveSettings = () => {
    setIsEditing(false)
    setBillingMessage('Profile editing is local-only in this MVP. Auth and billing are now backed by APIs.')
  }

  async function handleWechatPaid() {
    await refreshUser()
    setActiveWechatCheckout(null)
    setBillingMessage('微信支付成功，当前账号已升级为 Pro。')
  }

  async function startUpgrade(planId: PaymentPlan['id'], paymentMethod: PaymentMethod = 'default') {
    const token = getStoredAuthToken()
    const actionKey = `${planId}:${paymentMethod}`

    if (!token) {
      setBillingMessage('Please sign in again before starting checkout.')
      return
    }

    try {
      setBillingActionKey(actionKey)
      setBillingMessage('')

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId, paymentMethod }),
      })

      const checkout = (await response.json()) as {
        id?: string
        amount?: number
        mode?: 'external' | 'mock' | 'wechat_native'
        paymentMethod?: PaymentMethod
        externalUrl?: string | null
        codeUrl?: string | null
        expiresAt?: string | null
        isMock?: boolean
        status?: 'created' | 'paid' | 'failed'
        error?: string
      }

      if (!response.ok || !checkout.id || !checkout.mode) {
        throw new Error(checkout.error || 'Checkout creation failed.')
      }

      if (checkout.mode === 'wechat_native' && checkout.codeUrl) {
        const selectedPlan = plans.find((plan) => plan.id === planId)

        setActiveWechatCheckout({
          amount: checkout.amount ?? selectedPlan?.amount ?? 0,
          checkoutSessionId: checkout.id,
          codeUrl: checkout.codeUrl,
          expiresAt: checkout.expiresAt ?? null,
          isMock: Boolean(checkout.isMock),
          planName: selectedPlan?.name ?? 'Pro Membership',
        })
        setBillingMessage(
          checkout.isMock
            ? '微信支付弹层已打开，当前是本地模拟模式。'
            : '微信支付二维码已生成，请扫码完成支付。'
        )
        return
      }

      if (checkout.mode === 'external' && checkout.externalUrl) {
        window.open(checkout.externalUrl, '_blank', 'noopener,noreferrer')
        setBillingMessage('External checkout link opened. Complete payment there, then refresh your account.')
        return
      }

      const confirmResponse = await fetch('/api/billing/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ checkoutSessionId: checkout.id }),
      })

      const confirmData = (await confirmResponse.json()) as { error?: string }

      if (!confirmResponse.ok) {
        throw new Error(confirmData.error || 'Mock payment confirmation failed.')
      }

      await refreshUser()
      setBillingMessage('Mock payment completed. Your account has been upgraded to Pro.')
    } catch (error) {
      setBillingMessage(error instanceof Error ? error.message : 'Billing action failed.')
    } finally {
      setBillingActionKey(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">
            Manage your account, notifications, privacy, and billing
          </p>
        </div>
        {isEditing && (
          <div className="mt-4 md:mt-0 flex space-x-2">
            <button onClick={() => setIsEditing(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={saveSettings} className="btn-primary flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>Save Changes</span>
            </button>
          </div>
        )}
      </div>

      {billingMessage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {billingMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="card">
            <nav className="space-y-2">
              {SETTINGS_NAV_ITEMS.map((item) => {
                const Icon = item.icon

                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === item.key
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-4 w-4 inline mr-2" />
                    {item.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        <div className="lg:col-span-3">
          {activeTab === 'profile' && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Role: {roleLabel} - Current plan: {currentPlanLabel} - Billing: {user?.billingStatus || 'inactive'}
                  </p>
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Edit className="h-4 w-4" />
                  <span>{isEditing ? 'Cancel' : 'Edit'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={!isEditing}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled
                    className="input-field bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    disabled={!isEditing}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Experience Level</label>
                  <select
                    value={formData.experience}
                    onChange={(e) => handleInputChange('experience', e.target.value)}
                    disabled={!isEditing}
                    className="input-field"
                  >
                    <option value="0-2 years">0-2 years</option>
                    <option value="2-5 years">2-5 years</option>
                    <option value="5-10 years">5-10 years</option>
                    <option value="10+ years">10+ years</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900">Membership & Billing</h3>
                <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                  <p>Current plan: {currentPlanLabel}</p>
                  <p>Billing status: {user?.billingStatus || 'inactive'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <div key={plan.id} className="card">
                    {(() => {
                      const wechatActionKey = `${plan.id}:wechat`
                      const defaultActionKey = `${plan.id}:default`
                      const isWechatLoading = billingActionKey === wechatActionKey
                      const isDefaultLoading = billingActionKey === defaultActionKey
                      const isAnyBillingLoading = billingActionKey !== null

                      return (
                        <>
                          <h4 className="text-lg font-semibold text-gray-900">{plan.name}</h4>
                          <p className="mt-2 text-3xl font-bold text-primary-700">
                            {priceFormatter.format(plan.amount)}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">每 {plan.interval}</p>
                          <p className="text-sm text-gray-600 mt-4">{plan.description}</p>
                          <div className="mt-6 space-y-3">
                            <button
                              onClick={() => void startUpgrade(plan.id, 'wechat')}
                              disabled={isAnyBillingLoading}
                              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#07c160] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#06ad56] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {isWechatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                              <span>{isWechatLoading ? '处理中...' : '微信支付'}</span>
                            </button>
                            <button
                              onClick={() => void startUpgrade(plan.id, 'default')}
                              disabled={isAnyBillingLoading}
                              className="btn-secondary w-full flex items-center justify-center space-x-2"
                            >
                              {isDefaultLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                              <span>{isDefaultLoading ? '处理中...' : '原有流程'}</span>
                            </button>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Notification Preferences</h3>
              <div className="space-y-6">
                {[
                  ['Email Notifications', 'Receive job matches and updates via email', 'email'],
                  ['Push Notifications', 'Get instant alerts for new opportunities', 'push'],
                  ['SMS Notifications', 'Receive urgent updates via text message', 'sms'],
                ].map(([title, description, key]) => (
                  <div key={key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{title}</h4>
                      <p className="text-sm text-gray-600">{description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.notifications[key as keyof typeof formData.notifications])}
                        onChange={(e) => handleNotificationChange(key, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Privacy Settings</h3>
              <div className="space-y-4 text-sm text-gray-600">
                <p>Profile visibility, analytics opt-in, and third-party integrations are still local-only toggles in this MVP.</p>
                <p>For production rollout, these should be stored per user with consent timestamps and audit logs.</p>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Data & Export</h3>
              <div className="space-y-6">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Export Your Data</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Download all your data including profile, applications, and analytics
                  </p>
                  <button className="btn-secondary flex items-center space-x-2">
                    <Download className="h-4 w-4" />
                    <span>Export Data</span>
                  </button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Delete Account</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Permanently delete your account and all associated data
                  </p>
                  <button className="btn-secondary flex items-center space-x-2 text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Account</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeWechatCheckout && (
        <WechatPaymentDialog
          amount={activeWechatCheckout.amount}
          checkoutSessionId={activeWechatCheckout.checkoutSessionId}
          codeUrl={activeWechatCheckout.codeUrl}
          expiresAt={activeWechatCheckout.expiresAt}
          isMock={activeWechatCheckout.isMock}
          open={Boolean(activeWechatCheckout)}
          planName={activeWechatCheckout.planName}
          onClose={() => setActiveWechatCheckout(null)}
          onPaid={handleWechatPaid}
        />
      )}
    </div>
  )
}

