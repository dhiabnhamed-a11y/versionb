import type { Metadata } from 'next'

import LegalDocumentPage from '@/components/legal/LegalDocumentPage'
import { legalPages } from '@/lib/legal-documents'

export const metadata: Metadata = {
  title: 'AI Transparency Policy | TASKIT',
  description: legalPages['ai-transparency'].description,
}

export default function AiTransparencyPage() {
  return <LegalDocumentPage document={legalPages['ai-transparency']} />
}

