/**
 * Healthcare Operations Configuration
 * 
 * This module provides healthcare-native terminology and configuration
 * for TASKIT Healthcare, replacing generic CRM concepts with proper
 * healthcare operations terminology.
 */

export const HEALTHCARE_NAVIGATION = {
  // Main navigation items for healthcare workspace — operational platform structure
  mainNav: [
    {
      id: 'overview',
      label: 'Overview',
      href: '/dashboard/admin',
      icon: 'LayoutDashboard',
      section: 'operations',
      description: 'Executive dashboard and operational KPIs',
    },
    {
      id: 'patients',
      label: 'Patients',
      href: '/dashboard/admin/patients',
      icon: 'UserRound',
      section: 'operations',
      description: 'Patient records, admissions, and care coordination',
    },
    {
      id: 'departments',
      label: 'Departments',
      href: '/dashboard/admin/departments',
      icon: 'Building2',
      section: 'operations',
      description: 'Clinical departments and operational units',
    },
    {
      id: 'operations',
      label: 'Operations',
      href: '/dashboard/admin/operations',
      icon: 'Activity',
      section: 'operations',
      description: 'Enterprise operations center and incident command',
    },
    {
      id: 'assets',
      label: 'Assets',
      href: '/dashboard/admin/assets',
      icon: 'HeartPulse',
      section: 'management',
      description: 'Biomedical equipment lifecycle and asset intelligence',
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      href: '/dashboard/admin/maintenance',
      icon: 'Wrench',
      section: 'management',
      description: 'Preventive, corrective, and emergency maintenance',
    },
    {
      id: 'requests',
      label: 'Requests',
      href: '/dashboard/admin/requests',
      icon: 'ClipboardList',
      section: 'management',
      description: 'Operational requests and incident reports',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      href: '/dashboard/admin/tasks',
      icon: 'CheckSquare',
      section: 'management',
      description: 'Clinical work orders and task orchestration',
    },
    {
      id: 'shifts',
      label: 'Shifts',
      href: '/dashboard/admin/shifts',
      icon: 'Clock',
      section: 'workforce',
      description: 'Shift scheduling, on-call, and coverage',
    },
    {
      id: 'calendar',
      label: 'Calendar',
      href: '/dashboard/admin/calendar',
      icon: 'CalendarDays',
      section: 'workforce',
      description: 'Scheduling, appointments, and patient flow',
    },
    {
      id: 'team',
      label: 'Team',
      href: '/dashboard/admin/employees',
      icon: 'Users',
      section: 'workforce',
      description: 'Staff directory, roles, and assignments',
    },
    {
      id: 'compliance',
      label: 'Compliance',
      href: '/dashboard/admin/compliance',
      icon: 'ShieldCheck',
      section: 'governance',
      description: 'Audit trails, policies, and regulatory compliance',
    },
    {
      id: 'reports',
      label: 'Reports',
      href: '/dashboard/admin/reports',
      icon: 'BarChart3',
      section: 'governance',
      description: 'Analytics and operational reporting',
    },
    {
      id: 'emergency-center',
      label: 'Emergency Center',
      href: '/dashboard/admin/emergency-center',
      icon: 'Siren',
      section: 'governance',
      description: 'Critical alerts and emergency operations',
    },
    {
      id: 'billing',
      label: 'Subscription',
      href: '/billing',
      icon: 'CreditCard',
      section: 'governance',
      description: 'Manage your plan and billing',
    },
  ],

  // Section labels for sidebar grouping
  sections: {
    operations: 'Clinical Operations',
    management: 'Asset & Workflow',
    workforce: 'Workforce',
    governance: 'Governance',
  } as Record<string, string>,

  // Department types for healthcare organizations
  departmentTypes: [
    { id: 'emergency', name: 'Emergency Department', code: 'ED', category: 'clinical' },
    { id: 'icu', name: 'Intensive Care Unit', code: 'ICU', category: 'clinical' },
    { id: 'nicu', name: 'Neonatal ICU', code: 'NICU', category: 'clinical' },
    { id: 'radiology', name: 'Radiology', code: 'RAD', category: 'diagnostic' },
    { id: 'laboratory', name: 'Laboratory', code: 'LAB', category: 'diagnostic' },
    { id: 'pharmacy', name: 'Pharmacy', code: 'PHARM', category: 'clinical' },
    { id: 'surgery', name: 'Surgery', code: 'SURG', category: 'clinical' },
    { id: 'cardiology', name: 'Cardiology', code: 'CARD', category: 'clinical' },
    { id: 'oncology', name: 'Oncology', code: 'ONC', category: 'clinical' },
    { id: 'neurology', name: 'Neurology', code: 'NEUR', category: 'clinical' },
    { id: 'orthopedics', name: 'Orthopedics', code: 'ORTH', category: 'clinical' },
    { id: 'pediatrics', name: 'Pediatrics', code: 'PED', category: 'clinical' },
    { id: 'maternity', name: 'Maternity', code: 'MAT', category: 'clinical' },
    { id: 'psychiatry', name: 'Psychiatry', code: 'PSY', category: 'clinical' },
    { id: 'rehabilitation', name: 'Rehabilitation', code: 'REHAB', category: 'clinical' },
    { id: 'administration', name: 'Administration', code: 'ADMIN', category: 'administrative' },
    { id: 'finance', name: 'Finance', code: 'FIN', category: 'administrative' },
    { id: 'hr', name: 'Human Resources', code: 'HR', category: 'administrative' },
    { id: 'it', name: 'IT Services', code: 'IT', category: 'support' },
    { id: 'biomedical', name: 'Biomedical Engineering', code: 'BIOMED', category: 'support' },
    { id: 'facilities', name: 'Facilities Management', code: 'FAC', category: 'support' },
    { id: 'security', name: 'Security', code: 'SEC', category: 'support' },
    { id: 'housekeeping', name: 'Housekeeping', code: 'HK', category: 'support' },
    { id: 'nutrition', name: 'Nutrition Services', code: 'NUTR', category: 'support' }
  ],

  // Asset categories for biomedical equipment
  assetCategories: [
    { id: 'imaging', name: 'Imaging Systems', examples: ['MRI', 'CT Scanner', 'X-Ray', 'Ultrasound'] },
    { id: 'monitoring', name: 'Patient Monitors', examples: ['Vital Signs Monitor', 'Cardiac Monitor', 'Fetal Monitor'] },
    { id: 'life-support', name: 'Life Support', examples: ['Ventilator', 'Infusion Pump', 'Dialysis Machine'] },
    { id: 'surgical', name: 'Surgical Equipment', examples: ['Anesthesia Machine', 'Surgical Robot', 'Cautery Unit'] },
    { id: 'laboratory', name: 'Lab Equipment', examples: ['Centrifuge', 'Microscope', 'Analyzer'] },
    { id: 'therapy', name: 'Therapy Equipment', examples: ['Defibrillator', 'Pacemaker Programmer', 'TENS Unit'] },
    { id: 'facility', name: 'Facility Equipment', examples: ['Hospital Bed', 'Wheelchair', 'Stretcher'] },
    { id: 'it-equipment', name: 'IT Equipment', examples: ['Workstation', 'Server', 'Network Device'] }
  ],

  // Priority levels for healthcare operations
  priorityLevels: [
    { id: 'critical', name: 'Critical', color: '#dc2626', responseTime: 'Immediate', description: 'Life-threatening or system-critical' },
    { id: 'high', name: 'High', color: '#ea580c', responseTime: '15 minutes', description: 'Urgent clinical or operational impact' },
    { id: 'medium', name: 'Medium', color: '#eab308', responseTime: '2 hours', description: 'Important but not urgent' },
    { id: 'low', name: 'Low', color: '#22c55e', responseTime: '24 hours', description: 'Routine maintenance or requests' },
    { id: 'planned', name: 'Planned', color: '#3b82f6', responseTime: 'Scheduled', description: 'Scheduled or preventive work' }
  ],

  // Incident types for healthcare
  incidentTypes: [
    { id: 'equipment-failure', name: 'Equipment Failure', category: 'biomedical' },
    { id: 'system-down', name: 'System Down', category: 'it' },
    { id: 'safety-incident', name: 'Safety Incident', category: 'clinical' },
    { id: 'medication-error', name: 'Medication Error', category: 'clinical' },
    { id: 'patient-fall', name: 'Patient Fall', category: 'clinical' },
    { id: 'infection-control', name: 'Infection Control', category: 'clinical' },
    { id: 'facility-issue', name: 'Facility Issue', category: 'facilities' },
    { id: 'utility-failure', name: 'Utility Failure', category: 'facilities' },
    { id: 'security-breach', name: 'Security Breach', category: 'security' },
    { id: 'supply-shortage', name: 'Supply Shortage', category: 'procurement' },
    { id: 'staffing-issue', name: 'Staffing Issue', category: 'hr' },
    { id: 'compliance-violation', name: 'Compliance Violation', category: 'compliance' }
  ],

  // Status values for healthcare workflows
  statusValues: {
    patient: ['registered', 'admitted', 'in-treatment', 'discharged', 'transferred', 'deceased'],
    appointment: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
    asset: ['operational', 'maintenance', 'out-of-service', 'calibration', 'decommissioned'],
    workOrder: ['open', 'assigned', 'in-progress', 'pending-parts', 'completed', 'verified', 'closed'],
    incident: ['reported', 'triaged', 'investigating', 'escalated', 'resolved', 'closed'],
    claim: ['submitted', 'pending-review', 'approved', 'denied', 'appealed', 'paid'],
    procurement: ['requested', 'approved', 'ordered', 'received', 'inspected', 'stocked']
  },

  // Healthcare-specific metrics
  kpiDefinitions: {
    // Clinical KPIs
    'bed-occupancy': { name: 'Bed Occupancy Rate', unit: '%', target: 85, warning: 90 },
    'avg-length-stay': { name: 'Average Length of Stay', unit: 'days', target: 4.5, warning: 6 },
    'readmission-rate': { name: 'Readmission Rate', unit: '%', target: 10, warning: 15 },
    'mortality-rate': { name: 'Mortality Rate', unit: '%', target: 2, warning: 3 },
    'surgical-site-infection': { name: 'Surgical Site Infection Rate', unit: '%', target: 1, warning: 2 },
    
    // Operational KPIs
    'asset-uptime': { name: 'Asset Uptime', unit: '%', target: 95, warning: 90 },
    'maintenance-compliance': { name: 'Maintenance Compliance', unit: '%', target: 98, warning: 95 },
    'incident-response-time': { name: 'Incident Response Time', unit: 'minutes', target: 15, warning: 30 },
    'staff-patient-ratio': { name: 'Staff-Patient Ratio', unit: 'ratio', target: 0.3, warning: 0.2 },
    
    // Financial KPIs
    'claim-denial-rate': { name: 'Claim Denial Rate', unit: '%', target: 5, warning: 10 },
    'avg-claim-processing': { name: 'Avg Claim Processing Time', unit: 'days', target: 14, warning: 21 },
    'cost-per-patient-day': { name: 'Cost Per Patient Day', unit: 'QAR', target: 2500, warning: 3000 },
    
    // Compliance KPIs
    'audit-compliance': { name: 'Audit Compliance', unit: '%', target: 100, warning: 95 },
    'training-compliance': { name: 'Training Compliance', unit: '%', target: 100, warning: 95 },
    'documentation-compliance': { name: 'Documentation Compliance', unit: '%', target: 98, warning: 95 }
  },

  // Emergency code types (standardized)
  emergencyCodes: [
    { code: 'Code Blue', name: 'Cardiac Arrest', color: 'blue', priority: 'critical' },
    { code: 'Code Red', name: 'Fire', color: 'red', priority: 'critical' },
    { code: 'Code Pink', name: 'Infant Abduction', color: 'pink', priority: 'critical' },
    { code: 'Code Silver', name: 'Active Shooter', color: 'silver', priority: 'critical' },
    { code: 'Code Orange', name: 'Hazardous Spill', color: 'orange', priority: 'high' },
    { code: 'Code Yellow', name: 'Missing Patient', color: 'yellow', priority: 'high' },
    { code: 'Code Green', name: 'Evacuation', color: 'green', priority: 'high' },
    { code: 'Code White', name: 'Violent Person', color: 'white', priority: 'high' },
    { code: 'Code Black', name: 'Bomb Threat', color: 'black', priority: 'critical' },
    { code: 'Code Gray', name: 'Security Threat', color: 'gray', priority: 'high' }
  ]
} as const

// Healthcare-specific terminology mappings
export const HEALTHCARE_TERMINOLOGY = {
  // Replace CRM terms with healthcare terms
  replacements: {
    'client': 'patient',
    'clients': 'patients',
    'project': 'department',
    'projects': 'departments',
    'task': 'work order',
    'tasks': 'work orders',
    'campaign': 'clinical program',
    'campaigns': 'clinical programs',
    'brief': 'medical order',
    'briefs': 'medical orders',
    'deliverable': 'treatment outcome',
    'deliverables': 'treatment outcomes',
    'invoice': 'patient bill',
    'invoices': 'patient bills',
    'finance': 'revenue cycle',
    'alert': 'clinical alert',
    'alerts': 'clinical alerts',
    'send alert': 'emergency broadcast',
    'team': 'clinical team',
    'teams': 'clinical teams',
    'employee': 'staff member',
    'employees': 'staff members',
    'workspace': 'hospital workspace',
    'company': 'healthcare organization'
  }
} as const

// Qatar/Gulf healthcare specific configurations
export const QATAR_HEALTHCARE_CONFIG = {
  // Arabic translations for key terms
  arabicTerms: {
    'patients': 'المرضى',
    'departments': 'الأقسام',
    'appointments': 'المواعيد',
    'emergency': 'الطوارئ',
    'assets': 'الأصول',
    'inventory': 'المخزون',
    'billing': 'الفواتير',
    'compliance': 'الامتثال',
    'reports': 'التقارير'
  },

  // Qatar healthcare regulations
  regulations: [
    'Qatar National Health Strategy',
    'JCI Accreditation Standards',
    'Qatar Council for Healthcare Practitioners',
    'Ministry of Public Health Regulations',
    'Hamad Medical Corporation Standards'
  ],

  // Common insurance providers in Qatar
  insuranceProviders: [
    'Qatar General Insurance',
    'International Insurance Company',
    'Al Wakra Insurance',
    'Doha Insurance Group',
    'Qatar Insurance Company',
    'MetLife Qatar',
    'AXA Gulf',
    'Bupa Arabia',
    'Tawuniya',
    'MedGulf'
  ]
} as const

export type HealthcareNavigationId = typeof HEALTHCARE_NAVIGATION.mainNav[number]['id']
export type PriorityLevel = typeof HEALTHCARE_NAVIGATION.priorityLevels[number]['id']
export type IncidentType = typeof HEALTHCARE_NAVIGATION.incidentTypes[number]['id']