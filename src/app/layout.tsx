import '../../styles/globals.css'
import type { Metadata } from 'next'
import { Caveat } from 'next/font/google'
import Navbar from '@/shared/components/Navbar'
import { ToastProvider } from '@/shared/components/Toast'
import SmoothScroll from '@/shared/components/SmoothScroll'
import { AudioPlayerProvider } from '@/shared/contexts/AudioPlayerContext'
import FloatingAudioPlayer from '@/shared/components/FloatingAudioPlayer'
import UploadProgressBar from '@/shared/components/UploadProgressBar'

const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
  display: 'swap',
})

// Use env var so OG URLs work correctly in staging and local environments
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://koregous.vercel.app'

export const metadata: Metadata = {
  title: 'Roomlet - Roomlet. Curate your corner of the internet',
  description: 'Create collections for your photos, projects, artwork, and interests. Share everything that matters to you in one profile.',
  authors: [{ name: 'Roomlet' }],
  creator: 'Roomlet',
  publisher: 'Roomlet',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Roomlet - Curate your corner of the internet',
    description: 'Create collections for your photos, projects, artwork, and interests. Share everything that matters to you in one profile.',
    images: [
      {
        url: `${SITE_URL}/preview-card.png`,
        width: 1200,
        height: 630,
        alt: 'Roomlet - Curated collections and showcases',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Roomlet - Roomlet. Curate your corner of the internet',
    description: 'Create collections for your photos, projects, artwork, and interests. Share everything that matters to you in one profile.',
    images: [`${SITE_URL}/preview-card.png`],
  },
  metadataBase: new URL(SITE_URL),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={caveat.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <AudioPlayerProvider>
          <ToastProvider>
            <SmoothScroll />
            <Navbar />
            {children}
            <FloatingAudioPlayer />
            <UploadProgressBar />
          </ToastProvider>
        </AudioPlayerProvider>
      </body>
    </html>
  )
}