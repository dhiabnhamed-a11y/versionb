import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { CommandCenterDashboard } from '@/components/erp/CommandCenterDashboard'

export default async function CommandCenterPage() {
  const session = await auth()
  const companyId = session!.user.companyId!

  const [totalAccounts, totalJournalEntries, totalPurchaseOrders, totalEmployees] = await Promise.all([
    prisma.eRPAccount.count({ where: { workspaceId: companyId, isDeleted: false } }),
    prisma.eRPJournalEntry.count({ where: { workspaceId: companyId, isDeleted: false } }),
    prisma.eRPPurchaseOrder.count({ where: { workspaceId: companyId, isDeleted: false } }),
    prisma.eRPEmployee.count({ where: { workspaceId: companyId, isDeleted: false } }),
  ])

  return (
    <CommandCenterDashboard
      totalAccounts={totalAccounts}
      totalJournalEntries={totalJournalEntries}
      totalPurchaseOrders={totalPurchaseOrders}
      totalEmployees={totalEmployees}
    />
  )
}
