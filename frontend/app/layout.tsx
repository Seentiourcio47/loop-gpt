import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { ErrorBoundary } from './components/ErrorBoundary'
import Analytics from './components/Analytics'

const inter = Inter({ subsets: ['latin'] })

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://loop-gpt.cyou'
const TITLE = 'Loop GPT — The agentic AI chat portal'
const DESCRIPTION =
  'Deep research, vision, image and video generation, MCP connectors and a live Agent Computer — plus an OpenAI-compatible API for developers.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s · Loop GPT' },
  description: DESCRIPTION,
  applicationName: 'Loop GPT',
  keywords: [
    'AI chat', 'agentic AI', 'LLM API', 'image generation API', 'video generation API',
    'OpenAI-compatible API', 'deep research', 'MCP',
  ],
  authors: [{ name: 'Loop GPT' }],
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Loop GPT',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Loop GPT — the agentic AI chat portal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg', apple: '/favicon.svg' },
}

// viewport-fit=cover exposes the real iOS safe-area insets (notch/status bar +
// home indicator) so env(safe-area-inset-*) works in the fixed mobile drawers.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0b12',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Analytics />
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}

