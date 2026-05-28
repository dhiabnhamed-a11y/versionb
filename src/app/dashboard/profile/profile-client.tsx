'use client'

import { useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Camera, Save, Upload } from 'lucide-react'
import UserAvatar from '@/components/user/UserAvatar'
import { readJsonResponse } from '@/lib/read-json'
import { useLocale } from '@/components/i18n/LocaleProvider'

type Profile = {
  id: string
  name: string
  email: string
  role: string
  avatar: string | null
}

type ProfileClientProps = {
  initialProfile: Profile
}

export default function ProfileClient({ initialProfile }: ProfileClientProps) {
  const { update } = useSession()
  const { t } = useLocale()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [profile, setProfile] = useState(initialProfile)
  const [name, setName] = useState(initialProfile.name)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const previewAvatar = previewUrl ?? profile.avatar
  const changed = useMemo(() => {
    return name.trim() !== profile.name || Boolean(file)
  }, [file, name, profile.name])

  function chooseFile(nextFile: File | null) {
    setError('')
    setFile(nextFile)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null)
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const formData = new FormData()
    formData.set('name', name)
    if (file) formData.set('avatar', file)

    const response = await fetch('/api/profile', {
      method: 'PATCH',
      body: formData,
    })
    const data = await readJsonResponse<(Profile & { error?: string }) | { error: string }>(response, { error: t('profile.failed') })
    setSaving(false)

    if (!response.ok || data.error || !('id' in data)) {
      setError(data.error || t('profile.failed'))
      return
    }

    setProfile(data)
    setName(data.name)
    setFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setMessage(t('profile.updated'))
    window.dispatchEvent(new CustomEvent('taskit:profile-updated', { detail: data }))
    await update({ name: data.name, avatar: data.avatar })
  }

  return (
    <div className="dashboard-page" style={{ maxWidth: '920px' }}>
      <div className="dashboard-header-row">
        <div>
          <h1 className="page-heading">{t('profile.title')}</h1>
          <p className="page-sub">{t('profile.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={saveProfile} className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="card">
          <div className="flex flex-col items-center text-center">
            <UserAvatar name={name} avatar={previewAvatar} size={148} radius={28} className="shadow-sm ring-1 ring-[var(--border)]" />
            <button
              type="button"
              className="btn-secondary mt-5 inline-flex items-center gap-2"
              onClick={() => inputRef.current?.click()}
              style={{ fontSize: '13px', padding: '9px 14px' }}
            >
              <Camera size={15} />
              {t('profile.changePicture')}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => chooseFile(event.currentTarget.files?.[0] ?? null)}
            />
            <div className="mt-4 text-xs leading-5 text-[var(--text-muted)]">
              {t('profile.pictureHint')}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">{t('profile.personalDetails')}</h2>
              <p className="panel-meta">{t('profile.personalDetailsMeta')}</p>
            </div>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('profile.displayName')}</span>
              <input
                className="input"
                value={name}
                minLength={2}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>

            <label className="grid gap-1.5">
<span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('profile.email')}</span>
               <input className="input" value={profile.email} disabled />
            </label>

            <label className="grid gap-1.5">
<span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('profile.role')}</span>
               <input className="input" value={profile.role} disabled />
            </label>
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm font-medium text-red-500">
              {error}
            </div>
          )}
          {message && (
            <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm font-medium text-emerald-600">
              {message}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="btn-primary inline-flex items-center gap-2"
              disabled={saving || !changed}
              style={{ fontSize: '13px', padding: '10px 16px', opacity: saving || !changed ? 0.55 : undefined }}
            >
              {saving ? <Upload size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? t('profile.saving') : t('profile.save')}
            </button>
            {file && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => chooseFile(null)}
                style={{ fontSize: '13px', padding: '10px 16px' }}
              >
                {t('profile.removeFile')}
              </button>
            )}
          </div>
        </section>
      </form>
    </div>
  )
}
