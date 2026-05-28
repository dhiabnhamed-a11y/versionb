'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, CheckCircle2, Info } from 'lucide-react'
import type { Recommendation } from './onboardingData'
import styles from './OnboardingFlow.module.css'

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
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className={styles.recommendation}
    >
      <motion.div
        initial={{ scale: 0.75, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.12, type: 'spring', stiffness: 220, damping: 18 }}
        className={styles.successMark}
      >
        <CheckCircle2 size={34} aria-hidden="true" />
      </motion.div>

      <span className={styles.recommendationLabel}>Workspace fit</span>
      <h2 className={styles.recommendationTitle}>Your workspace is ready.</h2>
      <p className={styles.recommendationLead}>Based on your answers, we recommend:</p>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.18 }}
        className={styles.recommendationCard}
      >
        <h3>{recommendation.label}</h3>
        <p>{recommendation.description}</p>

        {recommendation.note && (
          <span className={styles.note}>
            <Info size={14} aria-hidden="true" />
            {recommendation.note}
          </span>
        )}
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.24 }}
        className={styles.benefits}
      >
        <h4>What you will get</h4>
        <div className={styles.benefitList}>
          {recommendation.bullets.map((bullet, index) => (
            <motion.div
              key={bullet}
              initial={{ x: -8, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 + index * 0.06 }}
              className={styles.benefitItem}
            >
              <Check size={15} aria-hidden="true" />
              {bullet}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {recommendation.alternativeTemplateId && (
        <p className={styles.alternative}>
          Based on your team size, we recommend this setup. If you prefer{' '}
          <strong>{recommendation.alternativeLabel}</strong>, you can choose it below.
        </p>
      )}

      <motion.button
        type="button"
        onClick={onConfirm}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.36 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={styles.confirmButton}
      >
        Set up my {recommendation.label}
        <ArrowRight size={17} aria-hidden="true" />
      </motion.button>

      <button type="button" onClick={onShowAllTypes} className={styles.linkButton}>
        See all workspace types
      </button>

      <p className={styles.smallPrint}>You can always change this later in Settings.</p>

      <button type="button" onClick={() => setShowDetails(!showDetails)} className={styles.detailsButton}>
        {showDetails ? 'Hide details' : 'Why this recommendation?'}
        <ArrowRight size={14} aria-hidden="true" />
      </button>

      {showDetails && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className={styles.detailsPanel}
        >
          We matched your answers to TASKIT workspace templates:
          <ul>
            <li>Your organization type determined the base template.</li>
            <li>Your team size adjusted the scale of the workspace.</li>
            <li>Your pressure points and day-one systems weighted ERP, EMS, and operations modules.</li>
            <li>Your discipline level and priorities shaped controls, dashboards, and automation defaults.</li>
          </ul>
        </motion.div>
      )}
    </motion.div>
  )
}
