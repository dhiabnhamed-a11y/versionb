import type { Metadata } from 'next'

import LegalDocumentPage from '@/components/legal/LegalDocumentPage'
import { legalPages } from '@/lib/legal-documents'

export const metadata: Metadata = {
  title: 'Data Processing Addendum | TASKIT',
  description: legalPages.dpa.description,
}

export default function DpaPage() {
  return <LegalDocumentPage document={legalPages.dpa} />
}

