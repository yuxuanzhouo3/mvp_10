'use client'

import { useState } from 'react'
import { Building, Eye, EyeOff, Lock, Mail, User } from 'lucide-react'

import { useAuth } from './AuthProvider'

type AuthMode = 'login' | 'register' | 'forgot'

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const { login, register, forgotPassword, resetPassword } = useAuth()

  const isLogin = mode === 'login'
  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'

  const resetFeedback = () => {
    setError('')
    setMessage('')
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    resetFeedback()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    resetFeedback()

    try {
      if (isLogin) {
        await login(email, password)
        return
      }

      if (isRegister) {
        await register({ email, password, name })
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
      setLoading(false)
    }
  }

  const handleSendCode = async () => {
    setLoading(true)
    resetFeedback()

    try {
      const resultMessage = await forgotPassword(email)
      setMessage(resultMessage)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '发送验证码失败。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gradient mb-2">求职平台</h1>
            <p className="text-gray-600">AI 驱动的职位匹配、候选人分析与面试流程平台</p>
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
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
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
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
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

            {(isLogin || isRegister) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="input-field pl-10 pr-10"
                    placeholder={isRegister ? '请输入至少 8 位密码' : '请输入密码'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                      disabled={loading || !email}
                      className="btn-secondary whitespace-nowrap"
                    >
                      发送验证码
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="input-field pl-10 pr-10"
                      placeholder="请输入新的密码，至少 8 位"
                      required={isForgot}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((current) => !current)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {message && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-700 text-sm whitespace-pre-line">{message}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : isLogin ? (
                '登录'
              ) : isRegister ? (
                '注册'
              ) : (
                '重置密码'
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {isLogin && (
              <>
                <p className="text-sm text-gray-600">
                  还没有账号？
                  <button
                    onClick={() => switchMode('register')}
                    className="text-primary-600 hover:text-primary-700 font-medium ml-1"
                  >
                    去注册
                  </button>
                </p>
                <button
                  onClick={() => switchMode('forgot')}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
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
                  className="text-primary-600 hover:text-primary-700 font-medium ml-1"
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
                  className="text-primary-600 hover:text-primary-700 font-medium ml-1"
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
