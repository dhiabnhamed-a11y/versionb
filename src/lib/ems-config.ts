export const EMS_NAVIGATION = {
  mainNav: [
    {
      id: 'command-center',
      label: 'Command Center',
      href: '/dashboard/admin/ems',
      icon: 'Satellite',
      section: 'operations',
      description: 'Mission control dashboard with live map, unit tracking, incident queue',
    },
    {
      id: 'dispatch',
      label: 'Smart Dispatch',
      href: '/dashboard/admin/ems/dispatch',
      icon: 'Radio',
      section: 'operations',
      description: 'AI-assisted dispatch console and resource management',
    },
    {
      id: 'incidents',
      label: 'Incidents',
      href: '/dashboard/admin/ems/incidents',
      icon: 'AlertTriangle',
      section: 'operations',
      description: 'Active and historical incident management',
    },
    {
      id: 'fleet',
      label: 'Fleet',
      href: '/dashboard/admin/ems/fleet',
      icon: 'Truck',
      section: 'fleet',
      description: 'Ambulance fleet tracking, maintenance, and status',
    },
    {
      id: 'units',
      label: 'Units',
      href: '/dashboard/admin/ems/units',
      icon: 'ShieldCheck',
      section: 'fleet',
      description: 'Unit inventory, equipment, and crew assignments',
    },
    {
      id: 'hospitals',
      label: 'Hospitals',
      href: '/dashboard/admin/ems/hospitals',
      icon: 'Building2',
      section: 'coordination',
      description: 'Hospital capacities, capabilities, and diversion status',
    },
    {
      id: 'crews',
      label: 'Crews',
      href: '/dashboard/admin/ems/crews',
      icon: 'Users',
      section: 'workforce',
      description: 'Personnel management, certifications, and fatigue tracking',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      href: '/dashboard/admin/ems/analytics',
      icon: 'BarChart3',
      section: 'intelligence',
      description: 'Performance metrics, predictive analytics, and reporting',
    },
    {
      id: 'automation',
      label: 'Automations',
      href: '/dashboard/admin/ems/automation',
      icon: 'Workflow',
      section: 'intelligence',
      description: 'Workflow builder and automation rules engine',
    },
    {
      id: 'protocols',
      label: 'Protocols',
      href: '/dashboard/admin/ems/protocols',
      icon: 'FileText',
      section: 'governance',
      description: 'Medical protocols, SOPs, and compliance',
    },
    {
      id: 'settings',
      label: 'EMS Settings',
      href: '/dashboard/admin/ems/settings',
      icon: 'Settings',
      section: 'governance',
      description: 'System configuration and workspace preferences',
    },
  ] as const,

  emergencyNav: [
    { id: 'mci', label: 'MCI Mode', icon: 'Siren', color: '#dc2626' },
    { id: 'disaster', label: 'Disaster Ops', icon: 'Radiation', color: '#ea580c' },
    { id: 'lockdown', label: 'Lockdown', icon: 'Lock', color: '#d97706' },
  ] as const,
}

export const EMS_REALTIME_EVENTS = {
  INCIDENT_CREATED: 'ems:incident:created',
  INCIDENT_UPDATED: 'ems:incident:updated',
  INCIDENT_STATUS_CHANGED: 'ems:incident:status_changed',
  UNIT_POSITION_UPDATED: 'ems:unit:position',
  UNIT_STATUS_CHANGED: 'ems:unit:status',
  UNIT_ASSIGNED: 'ems:unit:assigned',
  CREW_NOTIFIED: 'ems:crew:notified',
  HOSPITAL_STATUS_CHANGED: 'ems:hospital:status',
  HOSPITAL_ALERT: 'ems:hospital:alert',
  DISPATCH_DECISION: 'ems:dispatch:decision',
  AI_INSIGHT: 'ems:ai:insight',
  PREDICTIVE_ALERT: 'ems:predictive:alert',
  MCI_DECLARED: 'ems:mci:declared',
  SYSTEM_ALERT: 'ems:system:alert',
  WORKFLOW_TRIGGERED: 'ems:workflow:triggered',
  SYNC_REQUEST: 'ems:sync:request',
  SYNC_COMPLETE: 'ems:sync:complete',
} as const

export const EMS_SEVERITY_COLORS: Record<string, string> = {
  ALPHA: '#22c55e',
  BRAVO: '#eab308',
  CHARLIE: '#f97316',
  DELTA: '#ef4444',
  ECHO: '#dc2626',
  OMEGA: '#7c3aed',
}

export const EMS_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#22c55e',
  DISPATCHED: '#3b82f6',
  EN_ROUTE: '#f97316',
  ON_SCENE: '#ef4444',
  TRANSPORTING: '#eab308',
  AT_HOSPITAL: '#8b5cf6',
  DECONTAMINATION: '#06b6d4',
  MAINTENANCE: '#6b7280',
  OFFLINE: '#374151',
  RESERVE: '#9ca3af',
}

export const EMS_UNIT_TYPE_META: Record<string, { label: string; icon: string }> = {
  AMBULANCE: { label: 'Ambulance', icon: 'Truck' },
  ALS_AMBULANCE: { label: 'ALS Ambulance', icon: 'HeartPulse' },
  BLS_AMBULANCE: { label: 'BLS Ambulance', icon: 'Ambulance' },
  MICU: { label: 'Mobile ICU', icon: 'Monitor' },
  RESPONSE_VEHICLE: { label: 'Response Vehicle', icon: 'Gauge' },
  AIR_AMBULANCE: { label: 'Air Ambulance', icon: 'Helicopter' },
  SUPERVISOR: { label: 'Supervisor', icon: 'UserCog' },
  MASS_CASUALTY_BUS: { label: 'MCI Bus', icon: 'Bus' },
  REHAB_UNIT: { label: 'Rehab Unit', icon: 'Sofa' },
  COMMAND_VEHICLE: { label: 'Command Vehicle', icon: 'Radio' },
  MOTORCYCLE_RESPONSE: { label: 'Motorcycle Response', icon: 'Bike' },
}

export const SEVERITY_WEIGHTS: Record<string, number> = {
  ALPHA: 1,
  BRAVO: 2,
  CHARLIE: 3,
  DELTA: 4,
  ECHO: 5,
  OMEGA: 10,
}

export const RESPONSE_TIME_TARGETS = {
  ALPHA: 600,
  BRAVO: 480,
  CHARLIE: 360,
  DELTA: 240,
  ECHO: 180,
  OMEGA: 120,
}
