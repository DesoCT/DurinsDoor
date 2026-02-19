import { createClient } from '@/lib/supabase/server'
import { humanSize, humanDuration, fileIcon } from '@/lib/crypto'
import type { Share } from '@/lib/types'
import DownloadClient from './DownloadClient'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DownloadPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: share, error } = await supabase
    .from('shares')
    .select('*')
    .eq('id', id)
    .single()

  // Error states
  if (error || !share) {
    return <DownloadError message="This portal does not exist or has already closed." />
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return <DownloadError message="This portal has expired. The door is sealed." />
  }

  if (share.max_downloads && share.download_count >= share.max_downloads) {
    return <DownloadError message="This portal has reached its download limit. The door is sealed." />
  }

  const msLeft = share.expires_at ? new Date(share.expires_at).getTime() - Date.now() : null
  const downloadsLeft = share.max_downloads ? share.max_downloads - share.download_count : null

  return (
    <DownloadClient
      share={share as Share}
      humanSizeStr={humanSize(share.size_bytes)}
      expiresIn={msLeft !== null ? humanDuration(msLeft) : '∞'}
      fileIconStr={fileIcon(share.filename)}
      downloadsLeft={downloadsLeft}
    />
  )
}

function DownloadError({ message }: { message: string }) {
  return (
    <>
      <canvas id="stars-canvas" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
      <div className="mist-layer" />
      <div className="page-wrapper">
        <div style={{ marginBottom: '1.5rem', opacity: 0.55 }}>
          <SmallArch />
        </div>
        <div className="download-card fade-in-up">
          <div className="error-card">
            <span className="error-glyph">🚪</span>
            <h1 className="error-title">The Door is Sealed</h1>
            <p className="error-message">{message}</p>
            <Link href="/" className="btn-portal" style={{ maxWidth: '220px', margin: '0 auto', textDecoration: 'none', display: 'flex' }}>
              <span className="btn-rune">↩</span> Return Home
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

function SmallArch() {
  return (
    <svg width="60" height="72" viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="gs">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path fill="#0d1525" stroke="#2a3a5c" strokeWidth="1" fillRule="evenodd"
        d="M 0 80 L 0 0 L 60 0 L 60 80 Z M 10 78 L 10 42 Q 9 12 30 8 Q 51 12 50 42 L 50 78 Z"/>
      <path fill="#060910" d="M 10 78 L 10 42 Q 9 12 30 8 Q 51 12 50 42 L 50 78 Z"/>
      <path fill="none" stroke="var(--gold)" strokeWidth="0.8" opacity="0.6" d="M 10 42 Q 9 12 30 8 Q 51 12 50 42"/>
      <g filter="url(#gs)" transform="translate(30,36)">
        <line x1="0" y1="-10" x2="0" y2="10" stroke="var(--silver-glow)" strokeWidth="0.9"/>
        <line x1="-10" y1="0" x2="10" y2="0" stroke="var(--silver-glow)" strokeWidth="0.9"/>
        <line x1="-7" y1="-7" x2="7" y2="7" stroke="var(--silver-glow)" strokeWidth="0.8"/>
        <line x1="7" y1="-7" x2="-7" y2="7" stroke="var(--silver-glow)" strokeWidth="0.8"/>
        <circle r="2" fill="var(--silver-glow)"/>
      </g>
    </svg>
  )
}
