'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import styles from './OnboardingFlow.module.css'

interface OnboardingOptionProps {
  icon: string
  label: string
  subtitle: string
  selected: boolean
  rank?: number
  disabled?: boolean
  onClick: () => void
}

export default function OnboardingOption({ icon, label, subtitle, selected, rank, disabled, onClick }: OnboardingOptionProps) {
  return (
    <motion.button
      type="button"
      className={[
        styles.optionButton,
        selected ? styles.optionSelected : '',
        disabled ? styles.optionDisabled : '',
      ].filter(Boolean).join(' ')}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.006 }}
      whileTap={disabled ? {} : { scale: 0.994 }}
      layout
    >
      <span className={styles.optionIcon} aria-hidden="true">{icon}</span>
      <span className={styles.optionCopy}>
        <span className={styles.optionLabel}>{label}</span>
        <span className={styles.optionSubtitle}>{subtitle}</span>
      </span>
      {rank !== undefined ? (
        <span className={styles.rankBadge} aria-label={`Ranked ${rank}`}>{rank}</span>
      ) : (
        <span className={styles.optionMark} aria-hidden="true">
          <Check size={14} />
        </span>
      )}
    </motion.button>
  )
}
