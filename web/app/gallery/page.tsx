'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { humanSize, humanDuration, fileIcon } from '@/lib/crypto'
import type { Share } from '@/lib/types'
import MountainSilhouette from '@/components/MountainSilhouette'
import AtmosphericParticles from '@/components/AtmosphericParticles'
import { Button } from '@/components/ui/button'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function GalleryPage() {
  const router = useRouter()
  const [shares, setShares] = useState<Share[]>([])
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)

  // ScrollTrigger stagger for gallery cards
  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.batch('.scroll-card', {
        onEnter: (batch) => {
          gsap.from(batch, {
            opacity: 0,
            y: 30,
            stagger: 0.08,
            duration: 0.6,
            ease: 'power2.out',
          })
        },
        start: 'top 88%',
      })
    })
    return () => ctx.revert()
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
      <AtmosphericParticles />
      <MountainSilhouette />
      <div className="mist-layer" />

      <div className="gallery-wrapper relative z-[2] max-w-[1200px] mx-auto px-6 py-8 min-h-screen">
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
          <div className="text-center p-12 text-dim italic">
            Searching the depths…
          </div>
        ) : shares.length === 0 ? (
          <div className="vault-empty fade-in-up">
            <span className="vault-empty-glyph">🚪</span>
            <h2 className="vault-empty-title">The halls are empty.</h2>
            <p className="vault-empty-sub">No artifacts remain within the vault.<br />Share a file to light the dark.</p>
            <div className="mt-10">
              <Link href="/" className="btn-portal no-underline flex items-center justify-center max-w-[240px] mx-auto">
                <span className="btn-rune">🚪</span> Open the Door
              </Link>
            </div>
          </div>
        ) : (
          <div className="scroll-grid">
            {shares.map((share) => (
              <div key={share.id} className="scroll-card">
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
                    <span className="scroll-stat-value text-[0.75rem]">AES-256-GCM</span>
                  </div>
                </div>

                <div className="scroll-footer">
                  <span className="scroll-rune-bar">· ᚱ ᛁ ᚾ ·</span>
                  <div className="flex gap-2 items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(share.id, share.storage_path)}
                      className="bg-transparent border border-danger/30 text-[#c05050] rounded-[3px] py-0.5 px-2 text-[0.7rem] cursor-pointer transition-all duration-200 hover:text-[#e06060] hover:border-danger"
                    >
                      Revoke
                    </Button>
                    <Link href={`/d/${share.id}`} className="scroll-enter-hint no-underline">Open →</Link>
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

