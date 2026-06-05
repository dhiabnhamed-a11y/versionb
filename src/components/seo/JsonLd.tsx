const appUrl = typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_APP_URL || 'https://taskit.app')

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'TASKIT',
  url: appUrl,
  logo: `${appUrl}/icons/taskit-512.png`,
  description:
    'All-in-one agency operations platform combining project management, client portal, invoicing, AI workflow automation, and real-time team collaboration.',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'sales',
    email: 'hello@taskit.app',
  },
  sameAs: [
    'https://twitter.com/taskit',
    'https://linkedin.com/company/taskit',
  ],
}

const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'TASKIT OS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'All-in-one agency operations platform combining project management, client portal, invoicing, AI workflow automation, and real-time team collaboration.',
  url: appUrl,
  offers: {
    '@type': 'Offer',
    price: '19',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
  author: {
    '@type': 'Organization',
    name: 'TASKIT',
    url: appUrl,
  },
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'TASKIT OS',
  url: appUrl,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${appUrl}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}

const schemas = [organizationSchema, softwareSchema, websiteSchema]

export function JsonLd() {
  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  )
}
