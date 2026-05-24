'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Recommendation } from './onboardingData'

interface OnboardingRecommendationProps {
  recommendation: Recommendation
  onConfirm: () => void
  onShowAllTypes: () => void
}

export default function OnboardingRecommendation({
  recommendation,
  onConfirm,
  onShowAllTypes,
}: OnboardingRecommendationProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '520px',
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          marginBottom: '24px',
          boxShadow: '0 8px 32px rgba(34,197,94,0.25)',
        }}
      >
        ✓
      </motion.div>

      <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary, #f1f5f9)', margin: '0 0 6px 0' }}>
        Your workspace is ready.
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--text-muted, #64748b)', margin: '0 0 28px 0' }}>
        Based on your answers, we recommend:
      </p>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: '16px',
          padding: '24px',
          width: '100%',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary, #f1f5f9)', margin: '0 0 8px 0' }}>
          {recommendation.label}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.6, margin: 0 }}>
          {recommendation.description}
        </p>

        {recommendation.note && (
          <p style={{ fontSize: '12px', color: '#22c55e', marginTop: '12px', margin: '12px 0 0 0', padding: '8px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.15)' }}>
            💡 {recommendation.note}
          </p>
        )}
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{ width: '100%', marginBottom: '28px' }}
      >
        <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px 0', textAlign: 'center' }}>
          What you&apos;ll get
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recommendation.bullets.map((bullet, i) => (
            <motion.div
              key={i}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--card-bg, #0f172a)',
                border: '1px solid var(--border, #1e293b)',
                fontSize: '13px',
                color: 'var(--text-primary, #f1f5f9)',
                fontWeight: 500,
                textAlign: 'left',
              }}
            >
              <span style={{ color: '#22c55e', fontSize: '16px', flexShrink: 0 }}>✓</span>
              {bullet}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {recommendation.alternativeTemplateId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            fontSize: '12px',
            color: 'var(--text-muted, #64748b)',
            marginBottom: '16px',
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.12)',
          }}
        >
          💡 Based on your team size, we recommend this setup. If you prefer{' '}
          <strong style={{ color: 'var(--text-secondary, #cbd5e1)' }}>{recommendation.alternativeLabel}</strong>
          , you can choose it below.
        </motion.div>
      )}

      <motion.button
        type="button"
        onClick={onConfirm}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{
          padding: '14px 32px',
          borderRadius: '12px',
          border: 'none',
          background: 'linear-gradient(135deg, var(--accent, #3b82f6), #6366f1)',
          color: '#fff',
          fontWeight: 700,
          fontSize: '15px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: '0 4px 20px rgba(59,130,246,0.3)',
          marginBottom: '16px',
          width: '100%',
          maxWidth: '320px',
        }}
      >
        Set up my {recommendation.label} →
      </motion.button>

      <button
        type="button"
        onClick={onShowAllTypes}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted, #64748b)',
          cursor: 'pointer',
          fontSize: '12px',
          textDecoration: 'underline',
          textUnderlineOffset: '3px',
          fontFamily: 'inherit',
          padding: '4px 0',
          marginBottom: '8px',
        }}
      >
        See all workspace types
      </button>

      <p style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', margin: 0 }}>
        You can always change this later in Settings
      </p>

      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted, #64748b)',
          cursor: 'pointer',
          fontSize: '11px',
          marginTop: '16px',
          fontFamily: 'inherit',
          padding: '4px 0',
        }}
      >
        {showDetails ? 'Hide' : 'Why this recommendation?'} →
      </button>

      {showDetails && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          style={{
            marginTop: '12px',
            padding: '14px',
            borderRadius: '10px',
            background: 'var(--card-bg, #0f172a)',
            border: '1px solid var(--border, #1e293b)',
            fontSize: '12px',
            color: 'var(--text-muted, #64748b)',
            textAlign: 'left',
            lineHeight: 1.6,
            overflow: 'hidden',
            width: '100%',
          }}
        >
          We matched your answers to our workspace templates:
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px' }}>
            <li>Your organization type determined the base template</li>
            <li>Your team size adjusted the scale of the workspace</li>
            <li>Your challenges added relevant features and tools</li>
            <li>Your priorities shaped the default dashboard layout</li>
          </ul>
        </motion.div>
      )}
    </motion.div>
  )
}
