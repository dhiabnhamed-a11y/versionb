'use client'

import { motion } from 'framer-motion'

interface OnboardingOptionProps {
  icon: string
  label: string
  subtitle: string
  selected: boolean
  rank?: number
  disabled?: boolean
  onClick: () => void
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  width: '100%',
  padding: '16px 20px',
  borderRadius: '14px',
  border: '2px solid var(--border, #1e293b)',
  background: 'var(--card-bg, #0f172a)',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'border-color 0.15s, background 0.15s',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  color: 'inherit',
  lineHeight: 1.4,
}

const selectedCardStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: 'var(--accent, #3b82f6)',
  background: 'color-mix(in srgb, var(--accent, #3b82f6) 8%, var(--card-bg, #0f172a))',
}

const disabledCardStyle: React.CSSProperties = {
  ...cardStyle,
  opacity: 0.4,
  cursor: 'default',
}

const selectedDisabledCardStyle: React.CSSProperties = {
  ...selectedCardStyle,
  opacity: 0.4,
  cursor: 'default',
}

export default function OnboardingOption({ icon, label, subtitle, selected, rank, disabled, onClick }: OnboardingOptionProps) {
  const style = disabled
    ? (selected ? selectedDisabledCardStyle : disabledCardStyle)
    : (selected ? selectedCardStyle : cardStyle)

  return (
    <motion.button
      type="button"
      style={style}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.01, borderColor: 'var(--accent, #3b82f6)' }}
      whileTap={disabled ? {} : { scale: 0.99 }}
      layout
    >
      <span style={{ fontSize: '24px', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary, #f1f5f9)' }}>
          {label}
          {rank !== undefined && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'var(--accent, #3b82f6)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                marginLeft: '8px',
                verticalAlign: 'middle',
              }}
            >
              {rank}
            </span>
          )}
        </span>
        <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
          {subtitle}
        </span>
      </span>
    </motion.button>
  )
}
