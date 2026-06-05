import type { Metadata } from 'next'

import LegalDocumentPage from '@/components/legal/LegalDocumentPage'
import { FaqSchema } from '@/components/seo/FaqSchema'
import { legalPages } from '@/lib/legal-documents'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: legalPages.cookies.description,
  openGraph: {
    title: 'Cookie Policy — TASKIT OS',
    description: legalPages.cookies.description,
  },
}

export default function CookiesPage() {
  return (
    <>
      <FaqSchema
        items={[
          { question: 'What cookies does TASKIT use?', answer: 'TASKIT uses essential session cookies for authentication, preference cookies for locale and theme, and optional analytics cookies if enabled.' },
          { question: 'Can I disable cookies?', answer: 'Yes. You can disable cookies in your browser settings, but some features may not function properly without them.' },
          { question: 'Does TASKIT use third-party cookies?', answer: 'TASKIT uses minimal third-party cookies only for payment processing (Stripe) and optional analytics.' },
        ]}
      />
      <LegalDocumentPage document={legalPages.cookies} />
    </>
  )
}

