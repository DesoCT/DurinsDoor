import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
