import type { Metadata } from 'next'
import { Bodoni_Moda, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const bodoniModa = Bodoni_Moda({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-bodoni',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'HOUSEHOLD',
  description: 'A house. A frequency. A way of moving.',
  icons: { icon: '/household-wordmark-white.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodoniModa.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
