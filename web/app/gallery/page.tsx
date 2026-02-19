'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { humanSize, humanDuration, fileIcon } from '@/lib/crypto'
import type { Share } from '@/lib/types'
import StarCanvas from '@/components/StarCanvas'

export default function GalleryPage() {
  const router = useRouter()
  const [shares, setShares] = useState<Share[]>([])
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Stars
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const cx = cv.getContext('2d'); if (!cx) return
    let W = 0, H = 0, stars: { x: number; y: number; r: number; phase: number; speed: number; blue: boolean }[] = [], frame = 0, rafId: number
    function resize() {
      if (!cv) return
      W = cv!.width = window.innerWidth; H = cv!.height = window.innerHeight; stars = []
      for (let i = 0; i < 200; i++) stars.push({ x: Math.random() * W, y: Math.random() * H * 0.7, r: Math.random() * 1.3 + 0.2, phase: Math.random() * Math.PI * 2, speed: 0.004 + Math.random() * 0.016, blue: Math.random() < 0.2 })
    }
    function draw() {
      cx!.clearRect(0, 0, W, H); frame++
      for (const s of stars) {
        const lum = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(s.phase + frame * s.speed))
        cx!.fillStyle = s.blue ? `rgba(150,210,255,${lum})` : `rgba(215,205,185,${lum * 0.85})`
        cx!.beginPath(); cx!.arc(s.x, s.y, s.r, 0, Math.PI * 2); cx!.fill()
      }
      rafId = requestAnimationFrame(draw)
    }
    window.addEventListener('resize', resize, { passive: true }); resize(); draw()
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize) }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setAuthed(true)
      const { data: shareData } = await supabase
        .from('shares')
        .select('*')
        .eq('created_by', data.user.id)
        .order('created_at', { ascending: false })
      setShares((shareData ?? []) as Share[])
      setLoading(false)
    })
  }, [router])

  async function handleDelete(id: string, storagePath: string) {
    if (!confirm('Seal this portal forever? This cannot be undone.')) return
    const supabase = createClient()
    await supabase.storage.from('encrypted-files').remove([storagePath])
    await supabase.from('shares').delete().eq('id', id)
    setShares(prev => prev.filter(s => s.id !== id))
  }

  function expiryClass(share: Share): string {
    if (!share.expires_at) return 'expiry-fresh'
    const ms = new Date(share.expires_at).getTime() - Date.now()
    return ms < 3600000 ? 'expiry-warn' : 'expiry-fresh'
  }

  function expiryStr(share: Share): string {
    if (!share.expires_at) return '∞'
    return humanDuration(new Date(share.expires_at).getTime() - Date.now())
  }

  return (
    <>
      <canvas id="stars-canvas" ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
      <MountainSilhouette />
      <div className="mist-layer" />

      <div className="gallery-wrapper">
        <nav className="gallery-nav">
          <Link href="/" className="gallery-back">← Durin&apos;s Door</Link>
          {shares.length > 0 && (
            <span className="share-count-badge">
              <strong>{shares.length}</strong> artifact{shares.length !== 1 ? 's' : ''} within the vault
            </span>
          )}
          <Link href="/guide" className="gallery-back">The Lore-Book →</Link>
        </nav>

        <header className="gallery-header fade-in-up">
          <svg className="gallery-arch-icon" width="72" height="88" viewBox="0 0 72 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs><filter id="gs2"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <path fill="#0d1525" stroke="#2a3a5c" strokeWidth="1.2" fillRule="evenodd" d="M 0 96 L 0 0 L 72 0 L 72 96 Z M 12 94 L 12 52 Q 10 16 36 10 Q 62 16 60 52 L 60 94 Z"/>
            <path fill="#060910" d="M 12 94 L 12 52 Q 10 16 36 10 Q 62 16 60 52 L 60 94 Z"/>
            <path fill="none" stroke="var(--gold)" strokeWidth="1" opacity="0.7" d="M 12 52 Q 10 16 36 10 Q 62 16 60 52"/>
            <ellipse cx="36" cy="94" rx="22" ry="5" fill="rgba(107,197,255,0.25)">
              <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2.8s" repeatCount="indefinite"/>
            </ellipse>
            <g filter="url(#gs2)" transform="translate(36,46)">
              <line x1="0" y1="-14" x2="0" y2="14" stroke="var(--silver-glow)" strokeWidth="1.1"/>
              <line x1="-14" y1="0" x2="14" y2="0" stroke="var(--silver-glow)" strokeWidth="1.1"/>
              <line x1="-10" y1="-10" x2="10" y2="10" stroke="var(--silver-glow)" strokeWidth="0.9"/>
              <line x1="10" y1="-10" x2="-10" y2="10" stroke="var(--silver-glow)" strokeWidth="0.9"/>
              <circle r="3" fill="var(--silver-glow)"/>
            </g>
          </svg>
          <h1 className="gallery-title">The Vaults of Durin</h1>
          <p className="gallery-subtitle">All open portals — artifacts awaiting their bearer</p>
          <p className="gallery-rune-bar">· · ᚠ ᚢ ᚱ ᚨ ᛊ ᛏ ᛁ ᛜ · ·</p>
        </header>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
            Searching the depths…
          </div>
        ) : shares.length === 0 ? (
          <div className="vault-empty fade-in-up">
            <span className="vault-empty-glyph">🚪</span>
            <h2 className="vault-empty-title">The halls are empty.</h2>
            <p className="vault-empty-sub">No artifacts remain within the vault.<br />Share a file to light the dark.</p>
            <div style={{ marginTop: '2.5rem' }}>
              <Link href="/" className="btn-portal" style={{ maxWidth: '240px', margin: '0 auto', textDecoration: 'none', display: 'flex' }}>
                <span className="btn-rune">🚪</span> Open the Door
              </Link>
            </div>
          </div>
        ) : (
          <div className="scroll-grid">
            {shares.map((share, i) => (
              <div key={share.id} className="scroll-card fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                {share.password_hash && <span className="scroll-lock">🔑</span>}

                <div className="scroll-top">
                  <span className="scroll-file-icon">{fileIcon(share.filename)}</span>
                  <span className="scroll-filename">{share.filename}</span>
                </div>

                <div className="scroll-body">
                  <div className="scroll-stat">
                    <span className="scroll-stat-label">Size</span>
                    <span className="scroll-stat-value">{humanSize(share.size_bytes)}</span>
                  </div>
                  <div className="scroll-stat">
                    <span className="scroll-stat-label">Expires In</span>
                    <span className={`scroll-stat-value ${expiryClass(share)}`}>{expiryStr(share)}</span>
                  </div>
                  <div className="scroll-stat">
                    <span className="scroll-stat-label">Downloads</span>
                    <span className="scroll-stat-value">
                      {share.max_downloads ? `${share.download_count} / ${share.max_downloads}` : `${share.download_count} (∞)`}
                    </span>
                  </div>
                  <div className="scroll-stat">
                    <span className="scroll-stat-label">Encryption</span>
                    <span className="scroll-stat-value" style={{ fontSize: '0.75rem' }}>AES-256-GCM</span>
                  </div>
                </div>

                <div className="scroll-footer">
                  <span className="scroll-rune-bar">· ᚱ ᛁ ᚾ ·</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={() => handleDelete(share.id, share.storage_path)}
                      style={{ background: 'transparent', border: '1px solid rgba(192,57,43,0.3)', color: '#c05050', borderRadius: '3px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseOver={e => { (e.target as HTMLElement).style.color = '#e06060'; (e.target as HTMLElement).style.borderColor = 'var(--danger)' }}
                      onMouseOut={e => { (e.target as HTMLElement).style.color = '#c05050'; (e.target as HTMLElement).style.borderColor = 'rgba(192,57,43,0.3)' }}
                    >
                      Revoke
                    </button>
                    <Link href={`/d/${share.id}`} className="scroll-enter-hint" style={{ textDecoration: 'none' }}>Open →</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function MountainSilhouette() {
  return (
    <svg className="mountain-silhouette" viewBox="0 0 1400 130" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><linearGradient id="mountFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a0e1a" stopOpacity="0"/><stop offset="55%" stopColor="#080c16" stopOpacity="0.7"/><stop offset="100%" stopColor="#050810" stopOpacity="1"/></linearGradient></defs>
      <path d="M0 130 L0 90 L60 55 L110 75 L170 32 L230 62 L290 20 L360 58 L430 35 L500 70 L570 15 L640 55 L700 30 L760 65 L830 10 L890 50 L950 25 L1020 60 L1080 38 L1140 70 L1200 22 L1260 55 L1320 40 L1380 68 L1400 50 L1400 130 Z" fill="#07090f"/>
      <rect x="0" y="0" width="1400" height="130" fill="url(#mountFade)"/>
    </svg>
  )
}
