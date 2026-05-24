'use client'

import { Construction } from 'lucide-react'

export default function ReportsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground" style={{ minHeight: '60vh' }}>
      <Construction size={48} />
      <h2 className="text-xl font-semibold">Financial Reports</h2>
      <p className="text-sm">P&L, Balance Sheet, and Cash Flow reports are being set up.</p>
    </div>
  )
}
