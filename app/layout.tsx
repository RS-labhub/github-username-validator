import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: "GitHub Username Validator",
  description: "Validate, detect duplicates, and identify invalid GitHub accounts in bulk.",
  creator: 'Rohan Sharma',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'GitHub Username Validator',
    siteName: 'github-username-validator',
    url: 'https://bulk-gh-username-validator.vercel.app/',
    description:
      'Validate, detect duplicates, and identify invalid GitHub accounts in bulk.',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GitHub Username Validator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GitHub Username Validator',
    description:
      'Validate, detect duplicates, and identify invalid GitHub accounts in bulk.',
    images: ['/og-image.png'],
  },
}


export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  )
}
