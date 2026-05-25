import { auth } from '@/lib/auth'
import { CommandCenterDashboard } from '@/components/erp/CommandCenterDashboard'
import { getErpCommandCenter } from '@/services/erp2'

export default async function CommandCenterPage() {
  const session = await auth()
  const data = await getErpCommandCenter(session!.user)

  return (
    <CommandCenterDashboard
      totalAccounts={data.totals.totalAccounts}
      totalJournalEntries={data.totals.totalJournalEntries}
      totalPurchaseOrders={data.totals.totalPurchaseOrders}
      totalEmployees={data.totals.totalEmployees}
      metrics={data.metrics}
      operations={data.operations}
      recentActivity={data.recentActivity}
    />
  )
}
