'use client'

import { Construction } from 'lucide-react'

export default function HRPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground" style={{ minHeight: '60vh' }}>
      <Construction size={48} />
      <h2 className="text-xl font-semibold">HR & Payroll</h2>
      <p className="text-sm">Employee management and payroll processing is being set up.</p>
    </div>
  )
}
