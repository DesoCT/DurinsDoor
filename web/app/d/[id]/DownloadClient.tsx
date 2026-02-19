'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { decryptFile, triggerDownload, hashPassword } from '@/lib/crypto'
import type { Share } from '@/lib/types'
import StarCanvas from '@/components/StarCanvas'

interface Props {
  share: Share
  humanSizeStr: string
  expiresIn: string
  fileIconStr: string
  downloadsLeft: number | null
}

type DlState = 'idle' | 'verifying' | 'fetching' | 'decrypting' | 'done' | 'error'

export default function DownloadClient({ share, humanSizeStr, expiresIn, fileIconStr, downloadsLeft }: Props) {
  const [dlState, setDlState] = useState<DlState>('idle')
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [progress, setProgress] = useState(0)
  const [noKey, setNoKey] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Stars animation
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const cx = cv.getContext('2d')
    if (!cx) return
    let W = 0, H = 0
    let stars: { x: number; y: number; r: number; phase: number; speed: number; blue: boolean }[] = []
    let frame = 0
    let rafId: number
    function resize() {
      if (!cv) return
      W = cv!.width = window.innerWidth; H = cv!.height = window.innerHeight
      stars = []
      for (let i = 0; i < 160; i++) stars.push({ x: Math.random() * W, y: Math.random() * H * 0.65, r: Math.random() * 1.2 + 0.2, phase: Math.random() * Math.PI * 2, speed: 0.005 + Math.random() * 0.015, blue: Math.random() < 0.2 })
    }
    function draw() {
      if (!cx) return
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

  async function handleDownload() {
    // Extract key from URL fragment
    const hash = window.location.hash
    const keyMatch = hash.match(/[#&]key=([^&]+)/)
    const keyB64 = keyMatch?.[1] ?? null

    if (!keyB64) {
      setNoKey(true)
      setErrorMsg('No decryption key found in the URL. The link may be incomplete.')
      setDlState('error')
      return
    }

    // Password verification
    if (share.password_hash) {
      if (!password) { setPasswordError('Please enter the password.'); return }
      setDlState('verifying')
      try {
        const pwHash = await hashPassword(password)
        const res = await fetch('/api/verify-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareId: share.id, passwordHash: pwHash }),
        })
        if (!res.ok) {
          const data = await res.json()
          setPasswordError('That is not the word. The door remains shut.')
          setDlState('idle')
          setProgress(0)
          return
        }
      } catch {
        setPasswordError('Failed to verify password. Try again.')
        setDlState('idle')
        return
      }
    }

    // Download encrypted blob
    setDlState('fetching')
    setProgress(20)
    try {
      const supabase = createClient()
      const { data: blobData, error: dlError } = await supabase.storage
        .from('encrypted-files')
        .download(share.storage_path)

      if (dlError || !blobData) throw dlError ?? new Error('Download failed')

      setProgress(60)
      setDlState('decrypting')

      const buffer = await blobData.arrayBuffer()
      const decrypted = await decryptFile(buffer, keyB64)

      setProgress(100)

      // Increment download count
      await supabase
        .from('shares')
        .update({ download_count: (share.download_count ?? 0) + 1 })
        .eq('id', share.id)

      triggerDownload(decrypted, share.filename, share.content_type ?? 'application/octet-stream')
      setDlState('done')
    } catch (err: unknown) {
      setDlState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Decryption failed. The key may be invalid.')
    }
  }

  return (
    <>
      <canvas id="stars-canvas" ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
      <div className="mist-layer" />

      <div className="page-wrapper">
        {/* Small arch watermark */}
        <div style={{ marginBottom: '1.5rem', opacity: 0.55 }}>
          <svg width="60" height="72" viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
            <defs><filter id="gs"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <path fill="#0d1525" stroke="#2a3a5c" strokeWidth="1" fillRule="evenodd" d="M 0 80 L 0 0 L 60 0 L 60 80 Z M 10 78 L 10 42 Q 9 12 30 8 Q 51 12 50 42 L 50 78 Z"/>
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
        </div>

        {dlState === 'error' ? (
          <div className="download-card fade-in-up">
            <div className="error-card">
              <span className="error-glyph">🌑</span>
              <h1 className="error-title">The Door Would Not Open</h1>
              <p className="error-message">{errorMsg}</p>
              <Link href="/" className="btn-portal" style={{ maxWidth: '220px', margin: '0 auto', textDecoration: 'none', display: 'flex' }}>
                <span className="btn-rune">↩</span> Return Home
              </Link>
            </div>
          </div>
        ) : dlState === 'done' ? (
          <div className="download-card fade-in-up" style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>✦</span>
            <p style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', fontSize: '1.1rem', marginBottom: '1rem' }}>
              The vault has yielded its secret.
            </p>
            <p style={{ color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              {share.filename} has been decrypted and delivered to your device.
            </p>
            <Link href="/" style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>← Return to Durin&apos;s Door</Link>
          </div>
        ) : (
          <div className="download-card fade-in-up">
            {/* File icon + name */}
            <span className="file-icon">{fileIconStr}</span>
            <p className="file-name">{share.filename}</p>

            {/* Meta grid */}
            <div className="meta-grid">
              <div className="meta-item">
                <span className="meta-label">Size</span>
                <span className="meta-value">{humanSizeStr}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Expires In</span>
                <span className="meta-value">{expiresIn}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Encryption</span>
                <span className="meta-value">AES-256-GCM</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Downloads</span>
                <span className="meta-value">
                  {share.max_downloads ? `${share.download_count} / ${share.max_downloads}` : `${share.download_count} (∞)`}
                </span>
              </div>
            </div>

            {share.password_hash && (
              <div style={{ textAlign: 'center', marginBottom: '0.8rem' }}>
                <span className="badge badge-locked">🔑 Password Required</span>
              </div>
            )}

            <div className="rune-divider">· · ᚠ ᚢ ᚱ ᚨ · ·</div>

            {share.password_hash && (
              <div className="password-section">
                <span style={{ fontSize: '1.4rem', display: 'block', textAlign: 'center', marginBottom: '0.6rem' }}>🔐</span>
                <label htmlFor="password">Speak the word to open the door</label>
                <input
                  type="password"
                  id="password"
                  className="rune-input"
                  placeholder="Enter the password…"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setPasswordError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleDownload()}
                  autoComplete="current-password"
                />
                {passwordError && <p className="error-rune">✕ {passwordError}</p>}
              </div>
            )}

            <button
              className="btn-portal"
              onClick={handleDownload}
              disabled={dlState !== 'idle'}
            >
              {dlState === 'idle' && <><span className="btn-rune">⬇</span> {share.password_hash ? 'Speak & Receive the File' : 'Open the Door & Download'}</>}
              {dlState === 'verifying' && <><span className="btn-rune">🔑</span> Verifying the word…</>}
              {dlState === 'fetching' && <><span className="btn-rune">⚗️</span> Fetching from the vault…</>}
              {dlState === 'decrypting' && <><span className="btn-rune">⚙️</span> Decrypting…</>}
            </button>

            {/* Progress bar */}
            {(dlState === 'verifying' || dlState === 'fetching' || dlState === 'decrypting') && (
              <div className="download-progress visible" style={{ marginTop: '1.2rem' }}>
                <div className="progress-label">
                  {dlState === 'verifying' ? 'Verifying password…' : dlState === 'fetching' ? 'Fetching from vault…' : 'Decrypting…'}
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {downloadsLeft !== null && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '0.8rem', fontStyle: 'italic' }}>
                {downloadsLeft} download{downloadsLeft !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>
        )}

        <Link href="/" style={{ display: 'block', textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-dim)', fontSize: '0.8rem', opacity: 0.55 }}>
          ← Back to Durin&apos;s Door
        </Link>
      </div>
    </>
  )
}
