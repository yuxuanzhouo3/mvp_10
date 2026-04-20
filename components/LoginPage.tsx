'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Moon,
  Sun,
  User,
  Users,
} from 'lucide-react'

import { useAuth } from './AuthProvider'
import {
  clearWxMpLoginParams,
  exchangeWechatMiniCode,
  isMiniProgram,
  parseWxMpLoginCallback,
  requestWxMpLogin,
  waitForWxSDK,
} from '@/lib/wechat-mp'
import { type Language } from '@/lib/i18n'
import type { UserRole } from '@/types/auth'
import { useLanguage } from './LanguageProvider'

type AuthMode = 'login' | 'register' | 'forgot'
type RegisterRole = Extract<UserRole, 'candidate' | 'recruiter'>
type VisualTheme = 'color' | 'mono'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COMPANY_NAME = 'mornjob'
const THEME_STORAGE_KEY = 'login_page_theme'

const ZH = {
  badge: 'CN / Global 双版本架构',
  backToLogin: '返回登录',
  brandKicker: 'AI RECRUITING PLATFORM',
  candidate: '找工作',
  createAccount: '创建账号',
  email: '邮箱地址',
  featureA: '统一候选人和职位流转',
  featureB: '邮箱验证码注册与找回密码',
  featureC: '微信小程序一键登录',
  forgotDescription: '通过邮箱验证码重置密码，然后使用新密码登录。',
  forgotPassword: '忘记密码？',
  forgotTitle: '找回密码',
  hasAccount: '已有账号？',
  heroDescription:
    'mornjob 是一个 AI 招聘平台，把职位发布、候选人管理、AI 解析和协作流程放进同一套系统，同时支持国内版和国际版。',
  heroPrimary: '开始体验',
  heroSecondary: '注册新账号',
  heroTitleAccent: 'AI 更轻松',
  heroTitleLead: '找工作，招聘，',
  languageButton: 'EN',
  login: '登录',
  loginDescription: '使用邮箱账号登录 mornjob。',
  loginSubmit: '立即登录',
  loginTitle: '欢迎回来',
  miniProgramButton: '微信一键登录',
  miniProgramHint: '在微信小程序内打开时，可以直接拉起微信登录。',
  miniProgramNotAvailable: '请在微信小程序内使用微信登录。',
  miniProgramRedirecting: '正在跳转到微信授权页面...',
  name: '你的姓名',
  newPassword: '新的登录密码',
  noAccount: '还没有账号？',
  operationFailed: '操作失败，请稍后重试。',
  orUseEmail: '或使用邮箱继续',
  password: '密码',
  passwordSet: '设置登录密码',
  recruiter: '招聘',
  recruiterName: '招聘负责人姓名',
  register: '注册',
  registerDescription: '通过邮箱验证码完成注册，立刻进入 mornjob 工作台。',
  registerSubmit: '完成注册',
  registerTitle: '创建账号',
  resetSubmit: '确认重置',
  sendCode: '发送验证码',
  sendCodeFailed: '验证码发送失败，请稍后再试。',
  sending: '发送中...',
  switchColor: '黑白界面',
  switchMono: '彩色界面',
  validEmail: '请先输入有效的邮箱地址。',
  verificationCode: '邮箱验证码',
  wechatCallbackInvalid: '微信登录回调不完整，请重新发起登录。',
  wechatLoginFailed: '微信登录失败，请稍后重试。',
  wechatLoginSuccess: '微信登录成功，正在进入工作台...',
  workspace: 'AI 招聘平台',
} as const

const EN = {
  badge: 'One codebase for CN and Global',
  backToLogin: 'Back to login',
  brandKicker: 'AI RECRUITING PLATFORM',
  candidate: 'Find Jobs',
  createAccount: 'Create account',
  email: 'Email address',
  featureA: 'Shared pipeline for jobs and candidates',
  featureB: 'Email-code sign-up and password reset',
  featureC: 'WeChat Mini Program one-tap sign-in',
  forgotDescription: 'Reset your password with an email code, then sign in again.',
  forgotPassword: 'Forgot password?',
  forgotTitle: 'Reset password',
  hasAccount: 'Already have an account?',
  heroDescription:
    'mornjob is an AI recruiting platform that brings jobs, candidate management, AI analysis, and collaboration into one system for both the CN and Global editions.',
  heroPrimary: 'Start now',
  heroSecondary: 'Create account',
  heroTitleAccent: 'Work Lighter with AI',
  heroTitleLead: 'Find Jobs, Recruit,',
  languageButton: 'ZH',
  login: 'Log in',
  loginDescription: 'Use your email account to sign in to mornjob.',
  loginSubmit: 'Log in now',
  loginTitle: 'Welcome back',
  miniProgramButton: 'Continue with WeChat',
  miniProgramHint: 'When opened inside a WeChat Mini Program, one-tap sign-in is ready.',
  miniProgramNotAvailable: 'WeChat sign-in is only available inside the Mini Program.',
  miniProgramRedirecting: 'Redirecting to WeChat sign-in...',
  name: 'Your name',
  newPassword: 'New password',
  noAccount: "Don't have an account?",
  operationFailed: 'Something went wrong. Please try again shortly.',
  orUseEmail: 'or continue with email',
  password: 'Password',
  passwordSet: 'Create a password',
  recruiter: 'Recruit',
  recruiterName: 'Hiring manager name',
  register: 'Sign up',
  registerDescription: 'Complete sign-up with an email code and enter your mornjob workspace.',
  registerSubmit: 'Create account',
  registerTitle: 'Create account',
  resetSubmit: 'Reset password',
  sendCode: 'Send code',
  sendCodeFailed: 'Failed to send the verification code. Please try again shortly.',
  sending: 'Sending...',
  switchColor: 'Mono UI',
  switchMono: 'Color UI',
  validEmail: 'Please enter a valid email address first.',
  verificationCode: 'Email code',
  wechatCallbackInvalid: 'The WeChat callback is incomplete. Please try again.',
  wechatLoginFailed: 'WeChat login failed. Please try again shortly.',
  wechatLoginSuccess: 'WeChat login succeeded. Opening your workspace...',
  workspace: 'AI Recruiting Platform',
} as const

function loadStoredValue<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  if (typeof window === 'undefined') {
    return fallback
  }

  const value = window.localStorage.getItem(key)
  return value && allowed.includes(value as T) ? (value as T) : fallback
}

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [visualTheme, setVisualTheme] = useState<VisualTheme>('color')
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
  const [wechatLoading, setWechatLoading] = useState(false)
  const [wechatAvailable, setWechatAvailable] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handledWechatCallbackRef = useRef(false)
  const { language, toggleLanguage } = useLanguage()
  const copy = language === 'zh' ? ZH : EN
  const isMono = visualTheme === 'mono'
  const isLogin = mode === 'login'
  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'
  const canSendCode = EMAIL_PATTERN.test(email.trim())
  const isBusy = submitting || sendingCode || wechatLoading

  const { login, register, sendRegistrationCode, forgotPassword, resetPassword, refreshUser } =
    useAuth()

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

  const getModeTitle = () => {
    if (mode === 'login') {
      return copy.loginTitle
    }

    if (mode === 'register') {
      return copy.registerTitle
    }

    return copy.forgotTitle
  }

  const getModeDescription = () => {
    if (mode === 'login') {
      return copy.loginDescription
    }

    if (mode === 'register') {
      return copy.registerDescription
    }

    return copy.forgotDescription
  }

  const getSubmitLabel = () => {
    if (mode === 'login') {
      return copy.loginSubmit
    }

    if (mode === 'register') {
      return copy.registerSubmit
    }

    return copy.resetSubmit
  }

  useEffect(() => {
    setVisualTheme(loadStoredValue<VisualTheme>(THEME_STORAGE_KEY, 'color', ['color', 'mono']))
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, visualTheme)
    }
  }, [visualTheme])

  useEffect(() => {
    let cancelled = false

    if (isMiniProgram()) {
      setWechatAvailable(true)
    }

    void waitForWxSDK(1800).then((miniProgram) => {
      if (!cancelled && miniProgram) {
        setWechatAvailable(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (handledWechatCallbackRef.current) {
      return
    }

    const callbackPayload = parseWxMpLoginCallback()

    if (!callbackPayload) {
      return
    }

    handledWechatCallbackRef.current = true
    setWechatLoading(true)
    resetFeedback()

    void (async () => {
      try {
        let token = callbackPayload.token?.trim() || ''
        let openid = callbackPayload.openid?.trim() || ''
        let expiresIn =
          callbackPayload.expiresIn && Number.isFinite(Number(callbackPayload.expiresIn))
            ? Number(callbackPayload.expiresIn)
            : undefined

        if ((!token || !openid) && callbackPayload.code) {
          const exchanged = await exchangeWechatMiniCode({
            code: callbackPayload.code,
            nickName: callbackPayload.nickName,
            avatarUrl: callbackPayload.avatarUrl,
          })

          token = exchanged.token || ''
          openid = exchanged.openid || ''
          expiresIn = exchanged.expiresIn
        }

        if (!token || !openid) {
          throw new Error(copy.wechatCallbackInvalid)
        }

        const response = await fetch('/api/auth/mp-callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            token,
            openid,
            expiresIn,
            nickName: callbackPayload.nickName,
            avatarUrl: callbackPayload.avatarUrl,
          }),
        })

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string
          success?: boolean
        }

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || copy.wechatLoginFailed)
        }

        window.localStorage.setItem('auth_token', token)
        await refreshUser()
        setMessage(copy.wechatLoginSuccess)
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : copy.wechatLoginFailed)
      } finally {
        clearWxMpLoginParams()
        setWechatLoading(false)
      }
    })()
  }, [copy.wechatCallbackInvalid, copy.wechatLoginFailed, copy.wechatLoginSuccess, refreshUser])

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
      setError(submitError instanceof Error ? submitError.message : copy.operationFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendCode = async () => {
    if (!canSendCode) {
      setError(copy.validEmail)
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
      setError(submitError instanceof Error ? submitError.message : copy.sendCodeFailed)
    } finally {
      setSendingCode(false)
    }
  }

  const handleWechatLogin = async () => {
    setWechatLoading(true)
    resetFeedback()

    try {
      const opened = await requestWxMpLogin(
        typeof window === 'undefined' ? undefined : window.location.href
      )

      if (!opened) {
        throw new Error(copy.miniProgramNotAvailable)
      }

      setMessage(copy.miniProgramRedirecting)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.wechatLoginFailed)
      setWechatLoading(false)
    }
  }

  const inputClass = `h-12 w-full rounded-2xl border px-4 text-[15px] outline-none transition ${
    isMono
      ? 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-black/10'
      : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#2f6bff] focus:ring-4 focus:ring-[#2f6bff]/10'
  }`

  const ghostButtonClass = `inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-medium transition ${
    isMono
      ? 'border-slate-300 bg-white text-slate-800 hover:border-slate-950 hover:text-slate-950'
      : 'border-slate-200 bg-white/95 text-slate-700 hover:border-[#c9d8ff] hover:text-[#3168ff]'
  }`

  return (
    <div className={`relative min-h-screen overflow-hidden ${isMono ? 'bg-[#f4f4f4]' : 'bg-[#f7fbff]'}`}>
      <div className={`absolute inset-0 ${isMono ? 'bg-[linear-gradient(180deg,#f1f1f1_0%,#ffffff_36%,#ffffff_100%)]' : 'bg-[linear-gradient(180deg,#f3f8ff_0%,#ffffff_32%,#ffffff_100%)]'}`} />
      <div className={`absolute -left-24 top-20 h-72 w-72 rounded-full blur-3xl ${isMono ? 'bg-slate-300/35' : 'bg-[#7db4ff]/28'}`} />
      <div className={`absolute right-[-80px] top-28 h-80 w-80 rounded-full blur-3xl ${isMono ? 'bg-slate-400/20' : 'bg-[#7c5cff]/16'}`} />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1280px] flex-col px-4 sm:px-6 lg:px-10">
        <header className="flex h-24 items-center justify-between">
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.34em] ${isMono ? 'text-slate-500' : 'text-slate-400'}`}>{copy.brandKicker}</p>
            <p className="mt-1 text-[34px] font-black tracking-[-0.08em]">{COMPANY_NAME}</p>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={toggleLanguage} className={ghostButtonClass}>
              <Globe2 className="h-4 w-4" />
              <span>{copy.languageButton}</span>
            </button>
            <button type="button" onClick={() => setVisualTheme((current) => (current === 'color' ? 'mono' : 'color'))} className={ghostButtonClass}>
              {isMono ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span>{isMono ? copy.switchMono : copy.switchColor}</span>
            </button>
          </div>
        </header>

        <main className="flex flex-1 items-center py-10 lg:py-16">
          <div className="grid w-full items-start gap-12 lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-14">
            <section className="max-w-[760px] pt-2">
              <div className={`inline-flex items-center rounded-full border px-5 py-2 text-sm font-medium shadow-[0_10px_24px_rgba(15,23,42,0.06)] ${isMono ? 'border-slate-300 bg-white text-slate-700' : 'border-[#c9d8ff] bg-[#edf4ff] text-[#3168ff]'}`}>
                {copy.badge}
              </div>

              <div className="mt-8 space-y-3">
                <h1 className="text-[54px] font-black leading-[0.94] tracking-[-0.07em] sm:text-[72px] lg:text-[94px]">{copy.heroTitleLead}</h1>
                <h2 className={`bg-clip-text text-[40px] font-black leading-[0.98] tracking-[-0.06em] text-transparent sm:text-[56px] lg:text-[74px] ${isMono ? 'bg-gradient-to-r from-slate-800 via-slate-500 to-slate-900' : 'bg-gradient-to-r from-[#2f6bff] via-[#5b64ff] to-[#7c5cff]'}`}>
                  {copy.heroTitleAccent}
                </h2>
              </div>

              <p className={`mt-8 max-w-[760px] text-[18px] leading-8 sm:text-[21px] ${isMono ? 'text-slate-600' : 'text-slate-500'}`}>
                {copy.heroDescription}
              </p>
            </section>

            <section id="auth-panel" className={`w-full rounded-[32px] border p-6 shadow-[0_28px_80px_rgba(15,23,42,0.10)] sm:p-8 ${isMono ? 'border-slate-300 bg-white' : 'border-slate-200 bg-white'}`}>
              {!isForgot ? (
                <div className={`flex rounded-full border p-1 ${isMono ? 'border-slate-300 bg-slate-100' : 'border-slate-200 bg-slate-50'}`}>
                  <button type="button" onClick={() => switchMode('login')} className={`h-11 flex-1 rounded-full text-[15px] font-medium transition ${isLogin ? (isMono ? 'bg-slate-950 text-white' : 'bg-gradient-to-r from-[#2f6bff] to-[#5b64ff] text-white') : 'text-slate-500'}`}>{copy.login}</button>
                  <button type="button" onClick={() => switchMode('register')} className={`h-11 flex-1 rounded-full text-[15px] font-medium transition ${isRegister ? (isMono ? 'bg-slate-950 text-white' : 'bg-gradient-to-r from-[#2f6bff] to-[#5b64ff] text-white') : 'text-slate-500'}`}>{copy.register}</button>
                </div>
              ) : (
                <button type="button" onClick={() => switchMode('login')} className={ghostButtonClass}>
                  {copy.backToLogin ?? 'Back'}
                </button>
              )}

              <div className="mt-6">
                <p className={`text-xs font-semibold uppercase tracking-[0.28em] ${isMono ? 'text-slate-500' : 'text-slate-400'}`}>{copy.workspace}</p>
                <h3 className="mt-3 text-[30px] font-bold tracking-[-0.04em]">{getModeTitle()}</h3>
                <p className={`mt-2 text-sm leading-6 ${isMono ? 'text-slate-600' : 'text-slate-500'}`}>{getModeDescription()}</p>
              </div>

              {wechatAvailable && !isForgot && (
                <>
                  <button type="button" onClick={() => void handleWechatLogin()} disabled={wechatLoading} className={`mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${isMono ? 'border-slate-300 bg-white text-slate-950 hover:border-slate-950' : 'border-[#cdddff] bg-[#eef4ff] text-[#3168ff] hover:bg-[#e7f0ff]'}`}>
                    {wechatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                    <span>{copy.miniProgramButton}</span>
                  </button>
                  <div className="mt-4 flex items-center gap-3">
                    <div className={`h-px flex-1 ${isMono ? 'bg-slate-200' : 'bg-slate-100'}`} />
                    <span className={`text-xs uppercase tracking-[0.24em] ${isMono ? 'text-slate-400' : 'text-slate-400'}`}>{copy.orUseEmail}</span>
                    <div className={`h-px flex-1 ${isMono ? 'bg-slate-200' : 'bg-slate-100'}`} />
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {isRegister && (
                  <div className={`flex rounded-2xl border p-1 ${isMono ? 'border-slate-300 bg-slate-100' : 'border-slate-200 bg-slate-50'}`}>
                    {[
                      { value: 'candidate' as const, title: copy.candidate, icon: User },
                      { value: 'recruiter' as const, title: copy.recruiter, icon: Users },
                    ].map((option) => {
                      const Icon = option.icon
                      return (
                        <button key={option.value} type="button" onClick={() => setRole(option.value)} className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] text-[14px] font-medium transition ${role === option.value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>
                          <Icon className="h-4 w-4" />
                          <span>{option.title}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {isRegister && (
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input type="text" value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} pl-11`} placeholder={role === 'recruiter' ? copy.recruiterName : copy.name} autoComplete="name" required />
                  </div>
                )}

                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={`${inputClass} pl-11`} placeholder={copy.email} autoComplete="email" required />
                </div>

                {(isRegister || isForgot) && (
                  <div className="flex gap-3">
                    <input type="text" value={code} onChange={(event) => setCode(event.target.value)} className={inputClass} placeholder={copy.verificationCode} inputMode="numeric" maxLength={6} required />
                    <button type="button" onClick={() => void handleSendCode()} disabled={isBusy || !canSendCode} className={`min-w-[132px] rounded-2xl border px-3 text-[14px] font-medium transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 ${isMono ? 'border-slate-300 bg-white text-slate-800 hover:border-slate-950 hover:text-slate-950' : 'border-[#cdddff] bg-[#eef4ff] text-[#3168ff] hover:bg-[#e6efff]'}`}>
                      {sendingCode ? copy.sending : copy.sendCode}
                    </button>
                  </div>
                )}

                {(isLogin || isRegister) && (
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} pl-11 pr-11`} placeholder={isRegister ? copy.passwordSet : copy.password} autoComplete={isRegister ? 'new-password' : 'current-password'} required />
                    <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700">
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                )}

                {isForgot && (
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={`${inputClass} pl-11 pr-11`} placeholder={copy.newPassword} autoComplete="new-password" required />
                    <button type="button" onClick={() => setShowNewPassword((current) => !current)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700">
                      {showNewPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                )}

                {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
                {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

                <button type="submit" disabled={isBusy} className={`flex h-12 w-full items-center justify-center rounded-2xl text-[17px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${isMono ? 'bg-slate-950 hover:bg-slate-800' : 'bg-gradient-to-r from-[#2f6bff] via-[#4b6dff] to-[#6c5cff] hover:opacity-95'}`}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>{getSubmitLabel()}</span>}
                </button>
              </form>

              <div className={`mt-6 text-center text-sm ${isMono ? 'text-slate-600' : 'text-slate-500'}`}>
                {isLogin && (
                  <>
                    <p>
                      {copy.noAccount}
                      <button type="button" onClick={() => switchMode('register')} className={`ml-1 font-medium underline underline-offset-4 ${isMono ? 'text-slate-950' : 'text-[#3168ff]'}`}>{copy.createAccount}</button>
                    </p>
                    <button type="button" onClick={() => switchMode('forgot')} className={`mt-2 font-medium transition ${isMono ? 'text-slate-700 hover:text-slate-950' : 'text-slate-600 hover:text-slate-900'}`}>{copy.forgotPassword}</button>
                  </>
                )}
                {isRegister && (
                  <p>
                    {copy.hasAccount}
                    <button type="button" onClick={() => switchMode('login')} className={`ml-1 font-medium underline underline-offset-4 ${isMono ? 'text-slate-950' : 'text-[#3168ff]'}`}>{copy.login}</button>
                  </p>
                )}
                {isForgot && (
                  <p>
                    {copy.hasAccount}
                    <button type="button" onClick={() => switchMode('login')} className={`ml-1 font-medium underline underline-offset-4 ${isMono ? 'text-slate-950' : 'text-[#3168ff]'}`}>{copy.login}</button>
                  </p>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
