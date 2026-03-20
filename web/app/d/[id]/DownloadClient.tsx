'use client'

import { useState } from 'react'
import Link from 'next/link'

import { decryptFile, triggerDownload } from '@/lib/crypto'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import type { Share } from '@/lib/types'

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

    // For password-protected shares, use server-side proxy to prevent bypass
    if (share.password_hash) {
      if (!password) { setPasswordError('Please enter the password.'); return }
      setDlState('verifying')

      try {
        setDlState('fetching')
        setProgress(20)

        // Send plaintext password over HTTPS; server verifies with bcrypt.compare()
        // which supports both web-uploaded and CLI-uploaded (Go bcrypt) shares.
        const res = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareId: share.id, password }),
        })

        if (res.status === 401) {
          setPasswordError('That is not the word. The door remains shut.')
          setDlState('idle')
          setProgress(0)
          return
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Download failed' }))
          throw new Error(data.error || 'Download failed')
        }

        setProgress(60)
        setDlState('decrypting')

        const buffer = await res.arrayBuffer()
        const decrypted = await decryptFile(buffer, keyB64)
        setProgress(100)

        triggerDownload(decrypted, share.filename, share.content_type ?? 'application/octet-stream')
        setDlState('done')
      } catch (err: unknown) {
        setDlState('error')
        setErrorMsg(err instanceof Error ? err.message : 'Download failed')
      }
      return
    }

    // Non-password shares: also use server-side proxy for consistent
    // download counting (increments atomically before serving the blob)
    setDlState('fetching')
    setProgress(20)
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: share.id }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Download failed' }))
        throw new Error(data.error || 'Download failed')
      }

      setProgress(60)
      setDlState('decrypting')

      const buffer = await res.arrayBuffer()
      const decrypted = await decryptFile(buffer, keyB64)

      setProgress(100)

      triggerDownload(decrypted, share.filename, share.content_type ?? 'application/octet-stream')
      setDlState('done')
    } catch (err: unknown) {
      setDlState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Decryption failed. The key may be invalid.')
    }
  }

  return (
    <>
      <div className="mist-layer" />

      <div className="page-wrapper flex flex-col items-center justify-center min-h-[100dvh] relative z-[2] px-4 py-8">
        {/* Small arch watermark */}
        <div className="mb-6 opacity-55">
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
              <Link href="/" className="btn-portal no-underline flex items-center justify-center max-w-[220px] mx-auto">
                <span className="btn-rune">↩</span> Return Home
              </Link>
            </div>
          </div>
        ) : dlState === 'done' ? (
          <div className="download-card fade-in-up text-center">
            <span className="text-5xl block mb-4">✦</span>
            <p className="font-cinzel text-gold text-[1.1rem] mb-4">
              The vault has yielded its secret.
            </p>
            <p className="text-dim italic mb-6 text-[0.9rem]">
              {share.filename} has been decrypted and delivered to your device.
            </p>
            <Link href="/" className="text-silver text-[0.85rem]">← Return to Durin&apos;s Door</Link>
          </div>
        ) : (
          <div className="download-card fade-in-up">
            {/* File icon + name */}
            <span className="file-icon">{fileIconStr}</span>
            <p className="file-name">{share.filename}</p>

            {/* Meta grid */}
            <div className="meta-grid grid grid-cols-2 gap-x-4 gap-y-2">
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
              <div className="text-center mb-3">
                <span className="badge badge-locked">🔑 Password Required</span>
              </div>
            )}

            <div className="rune-divider">· · ᚠ ᚢ ᚱ ᚨ · ·</div>

            {share.password_hash && (
              <div className="password-section">
                <span className="text-[1.4rem] block text-center mb-2.5">🔐</span>
                <label htmlFor="password">Speak the word to open the door</label>
                <Input
                  type="password"
                  id="password"
                  placeholder="Enter the password…"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setPasswordError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleDownload()}
                  autoComplete="current-password"
                />
                {passwordError && <p className="error-rune">✕ {passwordError}</p>}
              </div>
            )}

            <Button
              variant="portal"
              onClick={handleDownload}
              disabled={dlState !== 'idle'}
            >
              {dlState === 'idle' && <><span className="btn-rune">⬇</span> {share.password_hash ? 'Speak & Receive the File' : 'Open the Door & Download'}</>}
              {dlState === 'verifying' && <><span className="btn-rune">🔑</span> Verifying the word…</>}
              {dlState === 'fetching' && <><span className="btn-rune">⚗️</span> Fetching from the vault…</>}
              {dlState === 'decrypting' && <><span className="btn-rune">⚙️</span> Decrypting…</>}
            </Button>

            {/* Progress bar */}
            {(dlState === 'verifying' || dlState === 'fetching' || dlState === 'decrypting') && (
              <div className="download-progress visible mt-5">
                <div className="progress-label">
                  {dlState === 'verifying' ? 'Verifying password…' : dlState === 'fetching' ? 'Fetching from vault…' : 'Decrypting…'}
                </div>
                <Progress value={progress} />
              </div>
            )}

            {downloadsLeft !== null && (
              <p className="text-[0.75rem] text-dim text-center mt-3 italic">
                {downloadsLeft} download{downloadsLeft !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>
        )}

        <Link href="/" className="block text-center mt-6 text-dim text-[0.8rem] opacity-55">
          ← Back to Durin&apos;s Door
        </Link>
      </div>
    </>
  )
}
