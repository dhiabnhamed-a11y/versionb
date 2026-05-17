import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  FolderKanban,
  HeartPulse,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
  Stethoscope,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import type { CompanyType } from '@/lib/company-types'
import type { TranslationKey } from '@/lib/i18n'

export type WorkspaceNavItem = {
  href: string
  /** Optional i18n key. If omitted, `label` is used as a literal. */
  labelKey?: TranslationKey
  label?: string
  icon: LucideIcon
}

export type WorkspaceNavContext = {
  companyType: CompanyType
  /** Translated copy used for INDUSTRY's "Rooms & Projects" entry. */
  industryProjectsLabel: string
}

/**
 * Each workspace type sees only the modules its real-world role uses.
 * Generic items (projects, tasks, invoices, finance, calendar) are included
 * only where they meaningfully apply to that workspace's work style.
 */
export function getWorkspaceNav(ctx: WorkspaceNavContext): WorkspaceNavItem[] {
  const { companyType, industryProjectsLabel } = ctx

  const overview: WorkspaceNavItem = {
    href: '/dashboard/admin',
    labelKey: 'nav.overview',
    icon: LayoutDashboard,
  }
  const clients: WorkspaceNavItem = { href: '/dashboard/admin/clients', labelKey: 'nav.clients', icon: Building2 }
  const invoices: WorkspaceNavItem = { href: '/dashboard/admin/invoices', labelKey: 'nav.invoices', icon: ReceiptText }
  const finance: WorkspaceNavItem = { href: '/dashboard/admin/finance', labelKey: 'nav.finance', icon: Landmark }
  const calendar: WorkspaceNavItem = { href: '/dashboard/admin/calendar', labelKey: 'nav.calendar', icon: CalendarDays }
  const team: WorkspaceNavItem = { href: '/dashboard/admin/employees', labelKey: 'nav.team', icon: Users }
  const alerts: WorkspaceNavItem = { href: '/dashboard/admin/alerts', labelKey: 'nav.sendAlert', icon: Bell }
  const projects: WorkspaceNavItem = { href: '/dashboard/admin/projects', labelKey: 'nav.projects', icon: FolderKanban }
  const tasks: WorkspaceNavItem = { href: '/dashboard/admin/tasks', labelKey: 'nav.tasks', icon: CheckSquare }
  const campaigns: WorkspaceNavItem = { href: '/dashboard/admin/projects', labelKey: 'nav.campaigns', icon: FolderKanban }
  const briefs: WorkspaceNavItem = { href: '/dashboard/admin/tasks', labelKey: 'nav.briefs', icon: CheckSquare }

  // Healthcare-specific modules (pages exist under /dashboard/admin/...)
  const patients: WorkspaceNavItem = { href: '/dashboard/admin/patients', label: 'Patients', icon: Stethoscope }
  const departments: WorkspaceNavItem = { href: '/dashboard/admin/departments', label: 'Departments', icon: Building2 }
  const shifts: WorkspaceNavItem = { href: '/dashboard/admin/shifts', label: 'Shifts', icon: CalendarDays }
  const emergency: WorkspaceNavItem = { href: '/dashboard/admin/emergency-center', label: 'Emergency Center', icon: AlertTriangle }
  const compliance: WorkspaceNavItem = { href: '/dashboard/admin/compliance', label: 'Compliance', icon: ShieldCheck }
  const maintenance: WorkspaceNavItem = { href: '/dashboard/admin/maintenance', label: 'Maintenance', icon: Wrench }
  const assets: WorkspaceNavItem = { href: '/dashboard/admin/assets', label: 'Assets', icon: Truck }
  const operations: WorkspaceNavItem = { href: '/dashboard/admin/operations', label: 'Operations', icon: HeartPulse }
  const requests: WorkspaceNavItem = { href: '/dashboard/admin/requests', label: 'Service Requests', icon: ClipboardCheck }
  const socialAnalytics: WorkspaceNavItem = {
    href: '/dashboard/admin/social-analytics',
    labelKey: 'nav.socialStats',
    icon: BarChart3,
  }

  switch (companyType) {
    case 'HEALTHCARE':
    case 'CLINIC_HOSPITAL':
      return [
        overview,
        patients,
        departments,
        shifts,
        emergency,
        assets,
        maintenance,
        compliance,
        tasks,
        invoices,
        team,
        calendar,
        alerts,
      ]

    case 'CORPORATE_IT_OPERATIONS':
      return [
        overview,
        operations,
        requests,
        assets,
        maintenance,
        compliance,
        projects,
        tasks,
        team,
        calendar,
        alerts,
      ]

    case 'ENTERPRISE_OPERATIONS':
      return [
        overview,
        operations,
        departments,
        requests,
        assets,
        maintenance,
        compliance,
        projects,
        tasks,
        invoices,
        finance,
        team,
        calendar,
        alerts,
      ]

    case 'INDUSTRY':
      return [
        overview,
        clients,
        { href: '/dashboard/admin/projects', label: industryProjectsLabel, icon: FolderKanban },
        tasks,
        assets,
        maintenance,
        invoices,
        finance,
        team,
        calendar,
        alerts,
      ]

    case 'DIGITAL_AGENCY':
      return [overview, clients, campaigns, briefs, invoices, finance, team, calendar, alerts]

    case 'CONTENT_CREATION_AGENCY':
      return [overview, socialAnalytics, clients, campaigns, briefs, invoices, team, calendar, alerts]

    case 'OTHER':
    default:
      return [overview, clients, projects, tasks, invoices, finance, team, calendar, alerts]
  }
}
