import Link from 'next/link'
import { CheckCircle2, ArrowRight } from 'lucide-react'

export default function BillingSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center max-w-md w-full">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">You&apos;re all set!</h1>
        <p className="text-slate-500 mb-8">
          Your subscription is now active. Welcome to TASKIT — let&apos;s get to work.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/billing"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm"
          >
            View billing details
          </Link>
        </div>
      </div>
    </div>
  )
}
