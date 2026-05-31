'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  HardHat,
  HeartPulse,
  Hospital,
  Landmark,
  Layers3,
  Lock,
  Scale,
  ServerCog,
  ShieldCheck,
  UserCheck,
  Zap,
} from 'lucide-react'
import {
  getTemplate,
  type OnboardingTemplateId,
} from '@/lib/onboarding-engine'
import styles from '../SignupOnboardingClient.module.css'

const iconMap = {
  briefcase: BriefcaseBusiness,
  heartPulse: HeartPulse,
  hospital: Hospital,
  building: Building2,
  server: ServerCog,
  scale: Scale,
  hardHat: HardHat,
  landmark: Landmark,
  graduationCap: GraduationCap,
  sparkles: Zap,
} as const

const trustItems = [
  {
    icon: ShieldCheck,
    title: 'Tenant-isolated by default',
    detail: 'Your company data is scoped to its own workspace before teammates are invited.',
  },
  {
    icon: UserCheck,
    title: 'Role-based access',
    detail: 'Owners stay in control of permissions, approvals, and team visibility.',
  },
  {
    icon: Lock,
    title: 'Audit-ready activity',
    detail: 'Important setup and access events are prepared for traceability.',
  },
  {
    icon: CreditCard,
    title: 'Billing stays transparent',
    detail: 'Start setup first, then choose or activate a plan when you are ready.',
  },
] as const

const readinessItems = [
  'Secure owner account',
  'Workspace identity',
  'Team access controls',
  'Compliance consent',
] as const

const commitmentItems = [
  'Verify company details before launch',
  'Invite teammates with clear roles',
  'Adjust modules and workflows anytime',
] as const

export default function WorkspacePreview({ templateId, compact = false }: { templateId: OnboardingTemplateId; compact?: boolean }) {
  const template = getTemplate(templateId)
  const Icon = iconMap[template.icon as keyof typeof iconMap] ?? Zap

  return (
    <AnimatePresence mode="wait">
      <motion.aside
        key={template.id}
        className={`${styles.previewShell} ${compact ? styles.previewShellCompact : ''}`}
        style={{ '--template-accent': template.accent, '--template-soft': template.softAccent } as CSSProperties}
        initial={{ opacity: 0, y: 10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.99 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        aria-live="polite"
      >
        <div className={styles.previewHeader}>
          <div className={styles.previewMark}>
            <Icon size={22} aria-hidden="true" />
          </div>
          <div>
            <p className={styles.previewKicker}>Trusted workspace setup</p>
            <h2>Secure setup for {template.title} teams</h2>
          </div>
        </div>

        <div className={styles.previewCanvas}>
          <div className={styles.previewTopbar}>
            <span />
            <span />
            <span />
            <strong>TASKIT</strong>
          </div>

          <div className={styles.previewDashboard}>
            <div className={styles.previewPrimaryPanel}>
              <div className={styles.previewPanelHead}>
                <span>Launch readiness</span>
                <CheckCircle2 size={14} />
              </div>
              <div className={styles.previewReadinessList}>
                {readinessItems.map((item, index) => (
                  <motion.div
                    key={item}
                    className={styles.previewReadinessItem}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <CheckCircle2 size={15} aria-hidden="true" />
                    <span>{item}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className={styles.previewSidePanel}>
              {trustItems.slice(0, 2).map((item, index) => {
                const TrustIcon = item.icon

                return (
                  <motion.div
                    key={item.title}
                    className={styles.previewMetric}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + index * 0.045 }}
                  >
                    <div>
                      <span>{item.title}</span>
                      <TrustIcon size={16} aria-hidden="true" />
                    </div>
                    <p>{item.detail}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>

          <div className={styles.previewTrustPanel}>
            <div className={styles.previewPanelHead}>
              <span>Trust controls</span>
              <ShieldCheck size={14} />
            </div>
            <div className={styles.previewTrustList}>
              {trustItems.map((item) => {
                const TrustIcon = item.icon

                return (
                  <div key={item.title} className={styles.previewTrustItem}>
                    <TrustIcon size={16} aria-hidden="true" />
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className={styles.previewCommitmentGrid}>
            {commitmentItems.map((item) => (
              <div key={item} className={styles.previewCommitment}>
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.previewInsight}>
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Your workspace is prepared with tenant isolation, controlled roles, explicit consent, and audit visibility.</span>
        </div>
        <div className={styles.previewInsight}>
          <Layers3 size={16} aria-hidden="true" />
          <span>{template.title} settings can be adjusted after signup as your team, departments, and workflow needs become clearer.</span>
        </div>
        <p className={styles.previewTagline}>Professional setup first. Customization stays in your control.</p>
      </motion.aside>
    </AnimatePresence>
  )
}
