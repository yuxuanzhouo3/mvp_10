'use client'

import { useState } from 'react'
import { Building2, Eye, EyeOff, Lock, Mail, User, Users } from 'lucide-react'

import { useAuth } from './AuthProvider'
import type { UserRole } from '@/types/auth'

type AuthMode = 'login' | 'register' | 'forgot'
type RegisterRole = Extract<UserRole, 'candidate' | 'recruiter'>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COMPANY_NAME = 'mornscience'

const ROLE_OPTIONS: Array<{
  value: RegisterRole
  title: string
  icon: typeof User
}> = [
  {
    value: 'candidate',
    title: '我要找工作',
    icon: User,
  },
  {
    value: 'recruiter',
    title: '我要招聘',
    icon: Users,
  },
]

function getModeDescription(mode: AuthMode) {
  if (mode === 'login') {
    return `使用邮箱账号登录 ${COMPANY_NAME} 平台`
  }

  if (mode === 'register') {
    return `首次验证通过即可注册 ${COMPANY_NAME} 账号`
  }

  return '通过邮箱验证码设置新的登录密码'
}

function getSubmitLabel(mode: AuthMode) {
  if (mode === 'login') {
    return '立即登录'
  }

  if (mode === 'register') {
    return '立即注册'
  }

  return '确认重置'
}

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [role, setRole] = useState<RegisterRole>('candidate')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const { login, register, sendRegistrationCode, forgotPassword, resetPassword } = useAuth()

  const isLogin = mode === 'login'
  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'
  const canSendCode = EMAIL_PATTERN.test(email.trim())
  const isBusy = submitting || sendingCode

  const resetFeedback = () => {
    setError('')
    setMessage('')
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    resetFeedback()
    setCode('')
    setPassword('')
    setNewPassword('')

    if (nextMode !== 'register') {
      setName('')
      setRole('candidate')
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    resetFeedback()

    try {
      if (isLogin) {
        await login(email.trim(), password)
        return
      }

      if (isRegister) {
        await register({
          email: email.trim(),
          password,
          name: name.trim(),
          code: code.trim(),
          role,
        })
        return
      }

      const resultMessage = await resetPassword({
        email: email.trim(),
        code: code.trim(),
        newPassword,
      })

      setMessage(resultMessage)
      setPassword('')
      setCode('')
      setNewPassword('')
      setMode('login')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '操作失败，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendCode = async () => {
    if (!canSendCode) {
      setError('请先输入有效的邮箱账号。')
      return
    }

    setSendingCode(true)
    resetFeedback()

    try {
      const resultMessage = isRegister
        ? await sendRegistrationCode(email.trim())
        : await forgotPassword(email.trim())
      setMessage(resultMessage)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '发送验证码失败。')
    } finally {
      setSendingCode(false)
    }
  }

  const inputClass =
    'h-12 w-full rounded-[14px] border border-[#e6dfd3] bg-[#fcfbf7] px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-[#b1a999] focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5'

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f0df] px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-44 -top-44 h-[420px] w-[420px] rounded-full border border-black/45" />
      <div className="pointer-events-none absolute -right-24 -top-32 h-[260px] w-[260px] rounded-full border border-black/18" />
      <div className="pointer-events-none absolute -right-10 -top-[72px] h-[260px] w-[260px] rounded-full border border-black/18" />
      <div className="pointer-events-none absolute right-4 -top-4 h-[260px] w-[260px] rounded-full border border-black/18" />
      <div className="pointer-events-none absolute right-[72px] top-[52px] h-[260px] w-[260px] rounded-full border border-black/18" />
      <div className="pointer-events-none absolute -bottom-36 -left-24 h-[340px] w-[340px] rounded-full border border-black/18" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-[340px] w-[340px] rounded-full border border-black/18" />
      <div className="pointer-events-none absolute -bottom-12 left-[52px] h-[340px] w-[340px] rounded-full border border-black/18" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[320px] w-[320px] rounded-full border border-black/40" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1120px] items-center justify-center">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_392px] lg:gap-16">
          <section className="mx-auto max-w-[420px] text-center lg:ml-10 lg:text-left">
            <div className="space-y-4">
              <h1 className="text-[52px] font-black leading-[0.95] tracking-[-0.08em] text-black sm:text-[68px] lg:text-[74px]">
                ai招聘平台
              </h1>
              <p className="text-[28px] font-medium tracking-tight text-black/80 sm:text-[32px]">
                {COMPANY_NAME}
              </p>
            </div>

            <div className="mt-10 inline-flex items-center gap-3 rounded-[22px] bg-white/75 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.08)] backdrop-blur-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#1f82f1] text-white shadow-[0_12px_24px_rgba(31,130,241,0.30)]">
                <Building2 className="h-6 w-6" />
              </div>
              <span className="text-[22px] font-semibold tracking-tight text-black">{COMPANY_NAME}</span>
            </div>

            <p className="mt-6 text-sm leading-7 text-black/55">
              首次登录需先通过 {COMPANY_NAME} 注册并完成邮箱验证
            </p>
          </section>

          <section className="mx-auto w-full max-w-[392px] rounded-[26px] border border-white/80 bg-white/88 p-6 shadow-[0_28px_70px_rgba(0,0,0,0.10)] backdrop-blur-xl sm:p-8">
            {!isForgot ? (
              <div className="flex rounded-full bg-[#f3efe7] p-1">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`h-11 flex-1 rounded-full text-[15px] font-medium transition ${
                    isLogin ? 'bg-black text-white shadow-sm' : 'text-black/65'
                  }`}
                >
                  登录
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`h-11 flex-1 rounded-full text-[15px] font-medium transition ${
                    isRegister ? 'bg-black text-white shadow-sm' : 'text-black/65'
                  }`}
                >
                  注册
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="inline-flex h-10 items-center rounded-full border border-[#e6dfd3] px-4 text-sm font-medium text-black/65 transition hover:border-black/25 hover:text-black"
              >
                返回登录
              </button>
            )}

            <div className="mt-5 text-center">
              <p className="text-[11px] uppercase tracking-[0.3em] text-black/30">MORNSCIENCE AI HIRING</p>
              <p className="mt-3 text-sm leading-6 text-black/50">{getModeDescription(mode)}</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {isRegister && (
                <div className="flex rounded-[16px] bg-[#f3efe7] p-1">
                  {ROLE_OPTIONS.map((option) => {
                    const selected = role === option.value
                    const Icon = option.icon

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRole(option.value)}
                        className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] text-[14px] font-medium transition ${
                          selected ? 'bg-white text-black shadow-sm' : 'text-black/60'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{option.title}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {isRegister && (
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#a79f91]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={`${inputClass} pl-11`}
                    placeholder={role === 'recruiter' ? '招聘负责人姓名' : '请输入姓名'}
                    required
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#a79f91]" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`${inputClass} pl-11`}
                  placeholder="邮箱账号"
                  required
                />
              </div>

              {(isRegister || isForgot) && (
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    className={inputClass}
                    placeholder="邮箱验证码"
                    maxLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendCode()}
                    disabled={isBusy || !canSendCode}
                    className="min-w-[118px] rounded-[14px] border border-[#e6dfd3] bg-white px-3 text-[14px] font-medium text-black transition hover:bg-[#f8f5ef] disabled:cursor-not-allowed disabled:text-black/30"
                  >
                    {sendingCode ? '发送中...' : '发送验证码'}
                  </button>
                </div>
              )}

              {(isLogin || isRegister) && (
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#a79f91]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`${inputClass} pl-11 pr-11`}
                    placeholder={isRegister ? '请设置登录密码' : '密码'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9e978a] transition hover:text-black/70"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              )}

              {isForgot && (
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#a79f91]" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className={`${inputClass} pl-11 pr-11`}
                    placeholder="新的登录密码"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9e978a] transition hover:text-black/70"
                  >
                    {showNewPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              )}

              {message && (
                <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {message}
                </div>
              )}

              {error && (
                <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy}
                className="flex h-12 w-full items-center justify-center rounded-[14px] bg-black text-[18px] font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                ) : (
                  <span>{getSubmitLabel(mode)}</span>
                )}
              </button>
            </form>

            <div className="mt-5 text-center text-sm text-black/55">
              {isLogin && (
                <>
                  <p>
                    首次登录请先通过 {COMPANY_NAME} 注册账号
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="ml-1 font-medium text-black underline underline-offset-4"
                    >
                      立即注册
                    </button>
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="mt-2 font-medium text-black/70 transition hover:text-black"
                  >
                    忘记密码？
                  </button>
                </>
              )}

              {isRegister && (
                <p>
                  已有账号？
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="ml-1 font-medium text-black underline underline-offset-4"
                  >
                    返回登录
                  </button>
                </p>
              )}

              {isForgot && (
                <p>
                  想起密码了？
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="ml-1 font-medium text-black underline underline-offset-4"
                  >
                    立即登录
                  </button>
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 text-[12px] text-black/45">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border border-black/25" />
                <span>{isLogin ? `${COMPANY_NAME}统一账号登录` : `${COMPANY_NAME}统一账号入口`}</span>
              </div>

              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-8 w-8 rounded-full border border-[#d8d2c5] bg-[#f8f8f4]" />
                <span className="h-8 w-8 rounded-full border border-[#d8d2c5] bg-[#f8f8f4]" />
                <span className="h-8 w-8 rounded-full border border-[#d8d2c5] bg-[#f8f8f4]" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
