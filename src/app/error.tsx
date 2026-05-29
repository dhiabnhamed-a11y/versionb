'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import ErrorLayout from '@/components/error/ErrorLayout'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[CRITICAL] Page error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    })
  }, [error])

  return (
    <ErrorLayout
      title="CRITICAL SYSTEM FAILURE"
      subtitle="The application encountered an unexpected error. Recovery protocol has been initiated. Diagnostics are being collected."
      code="ERR_500"
      showRecovery
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 2.5 }}
        className="mt-6"
      >
        <button
          onClick={() => reset()}
          className="px-8 py-3 rounded-lg font-mono text-sm font-semibold tracking-wider transition-all duration-300 border-2"
          style={{
            color: '#6366f1',
            borderColor: 'rgba(99,102,241,0.3)',
            background: 'rgba(99,102,241,0.05)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'
            e.currentTarget.style.background = 'rgba(99,102,241,0.1)'
            e.currentTarget.style.boxShadow = '0 0 30px rgba(99,102,241,0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
            e.currentTarget.style.background = 'rgba(99,102,241,0.05)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          ↻ RESET APPLICATION
        </button>
      </motion.div>
    </ErrorLayout>
  )
}
