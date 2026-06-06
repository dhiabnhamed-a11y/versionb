'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Command,
  CreditCard,
  DatabaseZap,
  Download,
  Factory,
  FileSpreadsheet,
  FileText,
  Filter,
  Gauge,
  Globe2,
  Handshake,
  HardHat,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Moon,
  MoreHorizontal,
  Network,
  Package,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Sun,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  WalletCards,
  Warehouse,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type ModuleKey =
  | 'dashboard'
  | 'analytics'
  | 'ai'
  | 'finance'
  | 'ledger'
  | 'hr'
  | 'inventory'
  | 'sales'
  | 'payroll'
  | 'procurement'
  | 'manufacturing'
  | 'crm'
  | 'projects'
  | 'reports'
  | 'admin'
type SortDirection = 'asc' | 'desc'

type NavItem = {
  key: ModuleKey
  label: string
  icon: LucideIcon
}

type NavGroup = {
  title: string
  items: NavItem[]
}

type Kpi = {
  label: string
  target: number
  prefix?: string
  suffix?: string
  delta: number
  icon: LucideIcon
  tone: string
}

type Transaction = {
  id: string
  date: string
  entity: string
  type: string
  amount: number
  status: 'Posted' | 'Pending' | 'Review' | 'Failed'
}

type Product = {
  sku: string
  product: string
  units: number
  revenue: number
  margin: number
  trend: number
}

type InventoryItem = {
  sku: string
  product: string
  category: string
  warehouse: string
  quantity: number
  reorder: number
  supplier: string
  status: 'IN STOCK' | 'LOW' | 'OUT' | 'REORDER'
}

type Employee = {
  name: string
  title: string
  department: string
  location: string
  status: 'Active' | 'On Leave' | 'Remote'
  initials: string
}

type Deal = {
  company: string
  value: number
  rep: string
  probability: number
  closeDate: string
  stage: 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED'
}

type PayrollRow = {
  id: string
  employee: string
  department: string
  gross: number
  deductions: number
  net: number
  status: 'Ready' | 'Review' | 'Hold'
}

type AppState = {
  activeModule: ModuleKey
  sidebarCollapsed: boolean
  theme: 'dark' | 'light'
  activeCompany: { id: number; name: string; currency: string; flag: string }
  activeFiscalYear: string
  activeCurrency: string
  activeLanguage: string
  notifications: { title: string; category: string; time: string }[]
  currentUser: { name: string; role: string; avatar: string }
  searchOpen: boolean
  quickAddOpen: boolean
  notificationDrawerOpen: boolean
  sidebarQuery: string
  openGroups: Record<string, boolean>
}

const companies = [
  { id: 1, name: 'Nexus Global Holdings', currency: 'USD', flag: 'US' },
  { id: 2, name: 'Nexus Americas Inc.', currency: 'USD', flag: 'US' },
  { id: 3, name: 'Nexus Europe GmbH', currency: 'EUR', flag: 'DE' },
  { id: 4, name: 'Nexus MENA FZCO', currency: 'SAR', flag: 'AE' },
  { id: 5, name: 'Nexus Asia Pacific', currency: 'CNY', flag: 'CN' },
]

const initialAppState: AppState = {
  activeModule: 'dashboard',
  sidebarCollapsed: false,
  theme: 'dark',
  activeCompany: companies[0],
  activeFiscalYear: 'FY2026',
  activeCurrency: 'USD',
  activeLanguage: 'EN',
  notifications: [
    { title: 'Treasury approval blocked', category: 'Finance', time: '2m ago' },
    { title: 'Payroll batch requires review', category: 'HR', time: '9m ago' },
    { title: 'Low stock risk in Rotterdam', category: 'Operations', time: '18m ago' },
  ],
  currentUser: { name: 'Amina Rahman', role: 'Super Admin', avatar: 'AR' },
  searchOpen: false,
  quickAddOpen: false,
  notificationDrawerOpen: false,
  sidebarQuery: '',
  openGroups: {
    'Command Center': true,
    'Finance & Accounting': true,
    'Human Capital Management': true,
    'Supply Chain & Inventory': true,
    'Sales & CRM': true,
    Manufacturing: true,
    'Project Management': true,
    'Reports & BI': true,
    Administration: true,
  },
}

const navGroups: NavGroup[] = [
  {
    title: 'Command Center',
    items: [
      { key: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
      { key: 'analytics', label: 'Real-Time Analytics', icon: BarChart3 },
      { key: 'ai', label: 'AI Insights & Forecasting', icon: BrainCircuit },
    ],
  },
  {
    title: 'Finance & Accounting',
    items: [
      { key: 'ledger', label: 'General Ledger', icon: BookOpen },
      { key: 'finance', label: 'Accounts Payable / Receivable', icon: ReceiptText },
      { key: 'finance', label: 'Budget Planning & Variance', icon: WalletCards },
      { key: 'finance', label: 'Tax & Compliance', icon: ShieldCheck },
      { key: 'finance', label: 'Multi-Currency Management', icon: Globe2 },
      { key: 'finance', label: 'Cash Flow Management', icon: Banknote },
    ],
  },
  {
    title: 'Human Capital Management',
    items: [
      { key: 'hr', label: 'Employee Directory', icon: Users },
      { key: 'payroll', label: 'Payroll Processing', icon: Banknote },
      { key: 'hr', label: 'Recruitment Pipeline', icon: UserPlus },
      { key: 'hr', label: 'Performance Reviews', icon: ClipboardCheck },
      { key: 'payroll', label: 'Time & Attendance', icon: CalendarClock },
      { key: 'hr', label: 'Training & Development', icon: BadgeCheck },
    ],
  },
  {
    title: 'Supply Chain & Inventory',
    items: [
      { key: 'inventory', label: 'Inventory Dashboard', icon: Package },
      { key: 'procurement', label: 'Purchase Orders', icon: ShoppingCart },
      { key: 'procurement', label: 'Supplier Management', icon: Handshake },
      { key: 'inventory', label: 'Warehouse Management', icon: Warehouse },
      { key: 'procurement', label: 'Logistics & Tracking', icon: Truck },
      { key: 'inventory', label: 'Demand Forecasting', icon: BrainCircuit },
    ],
  },
  {
    title: 'Sales & CRM',
    items: [
      { key: 'sales', label: 'Sales Pipeline', icon: BriefcaseBusiness },
      { key: 'crm', label: 'Customer 360 View', icon: UserCheck },
      { key: 'sales', label: 'Quotes & Invoicing', icon: FileText },
      { key: 'crm', label: 'Contract Management', icon: LockKeyhole },
      { key: 'crm', label: 'Lead Management', icon: UserPlus },
    ],
  },
  {
    title: 'Manufacturing',
    items: [
      { key: 'manufacturing', label: 'Production Orders', icon: Factory },
      { key: 'manufacturing', label: 'Bill of Materials', icon: Boxes },
      { key: 'manufacturing', label: 'Quality Control', icon: BadgeCheck },
      { key: 'manufacturing', label: 'Plant Maintenance', icon: HardHat },
      { key: 'manufacturing', label: 'Capacity Planning', icon: Gauge },
    ],
  },
  {
    title: 'Project Management',
    items: [
      { key: 'projects', label: 'Project Dashboard', icon: LayoutDashboard },
      { key: 'projects', label: 'Task Board', icon: ClipboardCheck },
      { key: 'projects', label: 'Resource Allocation', icon: Users },
      { key: 'projects', label: 'Milestones & Gantt', icon: CalendarClock },
      { key: 'projects', label: 'Time Tracking', icon: Clock3 },
    ],
  },
  {
    title: 'Reports & BI',
    items: [
      { key: 'reports', label: 'Standard Reports', icon: FileText },
      { key: 'reports', label: 'Custom Report Builder', icon: Settings },
      { key: 'reports', label: 'KPI Builder', icon: Gauge },
      { key: 'reports', label: 'Export Center', icon: Download },
    ],
  },
  {
    title: 'Administration',
    items: [
      { key: 'admin', label: 'User & Role Management', icon: ShieldCheck },
      { key: 'admin', label: 'Audit Logs', icon: Activity },
      { key: 'admin', label: 'System Configuration', icon: Settings },
      { key: 'admin', label: 'API Integrations', icon: Network },
      { key: 'admin', label: 'Security & Compliance', icon: LockKeyhole },
      { key: 'admin', label: 'Multi-Company Settings', icon: Building2 },
    ],
  },
]

const kpis: Kpi[] = [
  { label: 'Total Revenue YTD', target: 48700000, prefix: '$', delta: 12.4, icon: CircleDollarSign, tone: 'from-emerald-400/25 to-cyan-400/10' },
  { label: 'Operating Profit', target: 9200000, prefix: '$', delta: 8.1, icon: Gauge, tone: 'from-amber-300/25 to-emerald-400/10' },
  { label: 'Active Employees', target: 3847, delta: 2.3, icon: Users, tone: 'from-cyan-300/25 to-blue-500/10' },
  { label: 'Open Purchase Orders', target: 1204, delta: -3.1, icon: ShoppingCart, tone: 'from-rose-300/25 to-amber-300/10' },
  { label: 'Inventory Value', target: 22100000, prefix: '$', delta: 5.7, icon: Boxes, tone: 'from-violet-300/25 to-cyan-300/10' },
  { label: 'Customer Satisfaction', target: 94.2, suffix: '%', delta: 1.2, icon: Sparkles, tone: 'from-sky-300/25 to-emerald-300/10' },
]

const revenueBudget = [
  { month: 'Jan', revenue: 3.2, budget: 3.0 },
  { month: 'Feb', revenue: 3.5, budget: 3.2 },
  { month: 'Mar', revenue: 3.9, budget: 3.4 },
  { month: 'Apr', revenue: 4.1, budget: 3.8 },
  { month: 'May', revenue: 4.4, budget: 4.0 },
  { month: 'Jun', revenue: 4.8, budget: 4.3 },
  { month: 'Jul', revenue: 4.7, budget: 4.5 },
  { month: 'Aug', revenue: 5.2, budget: 4.7 },
  { month: 'Sep', revenue: 5.6, budget: 5.0 },
  { month: 'Oct', revenue: 5.9, budget: 5.2 },
  { month: 'Nov', revenue: 6.1, budget: 5.5 },
  { month: 'Dec', revenue: 6.4, budget: 5.9 },
]

const departmentCosts = [
  { name: 'Operations', value: 31, color: '#00d4ff' },
  { name: 'Engineering', value: 24, color: '#c9a84c' },
  { name: 'Sales', value: 18, color: '#34d399' },
  { name: 'Finance', value: 14, color: '#a78bfa' },
  { name: 'Admin', value: 13, color: '#fb7185' },
]

const cashFlow = [
  { month: 'Jan', actual: 2.1, forecast: 2.2 },
  { month: 'Feb', actual: 2.4, forecast: 2.5 },
  { month: 'Mar', actual: 2.7, forecast: 2.9 },
  { month: 'Apr', actual: 3.0, forecast: 3.2 },
  { month: 'May', actual: 3.4, forecast: 3.5 },
  { month: 'Jun', actual: 3.8, forecast: 3.9 },
  { month: 'Jul', actual: 4.2, forecast: 4.4 },
  { month: 'Aug', actual: 4.5, forecast: 4.8 },
]

const transactions: Transaction[] = [
  { id: 'TX-10482', date: '2026-06-06', entity: 'HelioGrid Energy', type: 'Invoice', amount: 428900, status: 'Posted' },
  { id: 'TX-10481', date: '2026-06-06', entity: 'Nexus Europe GmbH', type: 'Intercompany', amount: 186400, status: 'Pending' },
  { id: 'TX-10480', date: '2026-06-05', entity: 'Atlas Medical Group', type: 'Payment', amount: 74200, status: 'Posted' },
  { id: 'TX-10479', date: '2026-06-05', entity: 'Blueforge Logistics', type: 'Purchase Order', amount: 310500, status: 'Review' },
  { id: 'TX-10478', date: '2026-06-04', entity: 'Crown Creative Studio', type: 'Expense', amount: 28400, status: 'Posted' },
  { id: 'TX-10477', date: '2026-06-04', entity: 'Solara Manufacturing', type: 'Invoice', amount: 612900, status: 'Posted' },
  { id: 'TX-10476', date: '2026-06-03', entity: 'Meridian Retail', type: 'Refund', amount: 9400, status: 'Failed' },
  { id: 'TX-10475', date: '2026-06-03', entity: 'Vector Cloud Services', type: 'Subscription', amount: 88200, status: 'Posted' },
  { id: 'TX-10474', date: '2026-06-02', entity: 'Apex Health Systems', type: 'Payment', amount: 232700, status: 'Pending' },
  { id: 'TX-10473', date: '2026-06-02', entity: 'Northstar Media', type: 'Invoice', amount: 121900, status: 'Posted' },
]

const products: Product[] = [
  { sku: 'NX-EDGE-900', product: 'Edge Gateway Pro', units: 18420, revenue: 5900000, margin: 41.2, trend: 12 },
  { sku: 'NX-OPS-AI', product: 'AI Operations License', units: 12880, revenue: 4800000, margin: 74.5, trend: 18 },
  { sku: 'NX-BIO-7', product: 'Biomedical Sensor Kit', units: 9100, revenue: 3400000, margin: 37.8, trend: 7 },
  { sku: 'NX-FIN-SUITE', product: 'Finance Automation Pack', units: 7360, revenue: 3100000, margin: 68.1, trend: 14 },
  { sku: 'NX-PORTAL', product: 'Customer Portal Seat', units: 22300, revenue: 2600000, margin: 81.4, trend: 9 },
]

const alerts = [
  { severity: 'Critical', title: 'Treasury approval blocked', detail: '$1.2M wire exceeds dual-control threshold', tone: 'border-red-400/60 bg-red-500/10 text-red-100' },
  { severity: 'High', title: 'Low stock risk', detail: '22 SKUs will hit reorder point within 72 hours', tone: 'border-amber-300/60 bg-amber-400/10 text-amber-50' },
  { severity: 'Medium', title: 'SLA warning', detail: 'APAC logistics ticket is 18 minutes from breach', tone: 'border-cyan-300/60 bg-cyan-400/10 text-cyan-50' },
]

const inventory: InventoryItem[] = [
  { sku: 'RAW-AL-882', product: 'Aerospace Aluminum Coil', category: 'Raw Materials', warehouse: 'Detroit W3', quantity: 12880, reorder: 5000, supplier: 'Titan Metals', status: 'IN STOCK' },
  { sku: 'MED-SEN-431', product: 'Sterile Monitoring Sensor', category: 'Medical', warehouse: 'Riyadh H1', quantity: 820, reorder: 1200, supplier: 'Apex BioSystems', status: 'LOW' },
  { sku: 'PKG-THERM-12', product: 'Thermal Export Packaging', category: 'Packaging', warehouse: 'Rotterdam E2', quantity: 0, reorder: 2200, supplier: 'PolarPack BV', status: 'OUT' },
  { sku: 'CHP-IOT-77', product: 'IoT Control Chipset', category: 'Electronics', warehouse: 'Shenzhen S4', quantity: 3180, reorder: 3600, supplier: 'NeoCircuit', status: 'REORDER' },
  { sku: 'KIT-FIELD-8', product: 'Field Service Repair Kit', category: 'Service', warehouse: 'Austin A1', quantity: 6940, reorder: 2400, supplier: 'Blueforge Supply', status: 'IN STOCK' },
]

const stockTrend = Array.from({ length: 30 }, (_, index) => ({
  day: `${index + 1}`,
  stock: 8200 + Math.round(Math.sin(index / 3) * 900) - index * 62 + (index % 5) * 140,
}))

const employees: Employee[] = [
  { name: 'Maya Chen', title: 'VP Global Operations', department: 'Operations', location: 'Singapore', status: 'Active', initials: 'MC' },
  { name: 'Omar Haddad', title: 'Finance Controller', department: 'Finance', location: 'Dubai', status: 'Active', initials: 'OH' },
  { name: 'Elena Petrova', title: 'Procurement Lead', department: 'Supply Chain', location: 'Berlin', status: 'Remote', initials: 'EP' },
  { name: 'Jon Bell', title: 'Plant Maintenance Manager', department: 'Manufacturing', location: 'Detroit', status: 'Active', initials: 'JB' },
  { name: 'Sara Mitchell', title: 'Healthcare Compliance Director', department: 'Compliance', location: 'London', status: 'On Leave', initials: 'SM' },
  { name: 'Youssef Nouri', title: 'AI Workflow Architect', department: 'Technology', location: 'Tunis', status: 'Remote', initials: 'YN' },
]

const deals: Deal[] = [
  { company: 'Aster Health Network', value: 980000, rep: 'N. Karim', probability: 35, closeDate: '2026-07-12', stage: 'LEAD' },
  { company: 'Crown Creative Holdings', value: 420000, rep: 'L. Mason', probability: 45, closeDate: '2026-06-28', stage: 'QUALIFIED' },
  { company: 'HelioGrid Utilities', value: 1350000, rep: 'M. Chen', probability: 58, closeDate: '2026-08-05', stage: 'PROPOSAL' },
  { company: 'Northstar Media Group', value: 610000, rep: 'A. Rivera', probability: 72, closeDate: '2026-06-24', stage: 'NEGOTIATION' },
  { company: 'Solara Manufacturing', value: 2400000, rep: 'D. Okafor', probability: 92, closeDate: '2026-06-18', stage: 'CLOSED' },
  { company: 'Blueforge Logistics', value: 760000, rep: 'N. Karim', probability: 63, closeDate: '2026-07-02', stage: 'PROPOSAL' },
  { company: 'Meridian Retail', value: 360000, rep: 'L. Mason', probability: 81, closeDate: '2026-06-21', stage: 'NEGOTIATION' },
]

const payrollRows: PayrollRow[] = [
  { id: 'PR-8101', employee: 'Maya Chen', department: 'Operations', gross: 18400, deductions: 4210, net: 14190, status: 'Ready' },
  { id: 'PR-8102', employee: 'Omar Haddad', department: 'Finance', gross: 14600, deductions: 3220, net: 11380, status: 'Ready' },
  { id: 'PR-8103', employee: 'Elena Petrova', department: 'Supply Chain', gross: 13200, deductions: 2970, net: 10230, status: 'Review' },
  { id: 'PR-8104', employee: 'Jon Bell', department: 'Manufacturing', gross: 11800, deductions: 2510, net: 9290, status: 'Ready' },
  { id: 'PR-8105', employee: 'Sara Mitchell', department: 'Compliance', gross: 15100, deductions: 3380, net: 11720, status: 'Hold' },
]

const searchResults = [
  { type: 'Finance', title: 'Approve treasury batch TR-2294', meta: '$1.2M pending dual control' },
  { type: 'Inventory', title: 'Thermal Export Packaging', meta: 'Rotterdam E2, out of stock' },
  { type: 'People', title: 'Maya Chen', meta: 'VP Global Operations' },
  { type: 'Sales', title: 'HelioGrid Utilities proposal', meta: '$1.35M forecasted close' },
]

function money(value: number, compact = false, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value)
}

function number(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value)
}

function statusClass(status: string) {
  if (['Posted', 'Ready', 'Active', 'IN STOCK', 'CLOSED'].includes(status)) return 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30'
  if (['Pending', 'Review', 'Remote', 'REORDER', 'QUALIFIED', 'PROPOSAL'].includes(status)) return 'bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/30'
  if (['LOW', 'On Leave', 'NEGOTIATION'].includes(status)) return 'bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-300/30'
  return 'bg-red-400/15 text-red-100 ring-1 ring-red-300/30'
}

function sortRows<T>(rows: T[], key: keyof T, direction: SortDirection) {
  return [...rows].sort((first, second) => {
    const a = first[key]
    const b = second[key]
    const value = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
    return direction === 'asc' ? value : -value
  })
}

export function UnifiedERPWorkspace() {
  const [appState, setAppState] = useState<AppState>(initialAppState)
  const [payrollConfirm, setPayrollConfirm] = useState(false)
  const [liveTime, setLiveTime] = useState('')
  const [lastSync, setLastSync] = useState(2)
  const [transactionPage, setTransactionPage] = useState(1)
  const [transactionSort, setTransactionSort] = useState<keyof Transaction>('date')
  const [transactionDirection, setTransactionDirection] = useState<SortDirection>('desc')
  const [productSort, setProductSort] = useState<keyof Product>('revenue')
  const [productDirection, setProductDirection] = useState<SortDirection>('desc')
  const [inventorySort, setInventorySort] = useState<keyof InventoryItem>('quantity')
  const [inventoryDirection, setInventoryDirection] = useState<SortDirection>('asc')
  const [employeeView, setEmployeeView] = useState<'list' | 'org'>('list')
  const [counts, setCounts] = useState(kpis.map(() => 0))
  const updateAppState = (patch: Partial<AppState>) => setAppState((current) => ({ ...current, ...patch }))
  const activeModule = appState.activeModule
  const collapsed = appState.sidebarCollapsed
  const darkMode = appState.theme === 'dark'
  const searchOpen = appState.searchOpen
  const notificationsOpen = appState.notificationDrawerOpen
  const quickOpen = appState.quickAddOpen
  const company = appState.activeCompany.name
  const fiscalYear = appState.activeFiscalYear
  const currency = appState.activeCurrency
  const language = appState.activeLanguage

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedTheme = window.localStorage.getItem('unified-erp-theme')
      if (storedTheme === 'light' || storedTheme === 'dark') {
        updateAppState({ theme: storedTheme })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('unified-erp-theme', appState.theme)
  }, [appState.theme])

  useEffect(() => {
    const tick = () => {
      setLiveTime(new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()))
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLastSync((value) => (value >= 9 ? 2 : value + 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let frame = 0
    const timer = window.setInterval(() => {
      frame += 1
      const progress = Math.min(frame / 36, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCounts(kpis.map((kpi) => kpi.target * eased))
      if (progress >= 1) window.clearInterval(timer)
    }, 28)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        updateAppState({ searchOpen: true })
      }
      if (event.key === 'Escape') {
        updateAppState({ searchOpen: false, notificationDrawerOpen: false, quickAddOpen: false })
        setPayrollConfirm(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const activeLabel = navGroups.flatMap((group) => group.items).find((item) => item.key === activeModule)?.label ?? 'Executive Dashboard'
  const sortedTransactions = sortRows(transactions, transactionSort, transactionDirection)
  const sortedProducts = sortRows(products, productSort, productDirection)
  const sortedInventory = sortRows(inventory, inventorySort, inventoryDirection)
  const pagedTransactions = sortedTransactions.slice((transactionPage - 1) * 5, transactionPage * 5)
  const maxTransactionPage = Math.ceil(transactions.length / 5)
  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const query = appState.sidebarQuery.trim().toLowerCase()
        return !query || item.label.toLowerCase().includes(query) || group.title.toLowerCase().includes(query)
      }),
    }))
    .filter((group) => group.items.length > 0)
  const stageOrder: Deal['stage'][] = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED']
  const surface = darkMode ? 'bg-[#0a0f1e] text-white' : 'bg-slate-100 text-slate-950'
  const panel = darkMode ? 'border-white/10 bg-white/[0.065] text-white shadow-2xl shadow-black/20' : 'border-slate-200 bg-white text-slate-950 shadow-xl shadow-slate-200/70'
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500'

  const setTransactionHeader = (key: keyof Transaction) => {
    if (transactionSort === key) setTransactionDirection(transactionDirection === 'asc' ? 'desc' : 'asc')
    else {
      setTransactionSort(key)
      setTransactionDirection('desc')
    }
  }

  const setProductHeader = (key: keyof Product) => {
    if (productSort === key) setProductDirection(productDirection === 'asc' ? 'desc' : 'asc')
    else {
      setProductSort(key)
      setProductDirection('desc')
    }
  }

  const setInventoryHeader = (key: keyof InventoryItem) => {
    if (inventorySort === key) setInventoryDirection(inventoryDirection === 'asc' ? 'desc' : 'asc')
    else {
      setInventorySort(key)
      setInventoryDirection('asc')
    }
  }

  const chartTheme = {
    grid: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.12)',
    text: darkMode ? '#94a3b8' : '#475569',
    tooltip: darkMode ? '#101a31' : '#ffffff',
  }

  const renderSort = (isActive: boolean, direction: SortDirection) => (
    <span className={`ml-1 inline-flex align-middle ${isActive ? 'opacity-100' : 'opacity-30'}`}>{direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}</span>
  )

  const renderKpiValue = (kpi: Kpi, value: number) => {
    if (kpi.prefix === '$') return money(value, value >= 1000000, currency)
    if (kpi.suffix === '%') return `${number(value, 1)}%`
    return number(value)
  }

  const renderMetricCard = (label: string, value: string, detail: string, Icon: LucideIcon) => (
    <div className={`rounded-lg border p-4 backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 ${panel}`}>
      <div className="flex items-center justify-between gap-3">
        <div className={`text-xs uppercase tracking-[0.18em] ${muted}`}>{label}</div>
        <Icon className="text-[#c9a84c]" size={18} />
      </div>
      <div className="mt-3 font-['IBM_Plex_Mono'] text-2xl font-semibold tracking-normal">{value}</div>
      <div className={`mt-1 text-xs ${muted}`}>{detail}</div>
    </div>
  )

  const toggleGroup = (title: string) => {
    updateAppState({
      openGroups: {
        ...appState.openGroups,
        [title]: !appState.openGroups[title],
      },
    })
  }

  const renderDashboard = () => (
    <div className="grid gap-5">
      <section className="grid gap-3 xl:grid-cols-6 lg:grid-cols-3">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon
          const positive = kpi.delta >= 0
          return (
            <div
              key={kpi.label}
              className={`group relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br ${kpi.tone} p-[1px] transition duration-200 hover:-translate-y-1 hover:shadow-[0_0_28px_rgba(0,212,255,0.18)]`}
            >
              <div className={`h-full rounded-lg border border-white/10 p-4 backdrop-blur-xl ${darkMode ? 'bg-[#0b1326]/90' : 'bg-white/90'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${muted}`}>{kpi.label}</div>
                  <Icon className="text-[#c9a84c]" size={19} />
                </div>
                <div className="mt-4 font-['IBM_Plex_Mono'] text-[clamp(1.2rem,1.5vw,1.65rem)] font-semibold tracking-normal">
                  {renderKpiValue(kpi, counts[index])}
                </div>
                <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${positive ? 'bg-emerald-400/15 text-emerald-200' : 'bg-red-400/15 text-red-100'}`}>
                  {positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                  {Math.abs(kpi.delta).toFixed(1)}%
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr_1fr]">
        <div className={`min-h-[300px] rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Revenue vs Budget</h2>
              <p className={`text-xs ${muted}`}>12-month performance in millions</p>
            </div>
            <button type="button" title="Export revenue chart" className="rounded-md border border-white/10 p-2 text-slate-300 transition duration-200 hover:border-cyan-300/50 hover:text-cyan-200 active:scale-95">
              <Download size={16} />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={revenueBudget}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="month" stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: chartTheme.tooltip, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, color: darkMode ? '#fff' : '#0f172a' }} />
              <Bar dataKey="budget" fill="#334155" radius={[4, 4, 0, 0]} />
              <Bar dataKey="revenue" fill="#00d4ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={`min-h-[300px] rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
          <div className="mb-4">
            <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Department Cost Breakdown</h2>
            <p className={`text-xs ${muted}`}>Spend allocation by operating group</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RechartsPieChart>
              <Pie data={departmentCosts} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} paddingAngle={4}>
                {departmentCosts.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: chartTheme.tooltip, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, color: darkMode ? '#fff' : '#0f172a' }} />
            </RechartsPieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {departmentCosts.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                <span className={muted}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`min-h-[300px] rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
          <div className="mb-4">
            <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Cash Flow Forecast</h2>
            <p className={`text-xs ${muted}`}>Actual and predicted liquidity position</p>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={cashFlow}>
              <defs>
                <linearGradient id="cashActual" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#00d4ff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="month" stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: chartTheme.tooltip, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, color: darkMode ? '#fff' : '#0f172a' }} />
              <Area type="monotone" dataKey="actual" stroke="#00d4ff" fill="url(#cashActual)" strokeWidth={2} />
              <Area type="monotone" dataKey="forecast" stroke="#c9a84c" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-5">
          {renderTransactionsTable()}
          {renderProductsTable()}
        </div>
        <aside className="grid content-start gap-4">
          <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Critical Alerts</h2>
              <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-1 text-xs font-semibold text-emerald-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                LIVE
              </span>
            </div>
            <div className="grid gap-3">
              {alerts.map((alert) => (
                <div key={alert.title} className={`rounded-lg border p-3 ${alert.tone}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-[0.15em]">{alert.severity}</span>
                    <AlertTriangle size={15} />
                  </div>
                  <div className="mt-2 text-sm font-semibold">{alert.title}</div>
                  <div className="mt-1 text-xs opacity-80">{alert.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
            <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Pending Approvals</h2>
            <div className="mt-4 grid gap-3">
              {['Vendor onboarding: NeoCircuit', 'Payroll batch: EMEA June', 'PO-7781: cold-chain packaging'].map((item, index) => (
                <div key={item} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 p-3">
                  <div>
                    <div className="text-sm font-medium">{item}</div>
                    <div className={`text-xs ${muted}`}>{index + 1} approver left</div>
                  </div>
                  <button type="button" title="Approve item" className="rounded-md bg-[#c9a84c] p-2 text-[#0a0f1e] transition duration-200 hover:bg-cyan-300 active:scale-95">
                    <CheckCircle2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
            <h2 className="font-['Sora'] text-base font-semibold tracking-normal">System Health</h2>
            <div className="mt-4 grid gap-3">
              {[
                ['API latency', '82 ms', 91],
                ['Queue depth', '148 jobs', 67],
                ['Data freshness', '2 sec', 96],
              ].map(([label, value, width]) => (
                <div key={label as string}>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className={muted}>{label}</span>
                    <span className="font-['IBM_Plex_Mono']">{value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#c9a84c] to-[#00d4ff]" style={{ width: `${width}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  )

  function renderTransactionsTable() {
    return (
      <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Recent Transactions</h2>
            <p className={`text-xs ${muted}`}>Sortable ledger activity across all entities</p>
          </div>
          <div className="flex gap-2">
            {[FileSpreadsheet, FileText, Download].map((Icon, index) => (
              <button key={index} type="button" title={['Export CSV', 'Export PDF', 'Export Excel'][index]} className="rounded-md border border-white/10 p-2 text-slate-300 transition duration-200 hover:border-cyan-300/50 hover:text-cyan-200 active:scale-95">
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className={`text-xs uppercase tracking-[0.16em] ${muted}`}>
                {[
                  ['id', 'ID'],
                  ['date', 'Date'],
                  ['entity', 'Entity'],
                  ['type', 'Type'],
                  ['amount', 'Amount'],
                  ['status', 'Status'],
                ].map(([key, label]) => (
                  <th key={key} className="border-b border-white/10 px-3 py-3 font-semibold">
                    <button type="button" onClick={() => setTransactionHeader(key as keyof Transaction)} className="inline-flex items-center transition duration-200 hover:text-cyan-200">
                      {label}
                      {renderSort(transactionSort === key, transactionDirection)}
                    </button>
                  </th>
                ))}
                <th className="border-b border-white/10 px-3 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {pagedTransactions.map((row, index) => (
                <tr key={row.id} className={`${index % 2 === 0 ? 'bg-white/[0.025]' : 'bg-white/[0.055]'} transition duration-200 hover:bg-cyan-300/10 hover:shadow-[0_0_22px_rgba(0,212,255,0.12)]`}>
                  <td className="px-3 py-3 font-['IBM_Plex_Mono'] text-xs">{row.id}</td>
                  <td className="px-3 py-3">{row.date}</td>
                  <td className="px-3 py-3 font-medium">{row.entity}</td>
                  <td className="px-3 py-3">{row.type}</td>
                  <td className="px-3 py-3 font-['IBM_Plex_Mono']">{money(row.amount, false, currency)}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status}</span>
                  </td>
                  <td className="px-3 py-3">
                    <button type="button" title="Open transaction actions" className="rounded-md p-1.5 text-slate-300 transition duration-200 hover:bg-white/10 hover:text-cyan-200 active:scale-95">
                      <MoreHorizontal size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className={muted}>Page {transactionPage} of {maxTransactionPage}</span>
          <div className="flex gap-2">
            <button type="button" disabled={transactionPage === 1} onClick={() => setTransactionPage((page) => Math.max(1, page - 1))} className="rounded-md border border-white/10 px-3 py-2 transition duration-200 hover:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95">
              Previous
            </button>
            <button type="button" disabled={transactionPage === maxTransactionPage} onClick={() => setTransactionPage((page) => Math.min(maxTransactionPage, page + 1))} className="rounded-md border border-white/10 px-3 py-2 transition duration-200 hover:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95">
              Next
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderProductsTable() {
    return (
      <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Top Performing Products</h2>
            <p className={`text-xs ${muted}`}>Revenue, unit velocity, and margin contribution</p>
          </div>
          <button type="button" title="Export product table" className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold transition duration-200 hover:border-cyan-300/50 hover:text-cyan-200 active:scale-95">
            <Download size={15} /> Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className={`text-xs uppercase tracking-[0.16em] ${muted}`}>
                {[
                  ['sku', 'SKU'],
                  ['product', 'Product'],
                  ['units', 'Units Sold'],
                  ['revenue', 'Revenue'],
                  ['margin', 'Margin %'],
                  ['trend', 'Trend'],
                ].map(([key, label]) => (
                  <th key={key} className="border-b border-white/10 px-3 py-3 font-semibold">
                    <button type="button" onClick={() => setProductHeader(key as keyof Product)} className="inline-flex items-center transition duration-200 hover:text-cyan-200">
                      {label}
                      {renderSort(productSort === key, productDirection)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((row, index) => (
                <tr key={row.sku} className={`${index % 2 === 0 ? 'bg-white/[0.025]' : 'bg-white/[0.055]'} transition duration-200 hover:bg-cyan-300/10`}>
                  <td className="px-3 py-3 font-['IBM_Plex_Mono'] text-xs">{row.sku}</td>
                  <td className="px-3 py-3 font-medium">{row.product}</td>
                  <td className="px-3 py-3 font-['IBM_Plex_Mono']">{number(row.units)}</td>
                  <td className="px-3 py-3 font-['IBM_Plex_Mono']">{money(row.revenue, true, currency)}</td>
                  <td className="px-3 py-3">{row.margin.toFixed(1)}%</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 text-emerald-200">
                      <ArrowUp size={13} /> {row.trend}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderInventory() {
    return (
      <div className="grid gap-5">
        <div className="grid gap-3 xl:grid-cols-4">
          {renderMetricCard('Total SKUs', '48,229', 'Across 34 active warehouses', Boxes)}
          {renderMetricCard('Low Stock Alerts', '22', '11 require action today', AlertTriangle)}
          {renderMetricCard('Reorder Points Hit', '14', 'Auto-PO draft ready', ShoppingCart)}
          {renderMetricCard('Inventory Value', '$22.1M', '5.7% above last period', Banknote)}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
          <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Inventory Control Tower</h2>
                <p className={`text-xs ${muted}`}>Filtered by category, warehouse, and fulfillment status</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Category', 'Warehouse', 'Status'].map((filter) => (
                  <button key={filter} type="button" className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold transition duration-200 hover:border-cyan-300/50 active:scale-95">
                    <Filter size={13} /> {filter}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[830px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className={`text-xs uppercase tracking-[0.16em] ${muted}`}>
                    {[
                      ['sku', 'SKU'],
                      ['product', 'Product'],
                      ['quantity', 'Qty On Hand'],
                      ['reorder', 'Reorder Qty'],
                      ['supplier', 'Supplier'],
                      ['status', 'Status'],
                    ].map(([key, label]) => (
                      <th key={key} className="border-b border-white/10 px-3 py-3 font-semibold">
                        <button type="button" onClick={() => setInventoryHeader(key as keyof InventoryItem)} className="inline-flex items-center transition duration-200 hover:text-cyan-200">
                          {label}
                          {renderSort(inventorySort === key, inventoryDirection)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedInventory.map((row, index) => (
                    <tr key={row.sku} className={`${index % 2 === 0 ? 'bg-white/[0.025]' : 'bg-white/[0.055]'} transition duration-200 hover:bg-cyan-300/10`}>
                      <td className="px-3 py-3 font-['IBM_Plex_Mono'] text-xs">{row.sku}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{row.product}</div>
                        <div className={`text-xs ${muted}`}>{row.category} / {row.warehouse}</div>
                      </td>
                      <td className="px-3 py-3 font-['IBM_Plex_Mono']">{number(row.quantity)}</td>
                      <td className="px-3 py-3 font-['IBM_Plex_Mono']">{number(row.reorder)}</td>
                      <td className="px-3 py-3">{row.supplier}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
            <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Stock Level Trend</h2>
            <p className={`mb-4 text-xs ${muted}`}>Last 30 days, aggregate quantity</p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stockTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="day" stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: chartTheme.tooltip, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, color: darkMode ? '#fff' : '#0f172a' }} />
                <Line type="monotone" dataKey="stock" stroke="#00d4ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )
  }

  function renderEmployees() {
    return (
      <div className="grid gap-5">
        <div className="grid gap-3 xl:grid-cols-4">
          {renderMetricCard('Total Employees', '10,482', '50 countries represented', Users)}
          {renderMetricCard('Active', '9,914', '94.6% workforce available', UserCheck)}
          {renderMetricCard('On Leave', '318', 'Planned and compliant', CalendarClock)}
          {renderMetricCard('New This Month', '74', '18 leadership hires', UserPlus)}
        </div>
        <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Employee Directory</h2>
              <p className={`text-xs ${muted}`}>Search, department, location, and availability controls</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3">
                <Search size={15} className="text-slate-400" />
                <input className="w-44 bg-transparent text-sm outline-none placeholder:text-slate-500" placeholder="Search people" />
              </div>
              <button type="button" onClick={() => setEmployeeView(employeeView === 'list' ? 'org' : 'list')} className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold transition duration-200 hover:border-cyan-300/50 active:scale-95">
                {employeeView === 'list' ? 'Org chart' : 'List view'}
              </button>
            </div>
          </div>
          {employeeView === 'org' ? (
            <div className="grid gap-4">
              <div className="mx-auto rounded-lg border border-[#c9a84c]/50 bg-[#c9a84c]/10 px-5 py-4 text-center">
                <div className="text-lg font-semibold">Amina Rahman</div>
                <div className={`text-xs ${muted}`}>Chief Operating Officer</div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {employees.slice(0, 3).map((employee) => (
                  <div key={employee.name} className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-300/15 font-semibold text-cyan-100">{employee.initials}</div>
                    <div className="font-semibold">{employee.name}</div>
                    <div className={`text-xs ${muted}`}>{employee.title}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {employees.map((employee) => (
                <div key={employee.name} className="rounded-lg border border-white/10 bg-white/[0.045] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00d4ff]/30 to-[#c9a84c]/30 font-semibold">{employee.initials}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{employee.name}</div>
                      <div className={`text-xs ${muted}`}>{employee.title}</div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white/10 px-2 py-1">{employee.department}</span>
                        <span className="rounded-full bg-white/10 px-2 py-1">{employee.location}</span>
                        <span className={`rounded-full px-2 py-1 ${statusClass(employee.status)}`}>{employee.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderSales() {
    return (
      <div className="grid gap-5">
        <div className="grid gap-3 xl:grid-cols-4">
          {renderMetricCard('Pipeline Value', '$6.9M', 'Weighted forecast: $4.7M', CircleDollarSign)}
          {renderMetricCard('Win Rate', '42.8%', '6.2 pts above target', Gauge)}
          {renderMetricCard('Avg Deal Cycle', '38 days', 'Down 9 days QoQ', Clock3)}
          {renderMetricCard('Enterprise Deals', '17', '4 in legal review', BriefcaseBusiness)}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
          <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
            <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Sales Pipeline</h2>
            <p className={`mb-4 text-xs ${muted}`}>Kanban forecast by stage, probability, and close date</p>
            <div className="grid min-h-[480px] gap-3 lg:grid-cols-5">
              {stageOrder.map((stage) => {
                const stageDeals = deals.filter((deal) => deal.stage === stage)
                const total = stageDeals.reduce((sum, deal) => sum + deal.value, 0)
                return (
                  <div key={stage} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-xs font-bold tracking-[0.14em]">{stage}</div>
                      <div className="font-['IBM_Plex_Mono'] text-xs text-[#c9a84c]">{money(total, true)}</div>
                    </div>
                    <div className="grid gap-3">
                      {stageDeals.map((deal) => (
                        <div key={deal.company} className="rounded-lg border border-white/10 bg-[#0a0f1e]/45 p-3 transition duration-200 hover:border-cyan-300/50 hover:bg-cyan-300/10">
                          <div className="text-sm font-semibold">{deal.company}</div>
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span className={muted}>{deal.rep}</span>
                            <span className="font-['IBM_Plex_Mono']">{money(deal.value, true)}</span>
                          </div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#c9a84c] to-[#00d4ff]" style={{ width: `${deal.probability}%` }} />
                          </div>
                          <div className={`mt-2 text-xs ${muted}`}>{deal.probability}% probability / {deal.closeDate}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
            <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Win Rate Gauge</h2>
            <p className={`text-xs ${muted}`}>Trailing 90-day enterprise motion</p>
            <ResponsiveContainer width="100%" height={260}>
              <RadialBarChart innerRadius="64%" outerRadius="95%" data={[{ name: 'Win rate', value: 42.8, fill: '#00d4ff' }]} startAngle={180} endAngle={0}>
                <RadialBar dataKey="value" cornerRadius={12} background={{ fill: 'rgba(255,255,255,0.08)' }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="-mt-28 text-center">
              <div className="font-['IBM_Plex_Mono'] text-4xl font-semibold">42.8%</div>
              <div className={`mt-1 text-xs ${muted}`}>Win rate</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderPayroll() {
    const totalGross = payrollRows.reduce((sum, row) => sum + row.gross, 0)
    const totalNet = payrollRows.reduce((sum, row) => sum + row.net, 0)
    return (
      <div className="grid gap-5">
        <div className="grid gap-3 xl:grid-cols-4">
          {renderMetricCard('Total Payroll', money(totalGross), `${money(totalNet)} net scheduled`, Banknote)}
          {renderMetricCard('Avg Salary', money(totalGross / payrollRows.length), 'Current pay period sample', Users)}
          {renderMetricCard('Departments', '5', 'Cross-entity payroll batch', Building2)}
          {renderMetricCard('Pending Approvals', '2', 'Controller and HR director', ClipboardCheck)}
        </div>
        <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Payroll Processing</h2>
              <p className={`text-xs ${muted}`}>Pay period: Jun 1-15, 2026 / USD consolidated</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold transition duration-200 hover:border-cyan-300/50 active:scale-95">
                <CalendarClock size={15} /> Change Period
              </button>
              <button type="button" onClick={() => setPayrollConfirm(true)} className="inline-flex items-center gap-2 rounded-md bg-[#c9a84c] px-4 py-2 text-sm font-bold text-[#0a0f1e] transition duration-200 hover:bg-cyan-300 active:scale-95">
                <Zap size={16} /> Run Payroll
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className={`text-xs uppercase tracking-[0.16em] ${muted}`}>
                  {['ID', 'Employee', 'Department', 'Gross', 'Deductions', 'Net', 'Status'].map((label) => (
                    <th key={label} className="border-b border-white/10 px-3 py-3 font-semibold">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrollRows.map((row, index) => (
                  <tr key={row.id} className={`${index % 2 === 0 ? 'bg-white/[0.025]' : 'bg-white/[0.055]'} transition duration-200 hover:bg-cyan-300/10`}>
                    <td className="px-3 py-3 font-['IBM_Plex_Mono'] text-xs">{row.id}</td>
                    <td className="px-3 py-3 font-medium">{row.employee}</td>
                    <td className="px-3 py-3">{row.department}</td>
                    <td className="px-3 py-3 font-['IBM_Plex_Mono']">{money(row.gross)}</td>
                    <td className="px-3 py-3 font-['IBM_Plex_Mono']">{money(row.deductions)}</td>
                    <td className="px-3 py-3 font-['IBM_Plex_Mono']">{money(row.net)}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function renderAnalytics() {
    return (
      <div className="grid gap-5">
        <div className="grid gap-3 xl:grid-cols-4">
          {renderMetricCard('Realtime Events', '1.8M', 'Last 24 hours processed', DatabaseZap)}
          {renderMetricCard('SLA Compliance', '99.96%', 'Enterprise target: 99.99%', ShieldCheck)}
          {renderMetricCard('Countries', '50+', 'Multi-entity operations', Globe2)}
          {renderMetricCard('Risk Signals', '31', '9 require executive review', AlertTriangle)}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
            <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Live Throughput</h2>
            <p className={`mb-4 text-xs ${muted}`}>Operational events, API calls, and workflow executions</p>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={cashFlow.map((item, index) => ({ ...item, events: 2600 + index * 430, workflows: 1200 + index * 210 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="month" stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: chartTheme.tooltip, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, color: darkMode ? '#fff' : '#0f172a' }} />
                <Area type="monotone" dataKey="events" stroke="#00d4ff" fill="#00d4ff22" strokeWidth={2} />
                <Area type="monotone" dataKey="workflows" stroke="#c9a84c" fill="#c9a84c22" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
            <h2 className="font-['Sora'] text-base font-semibold tracking-normal">Compliance Posture</h2>
            <p className={`mb-4 text-xs ${muted}`}>Controls mapped to enterprise readiness badges</p>
            <div className="grid gap-3">
              {[
                ['ISO 27001', 'Evidence collection complete', 92],
                ['SOC2', 'Controls mapped, audit pending', 76],
                ['GDPR', 'Data rights workflow active', 88],
                ['Uptime SLA', '99.99% target visible', 96],
              ].map(([label, detail, progress]) => (
                <div key={label as string} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="font-semibold">{label}</div>
                      <div className={`text-xs ${muted}`}>{detail}</div>
                    </div>
                    <span className="font-['IBM_Plex_Mono'] text-sm text-[#c9a84c]">{progress}%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#c9a84c] to-[#00d4ff]" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderAi() {
    return (
      <div className="grid gap-5">
        <div className="grid gap-3 xl:grid-cols-4">
          {renderMetricCard('Forecast Accuracy', '94.1%', 'Cash and demand models', BrainCircuit)}
          {renderMetricCard('Automations', '286', '71 with approval gates', Zap)}
          {renderMetricCard('Savings Identified', '$3.4M', 'Annualized opportunity', CircleDollarSign)}
          {renderMetricCard('Governed Runs', '18,420', '0 high-risk executions', ShieldCheck)}
        </div>
        <div className={`rounded-lg border p-5 backdrop-blur-xl ${panel}`}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-300/15 p-3 text-cyan-100"><BrainCircuit size={24} /></div>
            <div>
              <h2 className="font-['Sora'] text-lg font-semibold tracking-normal">AI Insights & Forecasting</h2>
              <p className={`text-sm ${muted}`}>Workspace-aware recommendations with governance and approval context</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {[
              ['Cash runway expansion', 'Delay non-critical hardware purchases by 21 days to preserve $820K in operating cash without affecting SLAs.'],
              ['Inventory anomaly', 'Sterile Monitoring Sensor demand is 34% above forecast in Riyadh H1; create emergency supplier quote.'],
              ['Sales forecast', 'HelioGrid has a 58% close probability, but security review is the blocker. Route SOC2 packet today.'],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-cyan-50"><Sparkles size={16} /> {title}</div>
                <p className="text-sm leading-6 text-slate-300">{detail}</p>
                <button type="button" className="mt-4 rounded-md border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-100 transition duration-200 hover:bg-cyan-300/15 active:scale-95">
                  Create governed action
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderLedger() {
    return (
      <div className="grid gap-5">
        <div className="grid gap-3 xl:grid-cols-4">
          {renderMetricCard('Ledger Entries', '184,920', '2,918 posted today', BookOpen)}
          {renderMetricCard('Open AR', '$8.7M', 'DSO: 37 days', ReceiptText)}
          {renderMetricCard('Open AP', '$4.1M', 'Early-pay discount: $62K', CreditCard)}
          {renderMetricCard('Audit Exceptions', '7', 'All assigned to owners', ShieldCheck)}
        </div>
        {renderTransactionsTable()}
      </div>
    )
  }

  function renderUnifiedModule(
    title: string,
    subtitle: string,
    metrics: [string, string, string, LucideIcon][],
    rows: { primary: string; secondary: string; value: string; status: string }[],
    chartData: { name: string; actual: number; target: number }[],
  ) {
    return (
      <div className="grid gap-5">
        <div className={`rounded-lg border p-5 backdrop-blur-xl ${panel}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-['Sora'] text-lg font-semibold tracking-normal">{title}</h2>
              <p className={`mt-1 text-sm ${muted}`}>{subtitle}</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                <Building2 size={13} />
                {company} / {fiscalYear} / {currency}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Today', 'This Week', 'MTD', 'QTD', 'YTD', 'Custom'].map((range) => (
                <button key={range} type="button" className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold transition duration-200 hover:border-cyan-300/50 hover:text-cyan-200 active:scale-95">
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-4">
          {metrics.map(([label, value, detail, Icon]) => renderMetricCard(label, value, detail, Icon))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-['Sora'] text-base font-semibold tracking-normal">{title} Work Queue</h3>
                <p className={`text-xs ${muted}`}>Unified queue with sortable operations, approvals, and export controls</p>
              </div>
              <div className="flex gap-2">
                {[FileSpreadsheet, FileText, Download, Settings].map((Icon, index) => (
                  <button key={index} type="button" title={['Export CSV', 'Export PDF', 'Export Excel', 'Customize columns'][index]} className="rounded-md border border-white/10 p-2 text-slate-300 transition duration-200 hover:border-cyan-300/50 hover:text-cyan-200 active:scale-95">
                    <Icon size={16} />
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className={`text-xs uppercase tracking-[0.16em] ${muted}`}>
                    {['Record', 'Owner / Context', 'Value', 'Status', 'Action'].map((label) => (
                      <th key={label} className="border-b border-white/10 px-3 py-3 font-semibold">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.primary}-${index}`} className={`${index % 2 === 0 ? 'bg-white/[0.025]' : 'bg-white/[0.055]'} transition duration-200 hover:bg-cyan-300/10`}>
                      <td className="px-3 py-3 font-medium">{row.primary}</td>
                      <td className={`px-3 py-3 ${muted}`}>{row.secondary}</td>
                      <td className="px-3 py-3 font-['IBM_Plex_Mono']">{row.value}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status}</span></td>
                      <td className="px-3 py-3">
                        <button type="button" className="rounded-md border border-cyan-300/30 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition duration-200 hover:bg-cyan-300/15 active:scale-95">
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`rounded-lg border p-4 backdrop-blur-xl ${panel}`}>
            <h3 className="font-['Sora'] text-base font-semibold tracking-normal">{title} Performance</h3>
            <p className={`mb-4 text-xs ${muted}`}>Actual versus target, current operating period</p>
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="name" stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: chartTheme.tooltip, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, color: darkMode ? '#fff' : '#0f172a' }} />
                <Bar dataKey="target" fill="#334155" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="#00d4ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )
  }

  function renderFinance() {
    return renderUnifiedModule(
      'Finance & Accounting',
      'Accounts receivable, payables, budgets, tax controls, currency exposure, and cash management in one operating view.',
      [
        ['Open AR', '$8.7M', '37 day DSO', ReceiptText],
        ['Open AP', '$4.1M', '$62K early-pay upside', CreditCard],
        ['Budget Variance', '+3.8%', 'Inside board threshold', Gauge],
        ['Cash Position', '$12.4M', '143 days runway', Banknote],
      ],
      [
        { primary: 'AR-8821 HelioGrid invoice', secondary: 'Controller: Omar Haddad', value: '$428,900', status: 'Posted' },
        { primary: 'AP-4417 NeoCircuit supplier bill', secondary: 'Approval: Procurement + Finance', value: '$186,400', status: 'Pending' },
        { primary: 'Tax pack: EU VAT May', secondary: 'Nexus Europe GmbH', value: '$74,200', status: 'Review' },
        { primary: 'FX hedge: SAR exposure', secondary: 'Treasury desk', value: '$1.1M', status: 'Ready' },
      ],
      [
        { name: 'AR', actual: 87, target: 82 },
        { name: 'AP', actual: 74, target: 79 },
        { name: 'Cash', actual: 92, target: 86 },
        { name: 'Tax', actual: 81, target: 80 },
      ],
    )
  }

  function renderProcurement() {
    return renderUnifiedModule(
      'Procurement & Supply Chain',
      'Purchase orders, suppliers, logistics, warehouse handoffs, and demand forecasts filtered by company context.',
      [
        ['Open POs', '1,204', '3.1% down this week', ShoppingCart],
        ['Supplier OTIF', '94.6%', 'Top quartile performance', Handshake],
        ['Inbound Shipments', '318', '22 at risk', Truck],
        ['Demand Forecast', '+11.8%', 'Medical sensors rising', BrainCircuit],
      ],
      [
        { primary: 'PO-7781 thermal packaging', secondary: 'PolarPack BV / Rotterdam E2', value: '$310,500', status: 'Review' },
        { primary: 'Supplier risk: NeoCircuit', secondary: 'Quality score dropped 8 pts', value: '82%', status: 'Pending' },
        { primary: 'Inbound: sterile sensors', secondary: 'Riyadh H1 emergency replenishment', value: '8,400 units', status: 'Ready' },
        { primary: 'Logistics SLA: APAC lane', secondary: '18 minutes from breach', value: 'High', status: 'LOW' },
      ],
      [
        { name: 'POs', actual: 76, target: 80 },
        { name: 'OTIF', actual: 95, target: 92 },
        { name: 'Cost', actual: 88, target: 84 },
        { name: 'Risk', actual: 71, target: 78 },
      ],
    )
  }

  function renderManufacturing() {
    return renderUnifiedModule(
      'Manufacturing Operations',
      'Production orders, bill of materials, quality control, maintenance, and capacity planning across plants.',
      [
        ['Production Orders', '428', '31 due today', Factory],
        ['Quality Yield', '98.4%', '0.6 pts above plan', BadgeCheck],
        ['Maintenance Risk', '7', 'Critical assets flagged', HardHat],
        ['Capacity Utilization', '87%', 'Detroit W3 constrained', Gauge],
      ],
      [
        { primary: 'MO-5521 Edge Gateway Pro', secondary: 'Detroit W3 assembly line', value: '18,420 units', status: 'Ready' },
        { primary: 'BOM change: IoT chipset', secondary: 'Engineering approval required', value: 'v14.2', status: 'Review' },
        { primary: 'QC batch: biomedical sensors', secondary: 'Riyadh H1 sterile line', value: '99.1%', status: 'Posted' },
        { primary: 'Plant maintenance: press #7', secondary: 'Predicted bearing failure', value: '36h', status: 'LOW' },
      ],
      [
        { name: 'Output', actual: 91, target: 88 },
        { name: 'Yield', actual: 98, target: 96 },
        { name: 'Uptime', actual: 94, target: 97 },
        { name: 'Capacity', actual: 87, target: 84 },
      ],
    )
  }

  function renderCRM() {
    return renderUnifiedModule(
      'Customer 360 & CRM',
      'Customer health, lead management, contracts, quotes, invoices, and relationship intelligence.',
      [
        ['Active Accounts', '2,418', '312 enterprise', Users],
        ['Renewal Risk', '$1.8M', '9 accounts need action', AlertTriangle],
        ['Quote Value', '$4.6M', 'This quarter', FileText],
        ['Contract Cycle', '12 days', '4 days faster QoQ', LockKeyhole],
      ],
      [
        { primary: 'HelioGrid Utilities', secondary: 'Security review is blocking close', value: '$1.35M', status: 'PROPOSAL' },
        { primary: 'Northstar Media Group', secondary: 'Renewal expansion ready', value: '$610K', status: 'NEGOTIATION' },
        { primary: 'Aster Health Network', secondary: 'HIPAA diligence requested', value: '$980K', status: 'QUALIFIED' },
        { primary: 'Crown Creative Holdings', secondary: 'Portal rollout planned', value: '$420K', status: 'Ready' },
      ],
      [
        { name: 'Health', actual: 88, target: 84 },
        { name: 'Leads', actual: 72, target: 70 },
        { name: 'Quotes', actual: 91, target: 86 },
        { name: 'Contracts', actual: 79, target: 82 },
      ],
    )
  }

  function renderProjects() {
    return renderUnifiedModule(
      'Project Management',
      'Project dashboard, kanban execution, resources, milestones, Gantt planning, and time tracking.',
      [
        ['Active Projects', '186', '42 strategic programs', LayoutDashboard],
        ['Tasks Due', '1,482', '214 blocked', ClipboardCheck],
        ['Resource Load', '84%', '12 teams over 90%', Users],
        ['Tracked Hours', '48,920', 'MTD billable work', Clock3],
      ],
      [
        { primary: 'ERP rollout: Aster Health', secondary: 'Milestone: compliance review', value: '72%', status: 'Review' },
        { primary: 'Client portal migration', secondary: 'Northstar Media Group', value: '86%', status: 'Ready' },
        { primary: 'Finance automation sprint', secondary: 'Shared services team', value: '41 tasks', status: 'Pending' },
        { primary: 'Manufacturing telemetry', secondary: 'Detroit W3', value: 'Phase 2', status: 'Posted' },
      ],
      [
        { name: 'Scope', actual: 83, target: 80 },
        { name: 'Time', actual: 78, target: 82 },
        { name: 'Cost', actual: 86, target: 84 },
        { name: 'Quality', actual: 92, target: 88 },
      ],
    )
  }

  function renderReports() {
    return renderUnifiedModule(
      'Reports & Business Intelligence',
      'Standard reports, custom builders, KPI definitions, and export center for board-ready operating intelligence.',
      [
        ['Published Reports', '428', '76 scheduled exports', FileText],
        ['Custom KPIs', '118', '22 board-level metrics', Gauge],
        ['Exports Today', '1,908', 'CSV, Excel, PDF', Download],
        ['Data Freshness', '2 sec', 'Realtime warehouse sync', DatabaseZap],
      ],
      [
        { primary: 'Board pack: June operating review', secondary: 'Executive dashboard bundle', value: '12 reports', status: 'Ready' },
        { primary: 'Finance variance report', secondary: 'CFO office', value: '$9.2M profit', status: 'Posted' },
        { primary: 'Inventory demand forecast', secondary: 'Supply chain analytics', value: '30 days', status: 'Review' },
        { primary: 'SOC2 audit evidence export', secondary: 'Security & Compliance', value: '94 controls', status: 'Pending' },
      ],
      [
        { name: 'Reports', actual: 94, target: 88 },
        { name: 'Exports', actual: 89, target: 84 },
        { name: 'KPIs', actual: 77, target: 74 },
        { name: 'Freshness', actual: 96, target: 92 },
      ],
    )
  }

  function renderAdmin() {
    return renderUnifiedModule(
      'Administration & Security',
      'Users, roles, audit logs, system configuration, API integrations, security controls, and multi-company settings.',
      [
        ['Active Users', '847', 'Online now', UserCheck],
        ['Roles Managed', '64', '12 privileged roles', ShieldCheck],
        ['Audit Events', '1.8M', 'Last 24 hours indexed', Activity],
        ['API Integrations', '37', '34 healthy', Network],
      ],
      [
        { primary: 'Role policy: Finance Approver', secondary: 'Dual-control threshold update', value: '$250K', status: 'Review' },
        { primary: 'API integration: QuickBooks', secondary: 'Token rotation due', value: '3 days', status: 'Pending' },
        { primary: 'Security control: MFA owners', secondary: '98.7% enrolled', value: '12 gaps', status: 'LOW' },
        { primary: 'Multi-company setup', secondary: 'Managing 12 entities across 50+ countries', value: '12 entities', status: 'Posted' },
      ],
      [
        { name: 'Users', actual: 91, target: 88 },
        { name: 'Roles', actual: 84, target: 86 },
        { name: 'Audit', actual: 97, target: 92 },
        { name: 'APIs', actual: 89, target: 85 },
      ],
    )
  }

  function renderActiveModule() {
    if (activeModule === 'inventory') return renderInventory()
    if (activeModule === 'hr') return renderEmployees()
    if (activeModule === 'sales') return renderSales()
    if (activeModule === 'crm') return renderCRM()
    if (activeModule === 'payroll') return renderPayroll()
    if (activeModule === 'finance') return renderFinance()
    if (activeModule === 'procurement') return renderProcurement()
    if (activeModule === 'manufacturing') return renderManufacturing()
    if (activeModule === 'projects') return renderProjects()
    if (activeModule === 'reports') return renderReports()
    if (activeModule === 'admin') return renderAdmin()
    if (activeModule === 'analytics') return renderAnalytics()
    if (activeModule === 'ai') return renderAi()
    if (activeModule === 'ledger') return renderLedger()
    return renderDashboard()
  }

  return (
    <div className={`min-h-screen ${surface} font-['Sora'] tracking-normal transition-colors duration-200`}>
      <div className="flex min-h-screen">
        <aside className={`${collapsed ? 'w-[82px]' : 'w-[300px]'} sticky top-0 hidden h-screen shrink-0 border-r border-white/10 bg-[#07101f]/95 backdrop-blur-2xl transition-all duration-300 ease-out xl:flex xl:flex-col`}>
          <div className="flex h-20 items-center justify-between border-b border-white/10 px-4">
            <button type="button" onClick={() => updateAppState({ activeModule: 'dashboard' })} className="flex min-w-0 items-center gap-3 text-left transition duration-200 hover:opacity-85 active:scale-95">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#c9a84c]/40 bg-[#c9a84c]/15 text-[#c9a84c]">
                <Building2 size={23} />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">NEXUS ERP</div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
                    Enterprise
                  </div>
                </div>
              )}
            </button>
            <button type="button" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => updateAppState({ sidebarCollapsed: !collapsed })} className="rounded-md p-2 text-slate-400 transition duration-200 hover:bg-white/10 hover:text-white active:scale-95">
              {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            {!collapsed && (
              <div className="mb-4 flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-slate-300">
                <Search size={15} className="text-slate-500" />
                <input
                  value={appState.sidebarQuery}
                  onChange={(event) => updateAppState({ sidebarQuery: event.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
                  placeholder="Find module"
                />
              </div>
            )}
            {filteredNavGroups.map((group) => (
              <div key={group.title} className="mb-5">
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className="mb-2 flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 transition duration-200 hover:bg-white/5 hover:text-slate-300"
                  >
                    {group.title}
                    <ChevronDown size={13} className={`transition duration-200 ${appState.openGroups[group.title] ? 'rotate-0' : '-rotate-90'}`} />
                  </button>
                )}
                <div className={`grid gap-1 ${!collapsed && !appState.openGroups[group.title] ? 'hidden' : ''}`}>
                  {group.items.map((item, index) => {
                    const Icon = item.icon
                    const active = item.key === activeModule
                    const badge = item.label.includes('Payroll') ? '3' : item.label.includes('Alerts') ? '9' : item.label.includes('Purchase') ? '14' : ''
                    return (
                      <button
                        key={`${group.title}-${item.label}-${index}`}
                        type="button"
                        title={collapsed ? item.label : undefined}
                        onClick={() => updateAppState({ activeModule: item.key })}
                        className={`group relative flex h-10 items-center gap-3 overflow-hidden rounded-md px-3 text-left text-sm transition duration-200 active:scale-[0.98] ${active ? 'bg-white/10 text-white shadow-[inset_3px_0_0_#c9a84c]' : 'text-slate-400 hover:bg-white/[0.07] hover:text-cyan-100'}`}
                      >
                        <Icon size={17} className={active ? 'text-[#c9a84c]' : 'text-slate-500 group-hover:text-cyan-200'} />
                        {!collapsed && (
                          <>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {badge && <span className="rounded-full bg-cyan-300/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan-100">{badge}</span>}
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 p-4">
            <div className={`${collapsed ? 'justify-center' : 'justify-between'} flex items-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-100`}>
              {!collapsed && (
                <div>
                  <div className="text-xs font-bold">99.99% SLA</div>
                  <div className="text-[11px] text-emerald-200/75">All regions operational</div>
                </div>
              )}
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300" />
            </div>
          </div>
        </aside>

        <main id="main-content" className="min-w-0 flex-1">
          <header className={`sticky top-0 z-30 border-b ${darkMode ? 'border-white/10 bg-[#0a0f1e]/86' : 'border-slate-200 bg-white/90'} backdrop-blur-2xl`}>
            <div className="flex min-h-20 flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
              <button type="button" title="Menu" className="rounded-md border border-white/10 p-2 text-slate-300 transition duration-200 hover:bg-white/10 xl:hidden">
                <Menu size={18} />
              </button>
              <div className="min-w-[220px] flex-1">
                <div className={`text-xs ${muted}`}>NEXUS ERP / Command Center / {activeLabel}</div>
                <h1 className="mt-1 font-['Sora'] text-xl font-bold tracking-normal lg:text-2xl">{activeLabel}</h1>
              </div>
              <button type="button" onClick={() => updateAppState({ searchOpen: true })} className={`hidden h-11 min-w-[300px] items-center justify-between rounded-lg border px-3 text-left transition duration-200 hover:border-cyan-300/50 lg:flex ${darkMode ? 'border-white/10 bg-white/5 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <span className="flex items-center gap-2"><Search size={16} /> Search entities, reports, workflows</span>
                <kbd className="rounded border border-white/10 px-2 py-1 text-[10px]"><Command size={11} className="inline" /> K</kbd>
              </button>
              <select value={company} title={`Managing 12 entities across 50+ countries. Active region: ${appState.activeCompany.flag}`} onChange={(event) => {
                const selectedCompany = companies.find((item) => item.name === event.target.value) ?? companies[0]
                updateAppState({ activeCompany: selectedCompany, activeCurrency: selectedCompany.currency })
              }} className={`h-11 rounded-lg border px-3 text-sm outline-none transition duration-200 hover:border-cyan-300/50 ${darkMode ? 'border-white/10 bg-[#101a31] text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
                {companies.map((item) => <option key={item.id}>{item.name}</option>)}
              </select>
              <select value={fiscalYear} onChange={(event) => updateAppState({ activeFiscalYear: event.target.value })} className={`h-11 rounded-lg border px-3 text-sm outline-none transition duration-200 hover:border-cyan-300/50 ${darkMode ? 'border-white/10 bg-[#101a31] text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
                {['FY2026', 'FY2025', 'FY2024'].map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={currency} onChange={(event) => updateAppState({ activeCurrency: event.target.value })} className={`h-11 rounded-lg border px-3 text-sm outline-none transition duration-200 hover:border-cyan-300/50 ${darkMode ? 'border-white/10 bg-[#101a31] text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
                {['USD', 'EUR', 'GBP', 'SAR', 'CNY'].map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={language} onChange={(event) => updateAppState({ activeLanguage: event.target.value })} title="Language selector" className={`h-11 rounded-lg border px-3 text-sm outline-none transition duration-200 hover:border-cyan-300/50 ${darkMode ? 'border-white/10 bg-[#101a31] text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
                {['EN', 'AR', 'FR', 'ZH'].map((item) => <option key={item}>{item}</option>)}
              </select>
              <button type="button" title="Toggle theme" onClick={() => updateAppState({ theme: darkMode ? 'light' : 'dark' })} className="rounded-lg border border-white/10 p-3 text-slate-300 transition duration-200 hover:border-cyan-300/50 hover:text-cyan-200 active:scale-95">
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button type="button" title="Notifications" onClick={() => updateAppState({ notificationDrawerOpen: true })} className="relative rounded-lg border border-white/10 p-3 text-slate-300 transition duration-200 hover:border-cyan-300/50 hover:text-cyan-200 active:scale-95">
                <Bell size={17} />
                <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{appState.notifications.length}</span>
              </button>
              <div className="flex h-11 items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#c9a84c] to-[#00d4ff] text-xs font-black text-[#0a0f1e]">{appState.currentUser.avatar}</div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold">{appState.currentUser.name}</div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#c9a84c]">{appState.currentUser.role}</div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-2 text-xs lg:px-6">
              <div className="flex flex-wrap items-center gap-2">
                {['ISO 27001', 'SOC2', 'GDPR'].map((badge) => (
                  <span key={badge} className="inline-flex items-center gap-1 rounded-full border border-[#c9a84c]/30 bg-[#c9a84c]/10 px-2 py-1 font-semibold text-[#e6d28f]">
                    <ShieldCheck size={12} /> {badge}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 font-semibold text-emerald-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Enterprise Edition | 847 Active Users
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 font-semibold text-cyan-100">
                  <Globe2 size={12} /> Managing 12 entities across 50+ countries
                </span>
              </div>
              <div className={`flex items-center gap-3 ${muted}`}>
                <span className="inline-flex items-center gap-1"><Clock3 size={13} /> {liveTime}</span>
                <span className="inline-flex items-center gap-1"><DatabaseZap size={13} /> Last synced: {lastSync}s ago</span>
              </div>
            </div>
          </header>

          <div className="px-4 py-5 lg:px-6">
            {renderActiveModule()}
          </div>

          <footer className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs lg:px-6 ${darkMode ? 'border-white/10 bg-[#07101f]' : 'border-slate-200 bg-white'} ${muted}`}>
            <span>NEXUS ERP v9.8.2 / Multi-tenant enterprise workspace</span>
            <span className="inline-flex flex-wrap items-center gap-2">
              {['ISO 27001', 'SOC 2', 'GDPR'].map((badge) => (
                <span key={badge} className="rounded-full border border-[#c9a84c]/30 bg-[#c9a84c]/10 px-2 py-1 text-[#e6d28f]">{badge}</span>
              ))}
            </span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Server status: operational / Last sync: {lastSync}s ago</span>
          </footer>
        </main>
      </div>

      <div className="fixed bottom-6 right-6 z-40">
        {quickOpen && (
          <div className={`mb-3 grid gap-2 rounded-lg border p-3 backdrop-blur-xl ${panel}`}>
            {['New Invoice', 'New Purchase Order', 'New Employee', 'New Task', 'New Customer', 'New Product'].map((action) => (
              <button key={action} type="button" className="rounded-md px-4 py-2 text-left text-sm transition duration-200 hover:bg-cyan-300/10 active:scale-95">
                + {action}
              </button>
            ))}
          </div>
        )}
        <button type="button" title="Quick actions" onClick={() => updateAppState({ quickAddOpen: !quickOpen })} className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#c9a84c] text-[#0a0f1e] shadow-[0_0_30px_rgba(201,168,76,0.36)] transition duration-200 hover:bg-cyan-300 active:scale-95">
          <Plus size={24} />
        </button>
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[10vh] backdrop-blur-md">
          <div className={`w-full max-w-2xl rounded-lg border p-4 shadow-2xl ${panel}`}>
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <Search className="text-cyan-200" size={20} />
              <input autoFocus className="flex-1 bg-transparent text-base outline-none placeholder:text-slate-500" placeholder="Search invoices, people, deals, inventory, reports" />
              <button type="button" title="Close search" onClick={() => updateAppState({ searchOpen: false })} className="rounded-md p-2 transition duration-200 hover:bg-white/10 active:scale-95">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Recent', 'Finance', 'People', 'Inventory', 'Sales', 'AI Actions'].map((filter) => (
                <button key={filter} type="button" className="rounded-full border border-white/10 px-3 py-1.5 text-xs transition duration-200 hover:border-cyan-300/50 hover:text-cyan-200 active:scale-95">{filter}</button>
              ))}
            </div>
            <div className="mt-4 grid gap-2">
              {searchResults.map((result) => (
                <button key={result.title} type="button" className="rounded-lg border border-white/10 bg-white/5 p-3 text-left transition duration-200 hover:border-cyan-300/50 hover:bg-cyan-300/10 active:scale-[0.99]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{result.title}</div>
                    <span className="rounded-full bg-[#c9a84c]/15 px-2 py-1 text-xs text-[#e6d28f]">{result.type}</span>
                  </div>
                  <div className={`mt-1 text-xs ${muted}`}>{result.meta}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {notificationsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className={`h-full w-full max-w-md border-l p-5 ${darkMode ? 'border-white/10 bg-[#0a0f1e]' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-['Sora'] text-lg font-semibold tracking-normal">Notification Center</h2>
                <p className={`text-xs ${muted}`}>Approvals, alerts, and workflow events</p>
              </div>
              <button type="button" title="Close notifications" onClick={() => updateAppState({ notificationDrawerOpen: false })} className="rounded-md p-2 transition duration-200 hover:bg-white/10 active:scale-95">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {['All', 'Finance', 'HR', 'Operations', 'System'].map((tab) => (
                <button key={tab} type="button" className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold transition duration-200 hover:border-cyan-300/50 hover:text-cyan-200 active:scale-95">
                  {tab}
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-3">
              {appState.notifications.map((item) => (
                <div key={item.title} className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-4 text-cyan-50">
                  <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.16em]">
                    <span>{item.category}</span>
                    <span>{item.time}</span>
                  </div>
                  <div className="mt-2 font-semibold">{item.title}</div>
                  <button type="button" className="mt-3 rounded-md border border-cyan-300/30 px-3 py-1.5 text-xs font-semibold transition duration-200 hover:bg-cyan-300/15 active:scale-95">
                    Review
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {payrollConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
          <div className={`w-full max-w-md rounded-lg border p-5 ${panel}`}>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-300/15 p-3 text-amber-100"><Banknote size={22} /></div>
              <div>
                <h2 className="font-['Sora'] text-lg font-semibold tracking-normal">Run payroll batch?</h2>
                <p className={`mt-1 text-sm leading-6 ${muted}`}>This will process 5 sampled employees for the Jun 1-15 pay period and mark the batch ready for bank export.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPayrollConfirm(false)} className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold transition duration-200 hover:bg-white/10 active:scale-95">Cancel</button>
              <button type="button" onClick={() => setPayrollConfirm(false)} className="rounded-md bg-[#c9a84c] px-4 py-2 text-sm font-bold text-[#0a0f1e] transition duration-200 hover:bg-cyan-300 active:scale-95">Confirm run</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const NexusErpWorkspace = UnifiedERPWorkspace
