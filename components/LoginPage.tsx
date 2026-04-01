'use client'

import { useState } from 'react'
import { Building, Eye, EyeOff, Lock, Mail, User } from 'lucide-react'

import { useAuth } from './AuthProvider'

type AuthMode = 'login' | 'register' | 'forgot'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
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
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    resetFeedback()

    try {
      if (isLogin) {
        await login(email, password)
        return
      }

      if (isRegister) {
        await register({ email, password, name, code })
        return
      }

      const resultMessage = await resetPassword({
        email,
        code,
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
      const resultMessage = isRegister
        ? await sendRegistrationCode(email)
        : await forgotPassword(email)

      setMessage(resultMessage)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '发送验证码失败。')
    } finally {
      setSendingCode(false)
    }
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gradient mb-2">求职平台</h1>
            <p className="text-gray-600">AI 驱动的岗位匹配、候选人分析与面试流程平台</p>
          </div>

          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                isLogin ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                isRegister ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="input-field pl-10"
                    placeholder="请输入姓名"
                    required={isRegister}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input-field pl-10"
                  placeholder="请输入邮箱"
                  required
                />
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱验证码</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    className="input-field"
                    placeholder="输入 6 位验证码"
                    maxLength={6}
                    required={isRegister}
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
                <p className="mt-2 text-xs text-gray-500">验证码 10 分钟内有效。</p>
              </div>
            )}

            {(isLogin || isRegister) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="input-field pl-10 pr-10"
                    placeholder={isRegister ? '请输入至少 8 位密码' : '请输入密码'}
                    required={isLogin || isRegister}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}

            {isForgot && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      className="input-field"
                      placeholder="请输入 6 位验证码"
                      maxLength={6}
                      required={isForgot}
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="input-field pl-10 pr-10"
                      placeholder="请输入新密码，至少 8 位"
                      required={isForgot}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {message && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="whitespace-pre-line text-sm text-blue-700">{message}</p>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="btn-primary flex w-full items-center justify-center"
            >
              {submitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
              ) : isLogin ? (
                '登录'
              ) : isRegister ? (
                '注册'
              ) : (
                '重置密码'
              )}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            {isLogin && (
              <>
                <p className="text-sm text-gray-600">
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
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  忘记密码？
                </button>
              </>
            )}

            {isRegister && (
              <p className="text-sm text-gray-600">
                已有账号？
                <button
                  onClick={() => switchMode('login')}
                  className="ml-1 font-medium text-primary-600 hover:text-primary-700"
                >
                  去登录
                </button>
              </p>
            )}

            {isForgot && (
              <p className="text-sm text-gray-600">
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

        <div className="mt-8 text-center">
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
            <Building className="h-4 w-4" />
            <span>Powered by AI & Machine Learning</span>
          </div>
        </div>
      </div>
    </div>
  )
}
