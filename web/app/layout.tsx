import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import BalrogWhip from '@/components/BalrogWhip'
import SmoothScroll from '@/components/SmoothScroll'
import AtmosphericParticles from '@/components/AtmosphericParticles'
import './globals.css'
import './balrog-whip.css'

export const metadata: Metadata = {
  title: "Durin's Door — Encrypted File Sharing",
  description: 'Zero-knowledge encrypted file sharing. Files encrypted in your browser before they touch the server. Links expire. The door closes.',
  keywords: ['encrypted', 'file sharing', 'zero knowledge', 'privacy', 'secure'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AtmosphericParticles embers />
        <SmoothScroll />
        {children}
        <BalrogWhip />
        <Analytics />
      </body>
    </html>
  )
}
