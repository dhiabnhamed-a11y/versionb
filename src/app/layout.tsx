import type { Metadata, Viewport } from 'next'
import PWARegistration from '@/components/pwa/PWARegistration'
import ClientAnalyticsGuard from '@/components/analytics/ClientAnalyticsGuard.client'
import './globals.css'

export const metadata: Metadata = {
  title: 'TASKIT OS | Enterprise Operations Platform',
  description:
    'Enterprise-grade operations platform for agencies and teams — clients, projects, finance, AI, realtime alerts, and multi-tenant workspaces at scale.',
  metadataBase: process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : undefined,
  openGraph: {
    title: 'TASKIT OS',
    description: 'The operating system for modern agencies and operations teams.',
    type: 'website',
  },
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
}

export const viewport: Viewport = {
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
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <PWARegistration />
        <ClientAnalyticsGuard />
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
