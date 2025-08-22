import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: "Github Username Validator",
  description: "Validate, detect duplicates, and identify invalid Github accounts in BULK.",
  creator: 'Rohan Sharma',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Github Username Validator',
    siteName: 'rss-to-markdown',
    url: 'https://bulk-gh-username-validator.vercel.app/',
    description:
      'Validate, detect duplicates, and identify invalid Github accounts in BULK',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Github Username Validator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Github Username Validator',
    description:
      'Validate, detect duplicates, and identify invalid Github accounts in BULK',
    images: ['/og-image.png'],
  },
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
