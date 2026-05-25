'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from 'lucide-react'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useLocale } from '@/components/i18n/LocaleProvider'
import { tErp, translateErpStatus, translateModuleConfig, translateColumnLabel, translateActionLabel, translateHeaderActionLabel, translateSecondaryColumnLabel, formatErpMoney, formatErpDate, formatErpNumber } from '@/components/erp/erpLocale'
import type { AppLocale } from '@/lib/i18n'

type ModuleName =
  | 'general-ledger'
  | 'accounts-receivable'
  | 'accounts-payable'
  | 'budgets'
  | 'procurement'
  | 'inventory'
  | 'hr'
  | 'leave'
  | 'reports'
  | 'settings'
  | 'roles'

type Option = { label: string; value: string; meta?: string }
type Metric = { label: string; value: number | string; format?: string; tone?: string }
type Row = Record<string, unknown> & { id: string }
type Field = {
  name: string
  label: string
  type: 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox'
  required?: boolean
  optionKey?: string
  options?: Option[]
  defaultValue?: string | boolean | number
  placeholder?: string
}
type Column = { key: string; label: string; format?: 'money' | 'date' | 'status' | 'number' | 'percent' | 'text' }
type RowAction = {
  label: string
  action: string
  tone?: 'primary' | 'neutral' | 'danger'
  prompt?: string
  promptField?: string
  fixed?: Record<string, unknown>
}
type HeaderAction = RowAction & { id: string }
type ModuleConfig = {
  title: string
  description: string
  createLabel?: string
  noCreate?: boolean
  mutationMethod?: 'POST' | 'PATCH'
  fields?: Field[]
  columns: Column[]
  actions?: RowAction[]
  headerActions?: HeaderAction[]
  secondaryTitle?: string
  secondaryColumns?: Column[]
  statusOptions?: string[]
}
type ModulePayload = {
  module: ModuleName
  metrics: Metric[]
  rows: Row[]
  secondaryRows?: Row[]
  options?: Record<string, Option[]>
  insights?: string[]
  generatedAt: string
}

const today = () => new Date().toISOString().slice(0, 10)
const nextMonth = () => {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}
const endOfYear = () => `${new Date().getFullYear()}-12-31`
const startOfYear = () => `${new Date().getFullYear()}-01-01`

const CONFIG: Record<ModuleName, ModuleConfig> = {
  'general-ledger': {
    title: 'General Ledger',
    description: 'Double-entry journal entries, chart of accounts, posting, and ledger integrity.',
    createLabel: 'New journal entry',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: today() },
      { name: 'description', label: 'Description', type: 'text', required: true, placeholder: 'Client payment, vendor bill, bank fee...' },
      { name: 'reference', label: 'Reference', type: 'text', placeholder: 'Bank ref, invoice number, receipt' },
      { name: 'debitAccountId', label: 'Debit account', type: 'select', optionKey: 'accounts', required: true },
      { name: 'creditAccountId', label: 'Credit account', type: 'select', optionKey: 'accounts', required: true },
      { name: 'amount', label: 'Amount', type: 'number', required: true, placeholder: '1200.00' },
      { name: 'postNow', label: 'Post immediately', type: 'checkbox', defaultValue: true },
    ],
    columns: [
      { key: 'entryNumber', label: 'Entry' },
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'description', label: 'Description' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'amount', label: 'Amount', format: 'money' },
      { key: 'lines', label: 'Lines' },
    ],
    actions: [{ label: 'Post', action: 'post', tone: 'primary' }],
    statusOptions: ['DRAFT', 'POSTED', 'REVERSED'],
  },
  'accounts-receivable': {
    title: 'Accounts Receivable',
    description: 'Customer balances, collections, overdue exposure, and cash-flow impact.',
    createLabel: 'New receivable',
    fields: [
      { name: 'clientId', label: 'Client', type: 'select', optionKey: 'clients' },
      { name: 'clientName', label: 'Client name', type: 'text', required: true },
      { name: 'clientEmail', label: 'Client email', type: 'email' },
      { name: 'invoiceRef', label: 'Invoice ref', type: 'text' },
      { name: 'amount', label: 'Amount', type: 'number', required: true },
      { name: 'dueDate', label: 'Due date', type: 'date', required: true, defaultValue: nextMonth() },
    ],
    columns: [
      { key: 'clientName', label: 'Client' },
      { key: 'invoiceRef', label: 'Invoice' },
      { key: 'dueDate', label: 'Due', format: 'date' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'amount', label: 'Amount', format: 'money' },
      { key: 'balance', label: 'Balance', format: 'money' },
    ],
    actions: [{ label: 'Record payment', action: 'record-payment', prompt: 'Payment amount', promptField: 'amount', tone: 'primary' }],
    statusOptions: ['OPEN', 'PARTIAL', 'PAID', 'OVERDUE'],
  },
  'accounts-payable': {
    title: 'Accounts Payable',
    description: 'Vendor bills, approvals, payments, and payable exposure.',
    createLabel: 'New vendor bill',
    fields: [
      { name: 'vendorId', label: 'Existing vendor', type: 'select', optionKey: 'vendors' },
      { name: 'vendorName', label: 'Vendor name', type: 'text', required: true },
      { name: 'vendorEmail', label: 'Vendor email', type: 'email' },
      { name: 'billNumber', label: 'Bill number', type: 'text', required: true },
      { name: 'amount', label: 'Amount', type: 'number', required: true },
      { name: 'issueDate', label: 'Issue date', type: 'date', required: true, defaultValue: today() },
      { name: 'dueDate', label: 'Due date', type: 'date', required: true, defaultValue: nextMonth() },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
    columns: [
      { key: 'vendorName', label: 'Vendor' },
      { key: 'billNumber', label: 'Bill' },
      { key: 'dueDate', label: 'Due', format: 'date' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'amount', label: 'Amount', format: 'money' },
      { key: 'balance', label: 'Balance', format: 'money' },
    ],
    actions: [
      { label: 'Approve', action: 'approve', tone: 'primary' },
      { label: 'Pay', action: 'pay', prompt: 'Payment amount (leave blank for full balance)', promptField: 'amount', tone: 'neutral' },
    ],
    secondaryTitle: 'Active vendors',
    secondaryColumns: [
      { key: 'name', label: 'Vendor' },
      { key: 'email', label: 'Email' },
    ],
    statusOptions: ['PENDING', 'APPROVED', 'PAID', 'OVERDUE'],
  },
  budgets: {
    title: 'Budgets & Forecasting',
    description: 'Budget plans, account-level variance, and financial control thresholds.',
    createLabel: 'New budget',
    fields: [
      { name: 'name', label: 'Budget name', type: 'text', required: true },
      { name: 'accountCode', label: 'Account', type: 'select', optionKey: 'accounts', required: true },
      { name: 'monthlyAmount', label: 'Monthly amount', type: 'number', required: true },
      { name: 'startDate', label: 'Start date', type: 'date', required: true, defaultValue: startOfYear() },
      { name: 'endDate', label: 'End date', type: 'date', required: true, defaultValue: endOfYear() },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'DRAFT',
        options: ['DRAFT', 'APPROVED', 'ACTIVE'].map((value) => ({ value, label: value })),
      },
    ],
    columns: [
      { key: 'name', label: 'Budget' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'startDate', label: 'Start', format: 'date' },
      { key: 'endDate', label: 'End', format: 'date' },
      { key: 'amount', label: 'Budgeted', format: 'money' },
      { key: 'actual', label: 'Actual', format: 'money' },
    ],
    actions: [
      { label: 'Approve', action: 'approve', tone: 'primary' },
      { label: 'Activate', action: 'activate', tone: 'primary' },
      { label: 'Close', action: 'close', tone: 'neutral' },
    ],
    statusOptions: ['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED'],
  },
  procurement: {
    title: 'Procurement',
    description: 'Purchase orders, vendor commitments, approvals, and receiving.',
    createLabel: 'New purchase order',
    fields: [
      { name: 'vendorId', label: 'Existing vendor', type: 'select', optionKey: 'vendors' },
      { name: 'vendorName', label: 'Vendor name', type: 'text', required: true },
      { name: 'description', label: 'Line item', type: 'text', required: true },
      { name: 'quantity', label: 'Quantity', type: 'number', required: true, defaultValue: 1 },
      { name: 'unitPrice', label: 'Unit price', type: 'number', required: true, defaultValue: 0 },
      { name: 'unit', label: 'Unit', type: 'text', placeholder: 'piece, hour, license' },
      { name: 'expectedDate', label: 'Expected date', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      { key: 'poNumber', label: 'PO' },
      { key: 'vendorName', label: 'Vendor' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'totalAmount', label: 'Total', format: 'money' },
      { key: 'expectedDate', label: 'Expected', format: 'date' },
      { key: 'lines', label: 'Lines' },
    ],
    actions: [
      { label: 'Approve', action: 'approve', tone: 'primary' },
      { label: 'Receive', action: 'receive', tone: 'neutral' },
    ],
    statusOptions: ['SUBMITTED', 'APPROVED', 'FULLY_RECEIVED', 'CLOSED', 'CANCELLED'],
  },
  inventory: {
    title: 'Inventory & Assets',
    description: 'Stock levels, reorder risks, inventory valuation, and asset book value.',
    createLabel: 'New inventory item',
    fields: [
      { name: 'sku', label: 'SKU', type: 'text', required: true },
      { name: 'name', label: 'Item name', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'unit', label: 'Unit', type: 'text', defaultValue: 'piece' },
      { name: 'currentStock', label: 'Opening stock', type: 'number', defaultValue: 0 },
      { name: 'reorderPoint', label: 'Reorder point', type: 'number', defaultValue: 0 },
      { name: 'reorderQty', label: 'Reorder quantity', type: 'number', defaultValue: 0 },
      { name: 'unitCost', label: 'Unit cost', type: 'number', defaultValue: 0 },
    ],
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Item' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'currentStock', label: 'Stock', format: 'number' },
      { key: 'reorderPoint', label: 'Reorder', format: 'number' },
      { key: 'inventoryValue', label: 'Value', format: 'money' },
      { key: 'lastMovement', label: 'Last move', format: 'date' },
    ],
    actions: [{ label: 'Adjust stock', action: 'adjust-stock', prompt: 'Stock adjustment quantity (use negative to reduce)', promptField: 'quantity', tone: 'primary' }],
    secondaryTitle: 'Fixed assets',
    secondaryColumns: [
      { key: 'name', label: 'Asset' },
      { key: 'category', label: 'Category' },
      { key: 'purchaseDate', label: 'Purchased', format: 'date' },
      { key: 'currentBookValue', label: 'Book value', format: 'money' },
      { key: 'status', label: 'Status', format: 'status' },
    ],
  },
  hr: {
    title: 'HR & Payroll',
    description: 'Employee records, compensation, department assignment, and payroll runs.',
    createLabel: 'New employee',
    fields: [
      { name: 'employeeNumber', label: 'Employee number', type: 'text', required: true },
      { name: 'firstName', label: 'First name', type: 'text', required: true },
      { name: 'lastName', label: 'Last name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'jobTitle', label: 'Job title', type: 'text', required: true },
      { name: 'departmentId', label: 'Department', type: 'select', optionKey: 'departments' },
      { name: 'startDate', label: 'Start date', type: 'date', required: true, defaultValue: today() },
      {
        name: 'contractType',
        label: 'Contract type',
        type: 'select',
        defaultValue: 'FULL_TIME',
        options: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].map((value) => ({ value, label: value })),
      },
      { name: 'baseSalary', label: 'Base salary', type: 'number', required: true },
    ],
    columns: [
      { key: 'employeeNumber', label: 'No.' },
      { key: 'name', label: 'Employee' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'jobTitle', label: 'Role' },
      { key: 'department', label: 'Department' },
      { key: 'baseSalary', label: 'Salary', format: 'money' },
      { key: 'startDate', label: 'Start', format: 'date' },
    ],
    actions: [{ label: 'Toggle active', action: 'toggle-active', tone: 'neutral' }],
    headerActions: [{ id: 'payroll', label: 'Generate payroll', action: 'generate-payroll', tone: 'primary' }],
    secondaryTitle: 'Payroll runs',
    secondaryColumns: [
      { key: 'runNumber', label: 'Run' },
      { key: 'period', label: 'Period' },
      { key: 'payDate', label: 'Pay date', format: 'date' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'totalNet', label: 'Net pay', format: 'money' },
    ],
  },
  leave: {
    title: 'Leave Management',
    description: 'Leave requests, approvals, balance protection, and manager decisions.',
    createLabel: 'New leave request',
    fields: [
      { name: 'employeeId', label: 'Employee', type: 'select', optionKey: 'employees', required: true },
      {
        name: 'type',
        label: 'Leave type',
        type: 'select',
        required: true,
        options: ['ANNUAL', 'SICK', 'UNPAID', 'MATERNITY', 'PATERNITY', 'OTHER'].map((value) => ({ value, label: value })),
      },
      { name: 'startDate', label: 'Start date', type: 'date', required: true, defaultValue: today() },
      { name: 'endDate', label: 'End date', type: 'date', required: true, defaultValue: today() },
      { name: 'reason', label: 'Reason', type: 'textarea' },
    ],
    columns: [
      { key: 'employeeName', label: 'Employee' },
      { key: 'type', label: 'Type' },
      { key: 'startDate', label: 'Start', format: 'date' },
      { key: 'endDate', label: 'End', format: 'date' },
      { key: 'days', label: 'Days', format: 'number' },
      { key: 'status', label: 'Status', format: 'status' },
    ],
    actions: [
      { label: 'Approve', action: 'approve', tone: 'primary' },
      { label: 'Reject', action: 'reject', tone: 'danger' },
    ],
    statusOptions: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
  },
  reports: {
    title: 'Reports',
    description: 'Income statement, balance sheet, working capital, budget variance, and cash forecast.',
    noCreate: true,
    columns: [
      { key: 'report', label: 'Report' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'revenue', label: 'Revenue', format: 'money' },
      { key: 'expenses', label: 'Expenses', format: 'money' },
      { key: 'netIncome', label: 'Net income', format: 'money' },
      { key: 'netWorkingCapital', label: 'Working capital', format: 'money' },
      { key: 'variance', label: 'Variance', format: 'money' },
    ],
    secondaryTitle: '30-day cash forecast',
    secondaryColumns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'expected', label: 'Expected', format: 'money' },
      { key: 'optimistic', label: 'Optimistic', format: 'money' },
      { key: 'pessimistic', label: 'Pessimistic', format: 'money' },
      { key: 'inflows', label: 'Inflows', format: 'money' },
      { key: 'outflows', label: 'Outflows', format: 'money' },
    ],
  },
  settings: {
    title: 'ERP Settings',
    description: 'Currency, fiscal periods, tax rates, setup progress, and accounting controls.',
    createLabel: 'New tax rate',
    fields: [
      { name: 'name', label: 'Tax name', type: 'text', required: true, placeholder: 'VAT, Sales tax' },
      { name: 'rate', label: 'Rate %', type: 'number', required: true },
      {
        name: 'appliesTo',
        label: 'Applies to',
        type: 'select',
        defaultValue: 'BOTH',
        options: ['INCOME', 'EXPENSE', 'BOTH'].map((value) => ({ value, label: value })),
      },
    ],
    columns: [
      { key: 'name', label: 'Tax rate' },
      { key: 'rate', label: 'Rate', format: 'percent' },
      { key: 'appliesTo', label: 'Applies to' },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'createdAt', label: 'Created', format: 'date' },
    ],
    secondaryTitle: 'Fiscal periods',
    secondaryColumns: [
      { key: 'name', label: 'Period' },
      { key: 'startDate', label: 'Start', format: 'date' },
      { key: 'endDate', label: 'End', format: 'date' },
      { key: 'status', label: 'Status', format: 'status' },
    ],
  },
  roles: {
    title: 'Roles & Permissions',
    description: 'Workspace members, role assignment, and ERP permission boundaries.',
    noCreate: true,
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', format: 'status' },
      { key: 'createdAt', label: 'Joined', format: 'date' },
    ],
    actions: [
      { label: 'Make owner', action: 'set-role', fixed: { role: 'OWNER' }, tone: 'danger' },
      { label: 'Make manager', action: 'set-role', fixed: { role: 'MANAGER' }, tone: 'primary' },
      { label: 'Make employee', action: 'set-role', fixed: { role: 'EMPLOYEE' }, tone: 'neutral' },
    ],
  },
}

function defaultFormState(fields: Field[] = []) {
  return fields.reduce<Record<string, string | boolean | number>>((acc, field) => {
    acc[field.name] = field.defaultValue ?? (field.type === 'checkbox' ? false : '')
    return acc
  }, {})
}

function formatCell(value: unknown, column: Column, locale: AppLocale, currency = 'USD') {
  if (value === null || value === undefined || value === '') return '-'
  if (column.format === 'money' && typeof value === 'number') {
    return formatErpMoney(value, locale, currency)
  }
  if (column.format === 'date') {
    return formatErpDate(String(value), locale)
  }
  if (column.format === 'number' && typeof value === 'number') return formatErpNumber(value, locale)
  if (column.format === 'percent' && typeof value === 'number') return `${value.toFixed(2)}%`
  return String(value)
}

function statusColor(value: unknown) {
  const status = String(value ?? '').toUpperCase()
  if (['PAID', 'POSTED', 'ACTIVE', 'APPROVED', 'FULLY_RECEIVED', 'OK', 'HEALTHY', 'BALANCED', 'ON_PLAN', 'POSITIVE'].includes(status)) {
    return { background: '#f0fdf4', color: '#166534', border: '#bbf7d0' }
  }
  if (['OVERDUE', 'LOW_STOCK', 'LOSS', 'OVER_BUDGET', 'TIGHT', 'CRITICAL', 'REJECTED'].includes(status)) {
    return { background: '#fef2f2', color: '#991b1b', border: '#fecaca' }
  }
  return { background: '#fffbeb', color: '#92400e', border: '#fde68a' }
}

function renderCell(row: Row, column: Column, locale: AppLocale) {
  const value = row[column.key]
  if (column.format === 'status') {
    const style = statusColor(value)
    return (
      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '999px', border: `1px solid ${style.border}`, background: style.background, color: style.color, fontSize: '11px', fontWeight: 700 }}>
        {translateErpStatus(locale, String(formatCell(value, column, locale)))}
      </span>
    )
  }
  return formatCell(value, column, locale)
}

function actionStyle(tone: RowAction['tone']) {
  if (tone === 'danger') return { background: '#fef2f2', color: '#991b1b', border: '#fecaca' }
  if (tone === 'primary') return { background: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
  return { background: '#fff', color: '#475569', border: '#e2e8f0' }
}

export function ErpOperationalModule({ module }: { module: ModuleName }) {
  const { locale } = useLocale()
  const config = CONFIG[module]
  const tc = translateModuleConfig(locale, module, config)
  const [payload, setPayload] = useState<ModulePayload | null>(null)
  const [form, setForm] = useState<Record<string, string | boolean | number>>(() => defaultFormState(config.fields))
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(!config.noCreate)

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (status.trim()) params.set('status', status.trim())
    const suffix = params.toString()
    return `/api/v1/erp2/modules/${module}${suffix ? `?${suffix}` : ''}`
  }, [module, query, status])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(endpoint, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Unable to load ERP module')
      setPayload(body.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ERP module')
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useRealtimeSubscription(
    ['workspace_event', 'finance.journal_entry.created', 'finance.journal_entry.posted', 'notification.created'],
    () => void fetchData(),
    { debounceMs: 500, pollingIntervalMs: 30_000 }
  )

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const method = config.mutationMethod ?? 'POST'
      const response = await fetch(`/api/v1/erp2/modules/${module}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(form),
      })
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Unable to save record')
      setForm(defaultFormState(config.fields))
      await fetchData()
      if (window.innerWidth < 860) setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save record')
    } finally {
      setSubmitting(false)
    }
  }

  const runAction = async (row: Row | { id: string }, action: RowAction) => {
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { id: row.id, action: action.action, ...(action.fixed ?? {}) }
      if (action.prompt && action.promptField) {
        const value = window.prompt(action.prompt)
        if (value === null) return
        if (value.trim()) body[action.promptField] = value
      }
      const response = await fetch(`/api/v1/erp2/modules/${module}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? 'Unable to update record')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update record')
    } finally {
      setSubmitting(false)
    }
  }

  const optionsFor = (field: Field) => field.options ?? (field.optionKey ? payload?.options?.[field.optionKey] ?? [] : [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{tc.title}</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>{tc.description}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {config.headerActions?.map((action) => {
            const styles = actionStyle(action.tone)
            return (
              <button
                key={action.action}
                type="button"
                onClick={() => void runAction({ id: action.id }, action)}
                disabled={submitting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: `1px solid ${styles.border}`, background: styles.background, color: styles.color, borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
              >
                <Sparkles size={14} />
                {translateHeaderActionLabel(locale, action.label)}
              </button>
            )
          })}
          {!config.noCreate && (
            <button
              type="button"
              onClick={() => setShowForm((value) => !value)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              <Plus size={14} />
              {tc.createLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => void fetchData()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
          >
            <RefreshCw size={14} />
            {tErp(locale, 'refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginBottom: '16px' }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {(payload?.metrics ?? []).map((metric) => {
          const color = metric.tone === 'critical' ? '#dc2626' : metric.tone === 'warning' ? '#d97706' : metric.tone === 'good' ? '#16a34a' : '#334155'
          return (
            <div key={metric.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{metric.label}</div>
              <div style={{ color, fontSize: '18px', fontWeight: 700, marginTop: '6px' }}>{formatCell(metric.value, { key: 'value', label: metric.label, format: metric.format === 'money' ? 'money' : metric.format === 'percent' ? 'percent' : metric.format === 'number' ? 'number' : 'text' }, locale)}</div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showForm && !config.noCreate ? 'minmax(280px, 360px) 1fr' : '1fr', gap: '16px', alignItems: 'start' }}>
        {showForm && !config.noCreate && (
          <form onSubmit={submitForm} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', display: 'grid', gap: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{tc.createLabel}</div>
            {(config.fields ?? []).map((field) => {
              const fieldOptions = optionsFor(field)
              return (
                <label key={field.name} style={{ display: 'grid', gap: '5px', fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  {translateColumnLabel(locale, field.label)}
                  {field.type === 'select' ? (
                    <select
                      value={String(form[field.name] ?? '')}
                      required={field.required}
                      onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: '#0f172a', background: '#fff' }}
                    >
                      <option value="">{field.required ? tErp(locale, 'selectRequired') : tErp(locale, 'selectOptional')}</option>
                      {fieldOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {translateErpStatus(locale, option.label)}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={String(form[field.name] ?? '')}
                      placeholder={field.placeholder}
                      onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      rows={3}
                      style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: '#0f172a', resize: 'vertical' }}
                    />
                  ) : field.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(form[field.name])}
                      onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.checked }))}
                      style={{ width: '18px', height: '18px' }}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={String(form[field.name] ?? '')}
                      required={field.required}
                      placeholder={field.placeholder}
                      step={field.type === 'number' ? '0.01' : undefined}
                      onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: '#0f172a' }}
                    />
                  )}
                </label>
              )
            })}
            <button type="submit" disabled={submitting} style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '8px', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#fff', padding: '10px 12px', fontSize: '13px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {tErp(locale, 'save')}
            </button>
          </form>
        )}

        <section style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 260px', minWidth: 0, border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
              <Search size={15} color="#64748b" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tErp(locale, 'searchRecords')} style={{ border: 'none', outline: 'none', flex: 1, minWidth: 0, fontSize: '13px' }} />
            </label>
            {config.statusOptions && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
                <Filter size={15} color="#64748b" />
                <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ border: 'none', outline: 'none', fontSize: '13px', background: '#fff' }}>
                  <option value="">{tErp(locale, 'allStatuses')}</option>
                  {config.statusOptions.map((value) => (
                    <option key={value} value={value}>
                      {translateErpStatus(locale, value)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: '8px', fontSize: '13px' }}>
                <Loader2 size={18} className="animate-spin" />
                {tErp(locale, 'loading')} {tc.title.toLowerCase()}...
              </div>
            ) : (payload?.rows ?? []).length === 0 ? (
              <div style={{ minHeight: '220px', display: 'grid', placeItems: 'center', color: '#64748b', textAlign: 'center', padding: '24px' }}>
                <div>
                  <CheckCircle2 size={28} color="#16a34a" style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{tErp(locale, 'noRecordsTitle')}</div>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>{tErp(locale, 'noRecordsBody')}</div>
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {config.columns.map((column) => (
                        <th key={column.key} style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{translateColumnLabel(locale, column.label)}</th>
                      ))}
                      {config.actions && <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{tErp(locale, 'actions')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(payload?.rows ?? []).map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {config.columns.map((column) => (
                          <td key={column.key} style={{ padding: '11px 12px', color: '#334155', verticalAlign: 'top', maxWidth: column.key === 'lines' ? '260px' : undefined }}>
                            {renderCell(row, column, locale)}
                          </td>
                        ))}
                        {config.actions && (
                          <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {config.actions.map((action) => {
                                const styles = actionStyle(action.tone)
                                return (
                                  <button
                                    key={action.action + action.label}
                                    type="button"
                                    onClick={() => void runAction(row, action)}
                                    disabled={submitting}
                                    style={{ border: `1px solid ${styles.border}`, background: styles.background, color: styles.color, borderRadius: '6px', padding: '5px 8px', fontSize: '11px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
                                  >
                                    {translateActionLabel(locale, action.label)}
                                  </button>
                                )
                              })}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {payload?.insights && payload.insights.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                <Sparkles size={15} color="#2563eb" />
                {tErp(locale, 'operationalIntelligence')}
              </div>
              {payload.insights.map((insight) => (
                <div key={insight} style={{ fontSize: '13px', color: '#475569' }}>
                  {insight}
                </div>
              ))}
            </div>
          )}

          {config.secondaryColumns && payload?.secondaryRows && payload.secondaryRows.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #e2e8f0' }}>{tc.secondaryTitle || config.secondaryTitle}</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <tbody>
                    {payload.secondaryRows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {config.secondaryColumns!.map((column) => (
                          <td key={column.key} style={{ padding: '10px 12px', color: '#334155' }}>
                            {renderCell(row, column, locale)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
