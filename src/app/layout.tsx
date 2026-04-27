import type { Metadata, Viewport } from 'next'
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google'
import PWARegistration from '@/components/pwa/PWARegistration'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'TASKIT | Industry, agency, and team workspaces',
  description:
    'A polished workspace for industry teams, digital agencies, and standard project teams with projects, tasks, uploads, and real-time alerts.',
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
  themeColor: '#0a2231',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${fraunces.variable} ${plusJakartaSans.variable}`}>
      <body>
        <PWARegistration />
        {children}
      </body>
    </html>
  )
}
