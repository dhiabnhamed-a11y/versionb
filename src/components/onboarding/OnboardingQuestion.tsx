'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import OnboardingOption from './OnboardingOption'
import { QUESTION_LABELS } from './onboardingData'
import type { Question, QuestionId } from './onboardingData'
import styles from './OnboardingFlow.module.css'

interface OnboardingQuestionProps {
  question: Question
  stepIndex: number
  totalSteps: number
  currentAnswer: string | string[] | null
  multiSelected?: string[]
  rankSelected?: string[]
  direction: number
  onAnswer: (questionId: QuestionId, value: string | string[]) => void
  onContinue: () => void
  onBack: () => void
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 220 : -220, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -220 : 220, opacity: 0 }),
}

export default function OnboardingQuestion({
  question,
  stepIndex,
  totalSteps,
  currentAnswer,
  multiSelected = [],
  rankSelected = [],
  direction,
  onAnswer,
  onContinue,
  onBack,
}: OnboardingQuestionProps) {
  const isSingle = question.type === 'single'
  const isMulti = question.type === 'multi'
  const isRank = question.type === 'rank'

  function handleSelect(value: string) {
    if (isSingle) {
      onAnswer(question.id, value)
    } else if (isMulti) {
      const current = multiSelected
      if (current.includes(value)) {
        onAnswer(question.id, current.filter((v) => v !== value))
      } else if (current.length < 3) {
        onAnswer(question.id, [...current, value])
      }
    } else if (isRank) {
      const current = rankSelected
      if (current.includes(value)) {
        onAnswer(question.id, current.filter((v) => v !== value))
      } else if (current.length < 2) {
        onAnswer(question.id, [...current, value])
      }
    }
  }

  const canContinue = isMulti ? multiSelected.length > 0 : isRank ? rankSelected.length === 2 : true

  return (
    <div className={styles.questionFrame}>
      <div className={styles.questionIntro}>
        <div className={styles.questionMeta}>
          <span className={styles.questionLabel}>
            {QUESTION_LABELS[stepIndex] ?? `Step ${stepIndex + 1}`}
          </span>
          <span className={styles.stepCount}>
            {stepIndex + 1} of {totalSteps}
          </span>
        </div>
        <h2 className={styles.questionTitle}>{question.question}</h2>
        {question.subtitle && <p className={styles.questionSubtitle}>{question.subtitle}</p>}
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={question.id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={styles.optionsStack}
        >
          {question.options.map((opt) => {
            let selected = false
            let rank: number | undefined

            if (isSingle) {
              selected = currentAnswer === opt.value
            } else if (isMulti) {
              selected = multiSelected.includes(opt.value)
            } else if (isRank) {
              const idx = rankSelected.indexOf(opt.value)
              selected = idx !== -1
              rank = selected ? idx + 1 : undefined
            }

            let disabled = false
            if (isMulti && !selected && multiSelected.length >= 3) disabled = true
            if (isRank && !selected && rankSelected.length >= 2) disabled = true

            return (
              <OnboardingOption
                key={opt.value}
                icon={opt.icon}
                label={opt.label}
                subtitle={opt.subtitle}
                selected={selected}
                rank={rank}
                disabled={disabled}
                onClick={() => handleSelect(opt.value)}
              />
            )
          })}
        </motion.div>
      </AnimatePresence>

      <div className={styles.questionActions}>
        <button type="button" onClick={onBack} className={styles.backButton}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>

        {(isMulti || isRank) && (
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className={styles.continueButton}
          >
            Continue
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
