'use client'

import { useState, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ShieldCheck, Sparkles } from 'lucide-react'
import OnboardingQuestion from './OnboardingQuestion'
import OnboardingRecommendation from './OnboardingRecommendation'
import { computeRecommendation } from './useOnboardingLogic'
import { QUESTIONS } from './onboardingData'
import { Q2_OPTIONS } from './onboardingData'
import type { QuestionId, Answers, CompanyType, Question, TemplateId } from './onboardingData'
import styles from './OnboardingFlow.module.css'

export type OnboardingSelection = {
  companyType: CompanyType
  templateId: TemplateId
}

interface OnboardingFlowProps {
  onSelect: (selection: OnboardingSelection) => void
  onSubmit: (selection: OnboardingSelection) => void
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

  function handleContinue() {
    goForward()
  }

  function handleConfirm() {
    if (!recommendation) return
    const selection = {
      companyType: recommendation.companyType,
      templateId: recommendation.templateId,
    }
    onSelect(selection)
    onSubmit(selection)
  }

  if (step >= TOTAL_QUESTIONS && recommendation) {
    return (
      <main className={styles.flowStage} id="main-content">
        <section className={styles.flowShell} aria-label="Workspace recommendation">
          <div className={styles.flowMain}>
            <OnboardingRecommendation
              recommendation={recommendation}
              onConfirm={handleConfirm}
              onShowAllTypes={onBack}
            />
          </div>
          <aside className={styles.sidePanel} aria-label="Generated workspace details">
            <div className={styles.sideCard}>
              <strong><Sparkles size={16} aria-hidden="true" /> Recommendation ready</strong>
              <p>TASKIT will use this fit to generate workspace structure before account setup.</p>
              <div className={styles.sideStats}>
                <span>AI matched</span>
                <span>Workflow aware</span>
                <span>Editable later</span>
              </div>
            </div>
          </aside>
        </section>
      </main>
    )
  }

  const isSingle = currentQuestion.type === 'single'

  return (
    <main className={styles.flowStage} id="main-content">
      <section className={styles.flowShell} aria-label="Workspace fit onboarding">
        <div className={styles.flowMain}>
          <div className={styles.progressHeader} aria-label="Question progress">
            <div className={styles.progressMeta}>
              <span>{step + 1} of {TOTAL_QUESTIONS}</span>
              <span className={styles.timeBadge}>~45s</span>
            </div>
            <div className={styles.progressTrack}>
              {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
                <span
                  key={i}
                  className={`${styles.progressSegment} ${i <= step ? styles.progressSegmentActive : ''}`}
                />
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ x: direction > 0 ? 56 : -56, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? -56 : 56, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
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

        <aside className={styles.sidePanel} aria-label="Onboarding benefits">
          <div className={styles.sideCard}>
            <strong><Sparkles size={16} aria-hidden="true" /> Smart fit</strong>
            <p>Your answers shape the departments, workflows, dashboards, and AI copilots TASKIT prepares next.</p>
            <div className={styles.sideStats}>
              <span><ShieldCheck size={13} aria-hidden="true" /> Secure setup</span>
              <span>5 guided answers</span>
              <span>Ready defaults</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  )
}
