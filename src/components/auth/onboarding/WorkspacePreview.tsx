'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  GraduationCap,
  HardHat,
  HeartPulse,
  Hospital,
  Landmark,
  Layers3,
  Scale,
  ServerCog,
  Sparkles,
} from 'lucide-react'
import {
  createWorkspaceModules,
  getTemplate,
  type OnboardingTemplate,
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
  sparkles: Sparkles,
} as const

export default function WorkspacePreview({ templateId, compact = false }: { templateId: OnboardingTemplateId; compact?: boolean }) {
  const template = getTemplate(templateId)
  const modules = createWorkspaceModules(template)
  const Icon = iconMap[template.icon as keyof typeof iconMap] ?? Sparkles

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
            <p className={styles.previewKicker}>Live AI workspace preview</p>
            <h2>{template.title} operating system</h2>
          </div>
        </div>

        <div className={styles.previewCanvas}>
          <div className={styles.previewTopbar}>
            <span />
            <span />
            <span />
            <strong>TASKIT AI</strong>
          </div>

          <div className={styles.previewDashboard}>
            <div className={styles.previewPrimaryPanel}>
              <div className={styles.previewPanelHead}>
                <span>Workspace map</span>
                <CheckCircle2 size={14} />
              </div>
              <div className={styles.previewDepartmentGrid}>
                {template.departments.map((department, index) => (
                  <motion.div
                    key={department}
                    className={styles.previewDepartment}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <span />
                    {department}
                  </motion.div>
                ))}
              </div>
            </div>

            <div className={styles.previewSidePanel}>
              {modules.map((module, index) => (
                <motion.div
                  key={module.label}
                  className={styles.previewMetric}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + index * 0.045 }}
                >
                  <div>
                    <span>{module.label}</span>
                    <strong>{module.value}</strong>
                  </div>
                  <p>{module.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <PreviewRail title="Workflows" items={template.workflows} template={template} />
          <PreviewRail title="AI copilots" items={template.copilots} template={template} icon={<Sparkles size={13} />} />
        </div>

        <div className={styles.previewInsight}>
          <Layers3 size={16} aria-hidden="true" />
          <span>{template.whyItMatters}</span>
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}

function PreviewRail({
  title,
  items,
  icon,
}: {
  title: string
  items: OnboardingTemplate['workflows']
  template: OnboardingTemplate
  icon?: ReactNode
}) {
  return (
    <div className={styles.previewRail}>
      <div className={styles.previewRailLabel}>{title}</div>
      <div className={styles.previewRailItems}>
        {items.slice(0, 4).map((item) => (
          <span key={item}>
            {icon ?? <BadgeDollarSign size={13} aria-hidden="true" />}
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
