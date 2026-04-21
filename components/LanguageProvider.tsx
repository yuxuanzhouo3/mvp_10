'use client'

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'

import { LANGUAGE_STORAGE_KEY, type Language } from '@/lib/i18n'

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  toggleLanguage: () => void
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

function readStoredLanguage() {
  if (typeof window === 'undefined') {
    return 'zh' as Language
  }

  const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return value === 'en' ? 'en' : 'zh'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('zh')

  useEffect(() => {
    setLanguage(readStoredLanguage())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.cookie = `${LANGUAGE_STORAGE_KEY}=${language}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN'
  }, [language])

  const value: LanguageContextValue = {
    language,
    setLanguage,
    toggleLanguage: () => setLanguage((current) => (current === 'zh' ? 'en' : 'zh')),
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }

  return context
}
