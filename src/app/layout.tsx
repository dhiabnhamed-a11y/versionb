import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Fraunces } from 'next/font/google'
import PWARegistration from '@/components/pwa/PWARegistration'
import ClientAnalyticsGuard from '@/components/analytics/ClientAnalyticsGuard.client'
import { JsonLd } from '@/components/seo/JsonLd'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
  preload: true,
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  preload: false,
})

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://taskit.app'

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'TASKIT OS — Agency Operations Platform with AI, Billing & Client Portal',
    template: '%s | TASKIT OS',
  },
  description:
    'All-in-one agency operations platform combining project management, client portal, invoicing, AI workflow automation, and real-time team collaboration. Replace 5 tools with one.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/icons/taskit-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TASKIT',
  },
  alternates: {
    canonical: '/',
    languages: {
      en: '/',
      fr: '/fr',
      ar: '/ar',
    },
  },
  openGraph: {
    title: 'TASKIT OS — Agency Operations Platform with AI, Billing & Client Portal',
    description:
      'All-in-one agency operations platform combining project management, client portal, invoicing, AI workflow automation, and real-time team collaboration.',
    url: appUrl,
    siteName: 'TASKIT OS',
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['fr_FR', 'ar_AE'],
    images: [
      {
        url: `${appUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'TASKIT OS — Agency Operations Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TASKIT OS — Agency Operations Platform with AI, Billing & Client Portal',
    description:
      'All-in-one agency operations platform combining project management, client portal, invoicing, AI workflow automation, and real-time team collaboration.',
    images: [`${appUrl}/og-image.png`],
    creator: '@taskit',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#07090e',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${fraunces.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <PWARegistration />
        <ClientAnalyticsGuard />
        <JsonLd />
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-[var(--text-primary)] focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  )
}
