import type { Metadata } from 'next'

import LegalDocumentPage from '@/components/legal/LegalDocumentPage'
import { legalPages } from '@/lib/legal-documents'

export const metadata: Metadata = {
  title: 'Cookie Policy | TASKIT',
  description: legalPages.cookies.description,
}

export default function CookiesPage() {
  return <LegalDocumentPage document={legalPages.cookies} />
}

