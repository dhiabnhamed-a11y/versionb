import { prisma } from '@/lib/db'
import { isAgencyCompanyType, normalizeCompanyType } from '@/lib/company-types'
import { getWorkspaceAiContext, getWorkspaceBlueprint } from '@/lib/workspace-routing'
import { canManageFinance, canManageWorkspace } from '@/modules/permissions/permissions'
import { okJson, withApiError } from '@/modules/shared/api'
import { requireSessionUser } from '@/modules/shared/session'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

const COMMON_CURRENCIES = ['USD', 'EUR', 'TND', 'GBP', 'CAD', 'AUD']

export const GET = withApiHandler(async ({ req, params }) => {
return withApiError(async () => {
const user = await requireSessionUser()
const companyId = user.companyId

if (!companyId) {
  const companyType = normalizeCompanyType(user.companyType)
  const blueprint = getWorkspaceBlueprint(companyType)
  return okJson({
    companyType,
    workspaceSurface: blueprint.surface,
    workspaceModules: blueprint.modules,
    aiContext: getWorkspaceAiContext({ companyType, role: user.role }),
    canManageWorkspace: false,
    canManageFinance: false,
    clients: [],
    campaigns: [],
    categories: [],
    managers: [],
    rooms: [],
    currencies: COMMON_CURRENCIES.map((currency) => ({ value: currency, label: currency })),
    invoiceLocales: [
      { value: 'en', label: 'English' },
      { value: 'ar', label: 'Arabic' },
    ],
    clientStatuses: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  })
}

const mayManageWorkspace = canManageWorkspace(user)
const mayManageFinance = canManageFinance(user)
const companyType = normalizeCompanyType(user.companyType)
const blueprint = getWorkspaceBlueprint(companyType)
const employeeProjectWhere = user.role === 'EMPLOYEE' ? { tasks: { some: { assigneeId: user.id } } } : {}

const [clients, campaigns, categories, managers, rooms, invoiceCurrencies] = await Promise.all([
  mayManageWorkspace || mayManageFinance
    ? prisma.client.findMany({
        where: { companyId },
        select: {
          id: true,
          companyName: true,
          email: true,
          status: true,
        },
        orderBy: [{ status: 'asc' }, { companyName: 'asc' }],
        take: 150,
      })
    : Promise.resolve([]),
  prisma.project.findMany({
    where: {
      companyId,
      ...employeeProjectWhere,
    },
    select: {
      id: true,
      title: true,
      clientId: true,
      clientName: true,
      categoryId: true,
      client: { select: { companyName: true } },
      category: { select: { name: true } },
    },
    orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
    take: 150,
  }),
  isAgencyCompanyType(companyType) && mayManageWorkspace
    ? prisma.projectCategory.findMany({
        where: { companyId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 80,
      })
    : Promise.resolve([]),
  mayManageWorkspace
    ? prisma.user.findMany({
        where: {
          companyId,
          accountStatus: 'ACTIVE',
          role: { in: ['OWNER', 'MANAGER'] },
        },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
        take: 80,
      })
    : Promise.resolve([]),
  mayManageWorkspace
    ? prisma.room.findMany({
        where: { companyId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 80,
      })
    : Promise.resolve([]),
  mayManageFinance
    ? prisma.invoice.findMany({
        where: { companyId },
        distinct: ['currency'],
        select: { currency: true },
        orderBy: { currency: 'asc' },
        take: 20,
      })
    : Promise.resolve([]),
])

return okJson({
  companyType,
  workspaceSurface: blueprint.surface,
  workspaceModules: blueprint.modules,
  aiContext: getWorkspaceAiContext({ companyType, role: user.role }),
  canManageWorkspace: mayManageWorkspace,
  canManageFinance: mayManageFinance,
  clients: clients.map((client) => ({
    value: client.id,
    label: client.companyName,
    description: [client.email, client.status].filter(Boolean).join(' / '),
  })),
  campaigns: campaigns.map((campaign) => ({
    value: campaign.id,
    label: campaign.title,
    description: [campaign.client?.companyName ?? campaign.clientName, campaign.category?.name].filter(Boolean).join(' / '),
    clientId: campaign.clientId,
    clientName: campaign.client?.companyName ?? campaign.clientName,
  })),
  categories: categories.map((category) => ({
    value: category.id,
    label: category.name,
  })),
  managers: managers.map((manager) => ({
    value: manager.id,
    label: manager.name,
    description: manager.role,
  })),
  rooms: rooms.map((room) => ({
    value: room.id,
    label: room.name,
  })),
  currencies: Array.from(new Set([...invoiceCurrencies.map((invoice) => invoice.currency), ...COMMON_CURRENCIES])).map((currency) => ({
    value: currency,
    label: currency,
  })),
  invoiceLocales: [
    { value: 'en', label: 'English' },
    { value: 'ar', label: 'Arabic' },
  ],
  clientStatuses: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ],
})
})
}, { auth: 'required' });
