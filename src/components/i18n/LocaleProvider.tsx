'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LOCALE,
  createTranslator,
  isRtlLocale,
  normalizeAppLocale,
  type AppLocale,
  type TranslationKey,
} from '@/lib/i18n'

type LocaleContextValue = {
  locale: AppLocale
  direction: 'ltr' | 'rtl'
  saving: boolean
  t: (key: TranslationKey) => string
  setLocale: (locale: AppLocale) => Promise<void>
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function applyDocumentLocale(locale: AppLocale) {
  const direction = isRtlLocale(locale) ? 'rtl' : 'ltr'
  document.documentElement.lang = locale
  document.documentElement.dir = direction
  document.body.dataset.locale = locale
  document.body.dir = direction
}

export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode
  initialLocale?: string | null
}) {
  const [locale, setLocaleState] = useState<AppLocale>(() => normalizeAppLocale(initialLocale))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    applyDocumentLocale(locale)
    window.localStorage.setItem('taskit:preferred-locale', locale)
  }, [locale])

  const setLocale = useCallback(
    async (nextLocale: AppLocale) => {
      const normalized = normalizeAppLocale(nextLocale)
      const previous = locale
      setLocaleState(normalized)
      setSaving(true)

      try {
        const response = await fetch('/api/settings/language', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: normalized }),
        })

        if (!response.ok) {
          throw new Error('Language could not be saved.')
        }
      } catch (error) {
        setLocaleState(previous)
        throw error
      } finally {
        setSaving(false)
      }
    },
    [locale]
  )

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      direction: isRtlLocale(locale) ? 'rtl' : 'ltr',
      saving,
      t: createTranslator(locale),
      setLocale,
    }),
    [locale, saving, setLocale]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const value = useContext(LocaleContext)
  if (!value) {
    throw new Error('useLocale must be used inside LocaleProvider')
  }

  return value
}
