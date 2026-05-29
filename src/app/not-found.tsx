'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import ErrorLayout from '@/components/error/ErrorLayout'

export default function NotFound() {
  return (
    <ErrorLayout
      title="RESOURCE NOT FOUND"
      subtitle="The requested resource does not exist or has been relocated. The system has scanned all available routes."
      code="404"
      showDiagnostics={false}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 2.5 }}
        className="mt-6"
      >
        <Link
          href="/"
          className="inline-block px-8 py-3 rounded-lg font-mono text-sm font-semibold tracking-wider transition-all duration-300 border-2 no-underline"
          style={{
            color: '#22d3ee',
            borderColor: 'rgba(34,211,238,0.3)',
            background: 'rgba(34,211,238,0.05)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(34,211,238,0.6)'
            e.currentTarget.style.background = 'rgba(34,211,238,0.1)'
            e.currentTarget.style.boxShadow = '0 0 30px rgba(34,211,238,0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(34,211,238,0.3)'
            e.currentTarget.style.background = 'rgba(34,211,238,0.05)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          ← RETURN TO OPERATIONS CENTER
        </Link>
      </motion.div>
    </ErrorLayout>
  )
}
