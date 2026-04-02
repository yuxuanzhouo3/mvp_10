'use client'

import type { ReactNode } from 'react'

function resolveLang(text: string) {
  return /[A-Za-z]/.test(text) ? 'en' : undefined
}

export function TechnicalText({
  text,
  className,
  fallback = '暂无',
}: {
  text: string | null | undefined
  className?: string
  fallback?: string
}) {
  const value = typeof text === 'string' && text.trim() ? text.trim() : fallback

  return (
    <span className={`notranslate ${className ?? ''}`.trim()} translate="no" lang={resolveLang(value)}>
      {value}
    </span>
  )
}

export function TechnicalTag({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <span
      className={`notranslate ${className ?? ''}`.trim()}
      translate="no"
      lang={resolveLang(text)}
    >
      {text}
    </span>
  )
}

export function TechnicalList({
  items,
  emptyText = '暂无',
  renderItem,
}: {
  items: string[]
  emptyText?: string
  renderItem?: (item: string) => ReactNode
}) {
  if (items.length === 0) {
    return <span className="text-sm text-slate-500">{emptyText}</span>
  }

  return (
    <>
      {items.map((item) =>
        renderItem ? (
          renderItem(item)
        ) : (
          <TechnicalTag
            key={item}
            text={item}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
          />
        )
      )}
    </>
  )
}
