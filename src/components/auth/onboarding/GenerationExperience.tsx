'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, CheckCircle2, Layers3, RadioTower, Zap } from 'lucide-react'
import { createGenerationPlan, getTemplate, type OnboardingTemplateId } from '@/lib/onboarding-engine'
import styles from '../SignupOnboardingClient.module.css'

export default function GenerationExperience({
  templateId,
  onComplete,
}: {
  templateId: OnboardingTemplateId
  onComplete: () => void
}) {
  const template = getTemplate(templateId)
  const plan = useMemo(() => createGenerationPlan(template), [template])
  const [activeIndex, setActiveIndex] = useState(0)
  const [progress, setProgress] = useState(7)

  useEffect(() => {
    if (progress >= 100) {
      const timeout = window.setTimeout(onComplete, 650)
      return () => window.clearTimeout(timeout)
    }

    const interval = window.setInterval(() => {
      setProgress((current) => {
        const next = Math.min(100, current + 5 + Math.round(Math.random() * 7))
        setActiveIndex(Math.min(plan.length - 1, Math.floor((next / 100) * plan.length)))
        return next
      })
    }, 210)

    return () => window.clearInterval(interval)
  }, [onComplete, plan.length, progress])

  return (
    <section
      className={styles.generationShell}
      style={{ '--template-accent': template.accent, '--template-soft': template.softAccent } as React.CSSProperties}
      aria-live="polite"
    >
      <div className={styles.generationOrb} aria-hidden="true">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
        />
        <Bot size={34} />
      </div>

      <div className={styles.generationCopy}>
        <p className={styles.stepKicker}>
          <Zap size={14} />
          AI ERP generation
        </p>
        <h1>TASKIT AI is preparing your {template.title.toLowerCase()} workspace...</h1>
        <p>
          Departments, RBAC, audit logs, dashboards, workflows, finance foundations, copilots, event automations,
          analytics, and realtime collaboration are being assembled now.
        </p>
      </div>

      <div className={styles.generationProgress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div>
          <span>Generation progress</span>
          <strong>{progress}%</strong>
        </div>
        <div className={styles.progressTrack}>
          <motion.span animate={{ width: `${progress}%` }} transition={{ duration: 0.22 }} />
        </div>
      </div>

      <div className={styles.generationGrid}>
        {plan.map((item, index) => {
          const done = index < activeIndex || progress >= 100
          const active = index === activeIndex && progress < 100

          return (
            <motion.div
              key={item.label}
              className={`${styles.generationLog} ${active ? styles.generationLogActive : ''} ${done ? styles.generationLogDone : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.035 }}
            >
              <div className={styles.generationLogIcon}>
                {done ? <CheckCircle2 size={16} /> : active ? <RadioTower size={16} /> : <Layers3 size={16} />}
              </div>
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
                <span>{item.artifact}</span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
