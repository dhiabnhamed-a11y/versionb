import type { Metadata } from 'next'

import LegalDocumentPage from '@/components/legal/LegalDocumentPage'
import { legalPages } from '@/lib/legal-documents'

export const metadata: Metadata = {
  title: 'Acceptable Use Policy | TASKIT',
  description: legalPages['acceptable-use'].description,
}

export default function AcceptableUsePage() {
  return <LegalDocumentPage document={legalPages['acceptable-use']} />
}

