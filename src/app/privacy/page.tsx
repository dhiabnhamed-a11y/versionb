import type { Metadata } from 'next'

import LegalDocumentPage from '@/components/legal/LegalDocumentPage'
import { legalPages } from '@/lib/legal-documents'

export const metadata: Metadata = {
  title: 'Privacy Policy | TASKIT',
  description: legalPages.privacy.description,
}

export default function PrivacyPage() {
  return <LegalDocumentPage document={legalPages.privacy} />
}

