'use client'

import { useState } from 'react'
import { Languages } from 'lucide-react'
import { LOCALE_OPTIONS, type AppLocale } from '@/lib/i18n'
import { useLocale } from '@/components/i18n/LocaleProvider'

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, saving, setLocale, t } = useLocale()
  const [error, setError] = useState<string | null>(null)

  async function changeLocale(value: AppLocale) {
    setError(null)
    try {
      await setLocale(value)
    } catch {
      setError(t('language.error'))
    }
  }

  return (
    <div className="language-switcher" data-compact={compact ? 'true' : undefined}>
      <label className="language-switcher-label">
        <Languages size={15} />
        <span>{t('language.label')}</span>
      </label>
      <select
        value={locale}
        disabled={saving}
        onChange={(event) => void changeLocale(event.target.value as AppLocale)}
        aria-label={t('language.label')}
        title={saving ? t('language.saving') : t('language.label')}
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.nativeLabel}
          </option>
        ))}
      </select>
      {error && <span className="language-switcher-error">{error}</span>}
    </div>
  )
}
