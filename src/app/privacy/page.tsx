import type { Metadata } from 'next'

import LegalDocumentPage from '@/components/legal/LegalDocumentPage'
import { FaqSchema } from '@/components/seo/FaqSchema'
import { legalPages } from '@/lib/legal-documents'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: legalPages.privacy.description,
  openGraph: {
    title: 'Privacy Policy — TASKIT OS',
    description: legalPages.privacy.description,
  },
}

export default function PrivacyPage() {
  return (
    <>
      <FaqSchema
        items={[
          { question: 'What personal data does TASKIT collect?', answer: 'TASKIT collects account identifiers, name, work email, role, company affiliation, authentication metadata, device and browser data, IP address, and workspace activity.' },
          { question: 'How does TASKIT protect my data?', answer: 'TASKIT uses TLS 1.3 encryption, bcrypt password hashing, MFA, session revocation, and role-based access controls to protect your data.' },
          { question: 'Does TASKIT sell my personal data?', answer: 'No. TASKIT does not sell personal data. We process data only to provide and improve our services.' },
          { question: 'How can I delete my data?', answer: 'Contact hello@taskit.app to request data deletion. We process deletion requests within 30 days.' },
        ]}
      />
      <LegalDocumentPage document={legalPages.privacy} />
    </>
  )
}

