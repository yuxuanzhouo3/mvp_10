'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Clock3, Loader2, X } from 'lucide-react'

import { getStoredAuthToken } from './AuthProvider'

interface WechatPaymentDialogProps {
  amount: number
  checkoutSessionId: string
  codeUrl: string
  expiresAt: string | null
  isMock: boolean
  open: boolean
  planName: string
  onClose: () => void
  onPaid: () => Promise<void> | void
}

type PaymentUiStatus = 'pending' | 'paid' | 'failed'

function formatRemainingTime(expiresAt: string | null) {
  if (!expiresAt) {
    return null
  }

  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) {
    return '00:00'
  }

  const totalSeconds = Math.floor(diff / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function WechatPaymentDialog({
  amount,
  checkoutSessionId,
  codeUrl,
  expiresAt,
  isMock,
  open,
  planName,
  onClose,
  onPaid,
}: WechatPaymentDialogProps) {
  const [status, setStatus] = useState<PaymentUiStatus>('pending')
  const [message, setMessage] = useState('')
  const [checking, setChecking] = useState(false)
  const [remainingTime, setRemainingTime] = useState(() => formatRemainingTime(expiresAt))
  const completedRef = useRef(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setStatus('pending')
    setMessage(isMock ? '当前为本地模拟微信支付，后续填入商户参数即可切换真支付。' : '')
    setRemainingTime(formatRemainingTime(expiresAt))
    completedRef.current = false
  }, [expiresAt, isMock, open, checkoutSessionId])

  useEffect(() => {
    if (!open || !expiresAt) {
      return
    }

    const timer = window.setInterval(() => {
      setRemainingTime(formatRemainingTime(expiresAt))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [expiresAt, open])

  useEffect(() => {
    if (!open || isMock) {
      return
    }

    let disposed = false

    const checkStatus = async () => {
      const token = getStoredAuthToken()
      if (!token || disposed) {
        return
      }

      try {
        const response = await fetch(
          `/api/billing/wechat/status?checkoutSessionId=${encodeURIComponent(checkoutSessionId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
          }
        )

        const payload = (await response.json()) as {
          status?: 'created' | 'paid' | 'failed'
          tradeState?: string
          error?: string
        }

        if (!response.ok) {
          throw new Error(payload.error || '微信支付状态查询失败。')
        }

        if (payload.status === 'paid' && !completedRef.current) {
          completedRef.current = true
          setStatus('paid')
          setMessage('微信支付已完成，会员状态已更新。')
          await onPaid()
          return
        }

        if (payload.status === 'failed') {
          setStatus('failed')
          setMessage(`支付状态异常：${payload.tradeState || 'FAILED'}`)
        }
      } catch (error) {
        if (!disposed) {
          setMessage(error instanceof Error ? error.message : '微信支付状态查询失败。')
        }
      }
    }

    void checkStatus()
    const timer = window.setInterval(() => {
      void checkStatus()
    }, 3000)

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [checkoutSessionId, isMock, onPaid, open])

  const qrImageUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(codeUrl)}`,
    [codeUrl]
  )

  async function handleMockPaid() {
    const token = getStoredAuthToken()
    if (!token) {
      setMessage('请先重新登录。')
      return
    }

    try {
      setChecking(true)
      setMessage('')

      const response = await fetch('/api/billing/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          checkoutSessionId,
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || '模拟支付确认失败。')
      }

      setStatus('paid')
      setMessage('模拟微信支付已完成，会员状态已更新。')
      await onPaid()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '模拟支付确认失败。')
    } finally {
      setChecking(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="w-full max-w-[480px] rounded-[28px] bg-white shadow-[0_32px_90px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">微信支付</h3>
            <p className="mt-1 text-sm text-slate-500">{planName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          {status === 'paid' ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-700">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6" />
                <div>
                  <p className="font-medium">支付成功</p>
                  <p className="mt-1 text-sm">会员权限已经同步到账户。</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <img src={qrImageUrl} alt="微信支付二维码" className="h-64 w-64 rounded-xl" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-slate-500">请使用微信扫一扫完成支付</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">¥{amount.toFixed(2)}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    <span>二维码有效期</span>
                  </span>
                  <span className="font-medium text-slate-900">{remainingTime || '长期有效'}</span>
                </div>
                {isMock && (
                  <p className="mt-3 text-xs leading-6 text-slate-500">
                    目前使用的是本地模拟二维码，等你把微信支付商户参数给我后，我会替换成真实下单接口。
                  </p>
                )}
              </div>
            </>
          )}

          {message && (
            <div
              className={`rounded-2xl px-4 py-3 text-sm ${
                status === 'paid'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-sky-200 bg-sky-50 text-sky-700'
              }`}
            >
              {message}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {isMock && status !== 'paid' && (
              <button
                type="button"
                onClick={() => void handleMockPaid()}
                disabled={checking}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#07c160] px-4 text-sm font-medium text-white transition hover:bg-[#06ad56] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>{checking ? '处理中...' : '模拟支付成功'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {status === 'paid' ? '完成' : '稍后支付'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
