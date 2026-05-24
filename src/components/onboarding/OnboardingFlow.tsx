'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import OnboardingQuestion from './OnboardingQuestion'
import OnboardingRecommendation from './OnboardingRecommendation'
import { computeRecommendation } from './useOnboardingLogic'
import { QUESTIONS } from './onboardingData'
import { Q2_OPTIONS } from './onboardingData'
import type { QuestionId, Answers, Question, TemplateId } from './onboardingData'

interface OnboardingFlowProps {
  onSelect: (templateId: TemplateId) => void
  onSubmit: (templateId: TemplateId) => void
  onBack: () => void
}

const TOTAL_QUESTIONS = 5

const questions: Question[] = [
  QUESTIONS[0],
  QUESTIONS[1],
  QUESTIONS[2],
  QUESTIONS[3],
  QUESTIONS[4],
]

export default function OnboardingFlow({ onSelect, onSubmit, onBack }: OnboardingFlowProps) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [answers, setAnswers] = useState<Answers>({
    q1: null,
    q2: null,
    q3: null,
    q4: [],
    q5: [],
  })

  const currentQuestion = useMemo(() => {
    if (step === 0) return questions[0]
    if (step === 1) {
      const q1Val = answers.q1
      if (q1Val && Q2_OPTIONS[q1Val]) {
        return { ...questions[1], options: Q2_OPTIONS[q1Val] }
      }
      return { ...questions[1], options: [] }
    }
    return questions[step]
  }, [step, answers.q1])

  const recommendation = useMemo(() => {
    if (step < TOTAL_QUESTIONS) return null
    return computeRecommendation(answers)
  }, [step, answers])

  function goForward() {
    setDirection(1)
    setStep((s) => Math.min(s + 1, TOTAL_QUESTIONS))
  }

  function goBack() {
    if (step === 0) {
      onBack()
      return
    }
    setDirection(-1)
    setStep((s) => s - 1)
  }

  const handleAnswer = useCallback(
    (questionId: QuestionId, value: string | string[]) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }))

      if (questionId === 'q1') {
        setAnswers((prev) => ({ ...prev, q2: null }))
        goForward()
      } else if (questionId === 'q2') {
        goForward()
      } else if (questionId === 'q3') {
        goForward()
      }
    },
    []
  )

  const handleContinue = useCallback(() => {
    goForward()
  }, [step])

  function handleConfirm() {
    if (!recommendation) return
    onSelect(recommendation.templateId)
    onSubmit(recommendation.templateId)
  }

  if (step >= TOTAL_QUESTIONS && recommendation) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: '400px' }}>
        <OnboardingRecommendation
          recommendation={recommendation}
          onConfirm={handleConfirm}
          onShowAllTypes={onBack}
        />
      </div>
    )
  }

  const isSingle = currentQuestion.type === 'single'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: '400px' }}>
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          margin: '0 auto 32px auto',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              background: i <= step ? 'var(--accent, #3b82f6)' : 'var(--border, #1e293b)',
              transition: 'background 0.3s ease',
            }}
          />
        ))}
        <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap', marginLeft: '4px' }}>
          ~45s
        </span>
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          initial={{ x: direction > 0 ? 80 : -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction > 0 ? -80 : 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ flex: 1, display: 'flex' }}
        >
          <OnboardingQuestion
            question={currentQuestion}
            stepIndex={step}
            totalSteps={TOTAL_QUESTIONS}
            currentAnswer={isSingle ? (currentQuestion.id === 'q1' ? answers.q1 : currentQuestion.id === 'q2' ? answers.q2 : answers.q3) : null}
            multiSelected={currentQuestion.id === 'q4' || currentQuestion.id === 'q5' ? (answers[currentQuestion.id] as string[]) : undefined}
            rankSelected={currentQuestion.id === 'q5' ? (answers.q5 as string[]) : undefined}
            direction={direction}
            onAnswer={handleAnswer}
            onContinue={handleContinue}
            onBack={goBack}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
