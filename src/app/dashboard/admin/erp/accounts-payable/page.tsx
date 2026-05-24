'use client'

import { Construction } from 'lucide-react'

export default function AccountsPayablePage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground" style={{ minHeight: '60vh' }}>
      <Construction size={48} />
      <h2 className="text-xl font-semibold">Accounts Payable</h2>
      <p className="text-sm">Vendor bills and payment tracking are being set up.</p>
    </div>
  )
}
