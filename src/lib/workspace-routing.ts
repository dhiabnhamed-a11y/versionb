import {
  isAgencyCompanyType,
  isEnterpriseOperationsCompanyType,
  isErpWorkspaceType,
  isHealthcareCompanyType,
  normalizeCompanyType,
  type CompanyType,
} from '@/lib/company-types'

export type WorkspaceSurface = 'standard' | 'agency' | 'enterprise' | 'healthcare' | 'erp' | 'ems'

export type WorkspaceModuleId =
  | 'overview'
  | 'projects'
  | 'tasks'
  | 'clients'
  | 'finance'
  | 'invoices'
  | 'calendar'
  | 'team'
  | 'alerts'
  | 'patients'
  | 'departments'
  | 'shifts'
  | 'emergency'
  | 'assets'
  | 'maintenance'
  | 'compliance'
  | 'operations'
  | 'requests'
  | 'socialAnalytics'
  | 'erpGeneralLedger'
  | 'erpAccountsReceivable'
  | 'erpAccountsPayable'
  | 'erpBudgets'
  | 'erpProcurement'
  | 'erpInventory'
  | 'erpHr'
  | 'erpReports'
  | 'erpSettings'
  // EMS modules
  | 'emsCommandCenter'
  | 'emsDispatch'
  | 'emsIncidents'
  | 'emsFleet'
  | 'emsUnits'
  | 'emsHospitals'
  | 'emsCrews'
  | 'emsAnalytics'
  | 'emsAutomation'
  | 'emsProtocols'

export type WorkspaceBlueprint = {
  companyType: CompanyType
  surface: WorkspaceSurface
  homePath: string
  shell: 'dashboard' | 'healthcare' | 'erp'
  modules: readonly WorkspaceModuleId[]
  aiContext: {
    persona: string
    priorities: readonly string[]
  }
}

export type WorkspaceIdentity = {
  role?: string | null
  companyType?: string | null
}

export type WorkspaceRouteRedirect = {
  destination: string
  reason: string
}

const MANAGER_ROLES = new Set(['OWNER', 'MANAGER'])

const STANDARD_MODULES = [
  'overview',
  'clients',
  'projects',
  'tasks',
  'invoices',
  'finance',
  'team',
  'calendar',
  'alerts',
] as const satisfies readonly WorkspaceModuleId[]

const ENTERPRISE_MODULES = [
  'overview',
  'operations',
  'departments',
  'requests',
  'assets',
  'maintenance',
  'compliance',
  'projects',
  'tasks',
  'invoices',
  'finance',
  'team',
  'calendar',
  'alerts',
] as const satisfies readonly WorkspaceModuleId[]

const HEALTHCARE_MODULES = [
  'overview',
  'patients',
  'departments',
  'shifts',
  'emergency',
  'assets',
  'maintenance',
  'compliance',
  'tasks',
  'invoices',
  'team',
  'calendar',
  'alerts',
] as const satisfies readonly WorkspaceModuleId[]

const ERP_MODULES = [
  'overview',
  'erpGeneralLedger',
  'erpAccountsReceivable',
  'erpAccountsPayable',
  'erpBudgets',
  'erpProcurement',
  'erpInventory',
  'erpHr',
  'erpReports',
  'erpSettings',
  'alerts',
] as const satisfies readonly WorkspaceModuleId[]

export const WORKSPACE_BLUEPRINTS = {
  INDUSTRY: {
    companyType: 'INDUSTRY',
    surface: 'standard',
    homePath: '/dashboard/admin',
    shell: 'dashboard',
    modules: STANDARD_MODULES,
    aiContext: {
      persona: 'Operations coordinator',
      priorities: ['site throughput', 'asset readiness', 'task execution', 'finance visibility'],
    },
  },
  DIGITAL_AGENCY: {
    companyType: 'DIGITAL_AGENCY',
    surface: 'agency',
    homePath: '/dashboard/admin',
    shell: 'dashboard',
    modules: ['overview', 'clients', 'projects', 'tasks', 'invoices', 'finance', 'team', 'calendar', 'alerts'],
    aiContext: {
      persona: 'Agency operations strategist',
      priorities: ['client health', 'campaign delivery', 'creative approvals', 'margin protection'],
    },
  },
  CONTENT_CREATION_AGENCY: {
    companyType: 'CONTENT_CREATION_AGENCY',
    surface: 'agency',
    homePath: '/dashboard/admin',
    shell: 'dashboard',
    modules: ['overview', 'socialAnalytics', 'clients', 'projects', 'tasks', 'invoices', 'team', 'calendar', 'alerts'],
    aiContext: {
      persona: 'Content studio operator',
      priorities: ['channel growth', 'release cadence', 'deliverable approvals', 'audience analytics'],
    },
  },
  HEALTHCARE: {
    companyType: 'HEALTHCARE',
    surface: 'healthcare',
    homePath: '/dashboard/admin',
    shell: 'healthcare',
    modules: HEALTHCARE_MODULES,
    aiContext: {
      persona: 'Healthcare operations commander',
      priorities: ['patient flow', 'biomedical uptime', 'compliance evidence', 'emergency response'],
    },
  },
  ENTERPRISE_OPERATIONS: {
    companyType: 'ENTERPRISE_OPERATIONS',
    surface: 'enterprise',
    homePath: '/dashboard/admin',
    shell: 'dashboard',
    modules: ENTERPRISE_MODULES,
    aiContext: {
      persona: 'Enterprise service operations analyst',
      priorities: ['SLA health', 'queue ownership', 'asset lifecycle', 'approval governance'],
    },
  },
  CLINIC_HOSPITAL: {
    companyType: 'CLINIC_HOSPITAL',
    surface: 'healthcare',
    homePath: '/dashboard/admin',
    shell: 'healthcare',
    modules: HEALTHCARE_MODULES,
    aiContext: {
      persona: 'Hospital command center analyst',
      priorities: ['clinical departments', 'shift coverage', 'facility incidents', 'regulatory readiness'],
    },
  },
  CORPORATE_IT_OPERATIONS: {
    companyType: 'CORPORATE_IT_OPERATIONS',
    surface: 'enterprise',
    homePath: '/dashboard/admin',
    shell: 'dashboard',
    modules: ENTERPRISE_MODULES,
    aiContext: {
      persona: 'IT service management analyst',
      priorities: ['incident response', 'endpoint lifecycle', 'change control', 'support queue health'],
    },
  },
  ERP_WORKSPACE: {
    companyType: 'ERP_WORKSPACE',
    surface: 'erp',
    homePath: '/erp',
    shell: 'erp',
    modules: ERP_MODULES,
    aiContext: {
      persona: 'ERP financial operations controller',
      priorities: ['ledger integrity', 'cash forecasting', 'procurement control', 'HR and payroll readiness'],
    },
  },
  EMS_AGENCY: {
    companyType: 'EMS_AGENCY',
    surface: 'ems',
    homePath: '/dashboard/admin/ems',
    shell: 'dashboard',
    modules: [
      'emsCommandCenter',
      'emsDispatch',
      'emsIncidents',
      'emsFleet',
      'emsUnits',
      'emsHospitals',
      'emsCrews',
      'emsAnalytics',
      'emsAutomation',
      'emsProtocols',
      'tasks',
      'calendar',
      'alerts',
    ],
    aiContext: {
      persona: 'EMS operations commander',
      priorities: ['emergency response time', 'unit availability', 'hospital coordination', 'crew readiness', 'incident resolution'],
    },
  },
  OTHER: {
    companyType: 'OTHER',
    surface: 'standard',
    homePath: '/dashboard/admin',
    shell: 'dashboard',
    modules: STANDARD_MODULES,
    aiContext: {
      persona: 'Workspace operations assistant',
      priorities: ['task clarity', 'team coordination', 'billing readiness', 'workspace health'],
    },
  },
} as const satisfies Record<CompanyType, WorkspaceBlueprint>

function normalizeWorkspaceRole(role?: string | null) {
  return role?.trim().toUpperCase() || 'EMPLOYEE'
}

export function getWorkspaceBlueprint(companyType?: string | null): WorkspaceBlueprint {
  return WORKSPACE_BLUEPRINTS[normalizeCompanyType(companyType)]
}

export function getWorkspaceHomePath(identity: WorkspaceIdentity) {
  const role = normalizeWorkspaceRole(identity.role)
  if (role === 'SUPER_ADMIN') return '/dashboard/super-admin'

  const companyType = normalizeCompanyType(identity.companyType)
  if (isErpWorkspaceType(companyType)) return WORKSPACE_BLUEPRINTS.ERP_WORKSPACE.homePath
  if (role === 'EMPLOYEE') return '/dashboard/employee'

  return getWorkspaceBlueprint(companyType).homePath
}

export function getWorkspaceProfilePath(identity: WorkspaceIdentity) {
  return isErpWorkspaceType(identity.companyType) ? '/erp/profile' : '/dashboard/profile'
}

export function getWorkspaceSettingsPath(identity: WorkspaceIdentity) {
  return isErpWorkspaceType(identity.companyType) ? '/erp/settings' : '/dashboard/settings'
}

export function getWorkspaceRouteRedirect(pathname: string, identity: WorkspaceIdentity): WorkspaceRouteRedirect | null {
  const role = normalizeWorkspaceRole(identity.role)
  const companyType = normalizeCompanyType(identity.companyType)
  const homePath = getWorkspaceHomePath({ role, companyType })

  if (pathname === '/dashboard') {
    return { destination: homePath, reason: 'workspace_home_resolution' }
  }

  if (role === 'SUPER_ADMIN') {
    if (pathname.startsWith('/erp') || pathname.startsWith('/dashboard/admin') || pathname.startsWith('/dashboard/employee')) {
      return { destination: '/dashboard/super-admin', reason: 'super_admin_console_required' }
    }

    return null
  }

  if (isErpWorkspaceType(companyType)) {
    if (pathname === '/dashboard/profile' || pathname.startsWith('/dashboard/profile/')) {
      return { destination: '/erp/profile', reason: 'erp_profile_shell_required' }
    }

    if (pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')) {
      return { destination: '/erp/settings', reason: 'erp_settings_shell_required' }
    }

    if (pathname.startsWith('/dashboard/admin') || pathname.startsWith('/dashboard/employee')) {
      return { destination: '/erp', reason: 'erp_workspace_requires_erp_shell' }
    }

    return null
  }

  if (pathname.startsWith('/erp')) {
    return { destination: homePath, reason: 'non_erp_workspace_cannot_use_erp_shell' }
  }

  if (role === 'EMPLOYEE' && pathname.startsWith('/dashboard/admin')) {
    return { destination: '/dashboard/employee', reason: 'employee_admin_surface_blocked' }
  }

  if (MANAGER_ROLES.has(role) && pathname.startsWith('/dashboard/employee')) {
    return { destination: '/dashboard/admin', reason: 'manager_employee_surface_blocked' }
  }

  return null
}

export function getWorkspaceApiAccessError(route: string, identity: WorkspaceIdentity) {
  const companyType = normalizeCompanyType(identity.companyType)

  if (route.startsWith('/api/v1/erp2') && !isErpWorkspaceType(companyType)) {
    return 'ERP APIs are only available inside ERP workspaces.'
  }

  if (route.startsWith('/api/enterprise') && !isEnterpriseOperationsCompanyType(companyType)) {
    return 'Enterprise operations APIs are only available for enterprise, healthcare, and IT operations workspaces.'
  }

  if ((route.startsWith('/api/admin/shifts') || route.startsWith('/api/admin/patients')) && !isHealthcareCompanyType(companyType)) {
    return 'Healthcare APIs are only available inside healthcare workspaces.'
  }

  return null
}

export function getWorkspaceAiContext(identity: WorkspaceIdentity) {
  return getWorkspaceBlueprint(identity.companyType).aiContext
}

export function isWorkspaceUsingDedicatedShell(companyType?: string | null) {
  const type = normalizeCompanyType(companyType)
  return isErpWorkspaceType(type) || isHealthcareCompanyType(type)
}

export function getWorkspaceSurface(companyType?: string | null): WorkspaceSurface {
  const type = normalizeCompanyType(companyType)
  if (isErpWorkspaceType(type)) return 'erp'
  if (isHealthcareCompanyType(type)) return 'healthcare'
  if (isEnterpriseOperationsCompanyType(type)) return 'enterprise'
  if (isAgencyCompanyType(type)) return 'agency'
  return 'standard'
}
