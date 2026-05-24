'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TEMPLATE_ORDER, ONBOARDING_TEMPLATES, trackOnboardingEvent } from '@/lib/onboarding-engine'
import type { OnboardingTemplateId } from '@/lib/onboarding-engine'
import type { CSSProperties } from 'react'
import { Zap } from 'lucide-react'

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#07090e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  container: {
    maxWidth: '900px',
    width: '100%',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#f1f5f9',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '12px',
    marginBottom: '24px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '20px',
    borderRadius: '14px',
    border: '2px solid #1e293b',
    background: '#0f172a',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.15s, background 0.15s',
    fontFamily: 'inherit',
    color: 'inherit',
    fontSize: 'inherit',
  },
  cardSelected: {
    borderColor: '#3b82f6',
    background: 'rgba(59,130,246,0.06)',
  },
  actions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  } as CSSProperties,
  backBtn: {
    padding: '12px 24px',
    borderRadius: '10px',
    border: '1px solid #1e293b',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  confirmBtn: {
    padding: '12px 24px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
    fontFamily: 'inherit',
  },
}

function ChooseTypeInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const recommended = searchParams.get('recommended') as OnboardingTemplateId | null
  const [selected, setSelected] = useState<OnboardingTemplateId | null>(recommended)

  const handleConfirm = useCallback(() => {
    if (!selected) return
    trackOnboardingEvent('template_selected', { templateId: selected })
    router.push(`/signup?companyType=${ONBOARDING_TEMPLATES[selected].companyType.toLowerCase()}`)
  }, [selected, router])

  if (!selected && recommended) {
    setSelected(recommended)
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Choose your workspace type</h1>
          <p style={styles.subtitle}>Pick the template that best matches your organization</p>
          {recommended && (
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
              💡 Based on your answers, we suggest <strong style={{ color: '#cbd5e1' }}>{ONBOARDING_TEMPLATES[recommended]?.title}</strong>
            </p>
          )}
        </div>

        <div style={styles.grid}>
          {TEMPLATE_ORDER.map((id) => {
            const template = ONBOARDING_TEMPLATES[id]
            const isSelected = selected === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(id)}
                style={{
                  ...styles.card,
                  ...(isSelected ? styles.cardSelected : {}),
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={14} style={{ color: template.accent as string }} />
                  {template.title}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                  {template.sentence}
                </span>
              </button>
            )
          })}
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            onClick={() => router.push('/signup')}
            style={styles.backBtn}
          >
            Back to signup
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selected}
            style={{
              ...styles.confirmBtn,
              opacity: selected ? 1 : 0.5,
            }}
          >
            Continue with {selected ? ONBOARDING_TEMPLATES[selected].title : '...'} →
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChooseTypePage() {
  return (
    <Suspense fallback={null}>
      <ChooseTypeInner />
    </Suspense>
  )
}
