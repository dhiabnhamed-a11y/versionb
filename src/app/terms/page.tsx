import type { Metadata } from 'next'

import LegalDocumentPage from '@/components/legal/LegalDocumentPage'
import { FaqSchema } from '@/components/seo/FaqSchema'
import { legalPages } from '@/lib/legal-documents'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: legalPages.terms.description,
  openGraph: {
    title: 'Terms of Service — TASKIT OS',
    description: legalPages.terms.description,
  },
}

export default function TermsPage() {
  return (
    <>
      <FaqSchema
        items={[
          { question: 'What are the terms for using TASKIT?', answer: 'TASKIT provides an agency operations platform under a subscription model. Full terms are outlined in this document.' },
          { question: 'Can I cancel my subscription anytime?', answer: 'Yes. You can cancel your subscription at any time. No contracts or hidden fees.' },
          { question: 'Who owns the data I put into TASKIT?', answer: 'You retain full ownership of all data, content, and intellectual property you upload to TASKIT.' },
        ]}
      />
      <LegalDocumentPage document={legalPages.terms} />
    </>
  )
}

