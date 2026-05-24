'use client'

import { Construction } from 'lucide-react'

export default function BudgetsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground" style={{ minHeight: '60vh' }}>
      <Construction size={48} />
      <h2 className="text-xl font-semibold">Budgets & Forecasting</h2>
      <p className="text-sm">Budget planning and financial forecasting is being set up.</p>
    </div>
  )
}
