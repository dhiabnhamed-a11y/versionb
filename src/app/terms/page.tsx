import type { Metadata } from 'next'

import LegalDocumentPage from '@/components/legal/LegalDocumentPage'
import { legalPages } from '@/lib/legal-documents'

export const metadata: Metadata = {
  title: 'Terms of Service | TASKIT',
  description: legalPages.terms.description,
}

export default function TermsPage() {
  return <LegalDocumentPage document={legalPages.terms} />
}

