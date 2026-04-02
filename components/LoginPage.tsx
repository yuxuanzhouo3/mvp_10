'use client'

import { useState } from 'react'
import { Briefcase, Eye, EyeOff, Lock, Mail, User, Users } from 'lucide-react'

import { useAuth } from './AuthProvider'
import type { UserRole } from '@/types/auth'

type AuthMode = 'login' | 'register' | 'forgot'
type RegisterRole = Extract<UserRole, 'candidate' | 'recruiter'>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ROLE_OPTIONS: Array<{
  value: RegisterRole
  title: string
  description: string
  icon: typeof User
}> = [
  {
    value: 'candidate',
    title: '我是求职者',
    description: '上传简历、获取岗位推荐、参加 AI 面试。',
    icon: User,
  },
  {
    value: 'recruiter',
    title: '我是招聘方',
    description: '发布岗位、筛选简历、自动生成面试题并打分。',
    icon: Users,
  },
]

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
      setError('请先输入有效的邮箱地址。')
      return
    }

    setSendingCode(true)
    resetFeedback()

    try {
      const resultMessage = isRegister ? await sendRegistrationCode(email.trim()) : await forgotPassword(email.trim())
      setMessage(resultMessage)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '发送验证码失败。')
    } finally {
      setSendingCode(false)
    }
  }

  return (
    <div className="gradient-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/60 bg-white/90 shadow-2xl shadow-slate-200 backdrop-blur">
        <div className="grid min-h-[720px] grid-cols-1 lg:grid-cols-[1.15fr_0.95fr]">
          <div className="relative overflow-hidden border-b border-slate-100 bg-slate-950 px-8 py-10 text-white lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.32),_transparent_35%),radial-gradient(circle_at_left,_rgba(16,185,129,0.18),_transparent_28%)]" />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm">
                  <Briefcase className="h-4 w-4" />
                  <span>AI 招聘与求职双端平台</span>
                </div>
                <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-tight">
                  一个项目，同时服务求职者与招聘方。
                </h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                  求职者可以上传简历、获取岗位推荐、完成 AI 面试。
                  招聘方可以发布 JD、批量过简历、自动生成面试题并做首轮预评分。
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/8 p-5">
                  <p className="text-sm text-slate-300">求职者端</p>
                  <p className="mt-2 text-xl font-semibold">岗位推荐 + 简历提升</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    基于简历和偏好给出匹配岗位，保留测评与投递闭环。
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 p-5">
                  <p className="text-sm text-slate-300">招聘方端</p>
                  <p className="mt-2 text-xl font-semibold">AI 初筛 + 自动出题</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    围绕 JD 与候选人简历生成题目、给出预筛分数和面试关注点。
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8 lg:px-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-slate-900">
                  {isLogin ? '欢迎回来' : isRegister ? '创建账号' : '重置密码'}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {isLogin
                    ? '登录后将根据你的身份进入对应工作台。'
                    : isRegister
                      ? '注册时选择“求职者”或“招聘方”，系统会自动分流。'
                      : '通过邮箱验证码设置新密码。'}
                </p>
              </div>

              <div className="mb-6 flex rounded-2xl bg-slate-100 p-1">
                <button
                  onClick={() => switchMode('login')}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    isLogin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  登录
                </button>
                <button
                  onClick={() => switchMode('register')}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    isRegister ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  注册
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">注册身份</label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ROLE_OPTIONS.map((option) => {
                        const Icon = option.icon
                        const selected = role === option.value

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setRole(option.value)}
                            className={`rounded-2xl border p-4 text-left transition ${
                              selected
                                ? 'border-primary-500 bg-primary-50 shadow-sm'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`rounded-xl p-2 ${
                                  selected ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900">{option.title}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">{option.description}</p>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {isRegister && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">姓名</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="input-field pl-10"
                        placeholder={role === 'recruiter' ? '请输入招聘负责人姓名' : '请输入你的姓名'}
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">邮箱</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="input-field pl-10"
                      placeholder="name@company.com"
                      required
                    />
                  </div>
                </div>

                {(isRegister || isForgot) && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">邮箱验证码</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        className="input-field"
                        placeholder="输入 6 位验证码"
                        maxLength={6}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => void handleSendCode()}
                        disabled={isBusy || !canSendCode}
                        className="btn-secondary whitespace-nowrap"
                      >
                        {sendingCode ? '发送中...' : '发送验证码'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">验证码 10 分钟内有效。</p>
                  </div>
                )}

                {(isLogin || isRegister) && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">密码</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="input-field pl-10 pr-10"
                        placeholder={isRegister ? '至少 8 位密码' : '输入密码'}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {isForgot && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">新密码</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="input-field pl-10 pr-10"
                        placeholder="请输入新的登录密码"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((current) => !current)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {message && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    {message}
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBusy}
                  className="btn-primary flex w-full items-center justify-center gap-2 py-3"
                >
                  {submitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  ) : isLogin ? (
                    '登录并进入工作台'
                  ) : isRegister ? (
                    '创建账号'
                  ) : (
                    '重置密码'
                  )}
                </button>
              </form>

              <div className="mt-6 space-y-2 text-center text-sm text-slate-500">
                {isLogin && (
                  <>
                    <p>
                      还没有账号？
                      <button
                        onClick={() => switchMode('register')}
                        className="ml-1 font-medium text-primary-600 hover:text-primary-700"
                      >
                        去注册
                      </button>
                    </p>
                    <button
                      onClick={() => switchMode('forgot')}
                      className="font-medium text-primary-600 hover:text-primary-700"
                    >
                      忘记密码？
                    </button>
                  </>
                )}

                {isRegister && (
                  <p>
                    已有账号？
                    <button
                      onClick={() => switchMode('login')}
                      className="ml-1 font-medium text-primary-600 hover:text-primary-700"
                    >
                      立即登录
                    </button>
                  </p>
                )}

                {isForgot && (
                  <p>
                    想起密码了？
                    <button
                      onClick={() => switchMode('login')}
                      className="ml-1 font-medium text-primary-600 hover:text-primary-700"
                    >
                      返回登录
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
