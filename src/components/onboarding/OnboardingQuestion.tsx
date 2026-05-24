'use client'

import { motion, AnimatePresence } from 'framer-motion'
import OnboardingOption from './OnboardingOption'
import type { Question, QuestionId } from './onboardingData'
import { QUESTION_LABELS } from './onboardingData'

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
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '560px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {QUESTION_LABELS[stepIndex] ?? `Step ${stepIndex + 1}`}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
            {stepIndex + 1} of {totalSteps}
          </span>
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary, #f1f5f9)', lineHeight: 1.3, margin: 0 }}>
          {question.question}
        </h2>
        {question.subtitle && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', marginTop: '6px', margin: '6px 0 0 0' }}>
            {question.subtitle}
          </p>
        )}
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
          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
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

      <div style={{ marginTop: 'auto', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #64748b)',
            cursor: 'pointer',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 0',
            fontFamily: 'inherit',
            transition: 'color 0.15s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = 'var(--text-secondary, #cbd5e1)')}
          onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted, #64748b)')}
        >
          ← Back
        </button>

        {(isMulti || isRank) && (
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              border: 'none',
              background: canContinue ? 'var(--accent, #3b82f6)' : 'var(--border, #1e293b)',
              color: canContinue ? '#fff' : 'var(--text-muted, #64748b)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: canContinue ? 'pointer' : 'default',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
              opacity: canContinue ? 1 : 0.5,
            }}
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  )
}
