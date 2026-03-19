'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { encryptFile, humanSize, fileIcon } from '@/lib/crypto'
import MountainSilhouette from '@/components/MountainSilhouette'
import DoorSVG from '@/components/DoorSVG'
import AtmosphericParticles from '@/components/AtmosphericParticles'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import type { User } from '@supabase/supabase-js'

gsap.registerPlugin(SplitText)

type PageState =
  | 'idle'
  | 'dragging'
  | 'options'
  | 'uploading'
  | 'done'
  | 'error'

export default function HomePage() {
  const [state, setState] = useState<PageState>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [expiry, setExpiry] = useState('24h')
  const [maxDownloads, setMaxDownloads] = useState('0')
  const [shareUrl, setShareUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [uploadProgress, setUploadProgress] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const doorRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)

  // Check auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // GSAP SplitText title animation
  useEffect(() => {
    const title = titleRef.current
    const subtitle = subtitleRef.current
    if (!title || !subtitle) return

    const splitTitle = SplitText.create(title, { type: 'chars' })
    const splitSub = SplitText.create(subtitle, { type: 'words' })

    gsap.from(splitTitle.chars, {
      opacity: 0,
      y: 20,
      rotateX: -40,
      stagger: 0.04,
      duration: 0.8,
      ease: 'back.out(1.4)',
      delay: 0.3,
    })

    gsap.from(splitSub.words, {
      opacity: 0,
      y: 10,
      stagger: 0.08,
      duration: 0.6,
      ease: 'power2.out',
      delay: 0.9,
    })

    return () => {
      splitTitle.revert()
      splitSub.revert()
    }
  }, [])

  // Easter eggs
  useEffect(() => {
    // Konami code → Balrog
    const KONAMI = [38,38,40,40,37,39,37,39,66,65]
    let pos = 0
    function handleKonami(e: KeyboardEvent) {
      if (e.keyCode === KONAMI[pos]) { pos++; if (pos === KONAMI.length) { pos = 0; triggerBalrog() } }
      else pos = e.keyCode === KONAMI[0] ? 1 : 0
    }

    // Type "mellon"
    let buffer = ''
    function handleMellon(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      buffer = (buffer + e.key.toLowerCase()).slice(-8)
      if (buffer.includes('mellon')) { buffer = ''; triggerMellonType() }
    }

    // Shire leaf particles
    const leaf = document.getElementById('shire-leaf')
    let leafTimer: ReturnType<typeof setInterval> | null = null
    function spawnLeaves() {
      const leafChars = ['🍃','🌿','🍀','❧','✦']
      const leafRect = leaf?.getBoundingClientRect()
      if (!leafRect) return
      for (let i = 0; i < 3; i++) {
        const el = document.createElement('span')
        el.className = 'leaf-particle'
        el.textContent = leafChars[Math.floor(Math.random() * leafChars.length)]
        el.style.left = (leafRect.left + Math.random() * 30 - 5) + 'px'
        el.style.top = (leafRect.top + Math.random() * 10) + 'px'
        el.style.animationDuration = (2 + Math.random() * 1.5) + 's'
        document.body.appendChild(el)
        setTimeout(() => el.remove(), 4000)
      }
    }
    if (leaf) {
      leaf.addEventListener('mouseenter', () => { leafTimer = setInterval(spawnLeaves, 800) })
      leaf.addEventListener('mouseleave', () => { if (leafTimer) { clearInterval(leafTimer); leafTimer = null } })
    }

    document.addEventListener('keydown', handleKonami)
    document.addEventListener('keypress', handleMellon)
    return () => {
      document.removeEventListener('keydown', handleKonami)
      document.removeEventListener('keypress', handleMellon)
      if (leafTimer) clearInterval(leafTimer)
    }
  }, [])

  function triggerBalrog() {
    const overlay = document.getElementById('balrog-overlay')
    if (!overlay) return
    overlay.classList.remove('fade-out')
    overlay.classList.add('active')
    overlay.setAttribute('aria-hidden', 'false')
    setTimeout(() => {
      overlay.classList.add('fade-out')
      setTimeout(() => { overlay.classList.remove('active', 'fade-out'); overlay.setAttribute('aria-hidden', 'true') }, 1200)
    }, 2800)
  }

  function triggerMellonType() {
    const door = doorRef.current
    if (!door) return
    door.classList.remove('door-shimmer')
    void door.offsetWidth
    door.classList.add('door-shimmer')
    setTimeout(() => door.classList.remove('door-shimmer'), 2600)
  }

  // Star of Durin click counter
  const starClicksRef = useRef(0)
  const starBusyRef = useRef(false)

  function handleStarClick() {
    if (starBusyRef.current) return
    starClicksRef.current++
    if (starClicksRef.current >= 7) {
      starBusyRef.current = true
      showRingInscription()
      setTimeout(() => { starClicksRef.current = 0; starBusyRef.current = false }, 6000)
    }
  }

  function showRingInscription() {
    const el = document.getElementById('ring-inscription')
    if (!el) return
    el.classList.add('show')
    setTimeout(() => el.classList.remove('show'), 6000)
  }

  // Drag handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setState('dragging')
  }
  function handleDragLeave(e: React.DragEvent) {
    if (!doorRef.current?.contains(e.relatedTarget as Node)) setState('idle')
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (!dropped) return
    if (dropped.size > 50 * 1024 * 1024) { setState('error'); setErrorMsg('File too large. Max 50 MB.'); return }
    setFile(dropped)
    setState('options')
  }

  function handleDoorClick() {
    if (state === 'idle' || state === 'dragging') fileInputRef.current?.click()
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 50 * 1024 * 1024) { setState('error'); setErrorMsg('File too large. Max 50 MB.'); return }
    setFile(f)
    setState('options')
    e.target.value = ''
  }

  const handleUpload = useCallback(async () => {
    if (!file || !user) return
    setState('uploading')
    setUploadProgress('Reading file…')
    try {
      const buffer = await file.arrayBuffer()
      setUploadProgress('Encrypting…')
      const { blob, keyB64 } = await encryptFile(buffer)

      setUploadProgress('Sealing in the vault…')
      const supabase = createClient()
      const storagePath = `${user.id}/${crypto.randomUUID()}`
      const { error: uploadError } = await supabase.storage
        .from('encrypted-files')
        .upload(storagePath, blob, { contentType: 'application/octet-stream' })
      if (uploadError) throw uploadError

      // Expiry
      const expiryMs: Record<string, number> = { '1h': 3600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 }
      const expiresAt = expiry === 'never' ? null : new Date(Date.now() + expiryMs[expiry]).toISOString()

      // Password hash — computed server-side with bcrypt (cost 10) for CLI interop
      let pwHash: string | null = null
      if (password) {
        const hashRes = await fetch('/api/hash-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        })
        if (!hashRes.ok) throw new Error('Failed to hash password')
        const { hash } = await hashRes.json()
        pwHash = hash
      }

      const { data: share, error: dbError } = await supabase
        .from('shares')
        .insert({
          filename: file.name,
          size_bytes: file.size,
          content_type: file.type || 'application/octet-stream',
          storage_path: storagePath,
          password_hash: pwHash,
          max_downloads: parseInt(maxDownloads) || null,
          expires_at: expiresAt,
          created_by: user.id,
        })
        .select()
        .single()
      if (dbError) throw dbError

      setShareUrl(`${window.location.origin}/d/${share.id}#key=${keyB64}`)
      setState('done')
    } catch (err: unknown) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
    }
  }, [file, user, password, expiry, maxDownloads])

  function copyUrl() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function reset() {
    setState('idle')
    setFile(null)
    setPassword('')
    setExpiry('24h')
    setMaxDownloads('0')
    setShareUrl('')
    setErrorMsg('')
  }

  const doorClasses = [
    'door-container',
    state === 'dragging' ? 'dragging-over' : '',
    state === 'done' ? 'upload-done' : '',
    (state === 'idle' || state === 'dragging') ? 'active' : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      {/* ── Easter egg overlays ── */}
      <div id="balrog-overlay" aria-hidden="true">
        <div className="balrog-text">YOU SHALL NOT PASS</div>
        <div className="balrog-sub">— Gandalf the Grey, Bridge of Khazad-dûm</div>
        <div className="balrog-flame">🔥</div>
      </div>

      <div id="ring-inscription" aria-hidden="true">
        <p className="ring-text-line">One Ring to rule them all,</p>
        <p className="ring-text-line">One Ring to find them,</p>
        <p className="ring-text-line">One Ring to bring them all</p>
        <p className="ring-text-line">and in the darkness bind them.</p>
      </div>

      <div id="mellon-message" aria-hidden="true">
        <p className="mellon-msg-text">The way is shut…<br /><em>just kidding.</em><br />Welcome, friend. ✦</p>
        <span className="gandalf-silhouette">🧙</span>
      </div>

      <div id="hidden-ring" aria-hidden="true">◯<span className="ring-tooltip">My precious…</span></div>
      <div id="shire-leaf" aria-hidden="true">❧</div>
      <div id="shire-quote" aria-hidden="true">
        Not all those who wander are lost.<br />
        <span style={{ fontSize: '0.72rem', opacity: 0.6, display: 'block', marginTop: '0.4rem' }}>— J.R.R. Tolkien</span>
      </div>

      {/* ── Background ── */}
      <AtmosphericParticles embers />
      <MountainSilhouette />
      <div className="mist-layer" />

      {/* ── Hidden file input ── */}
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />

      <div className="page-wrapper">
        <div className="home-layout">

          {/* ── Left Pillar ── */}
          <nav className="pillar pillar-left fade-in-up fade-in-up-delay-3" aria-label="Left navigation">
            <div className="pillar-runes">ᚠ ᚢ ᚱ ᚨ</div>
            <div className="pillar-links">
              <Link href="/gallery" className="pillar-link">
                <span className="pillar-link-icon">ᚠ</span>
                <span className="pillar-link-label">The Vaults</span>
              </Link>
              <Link href="/guide" className="pillar-link">
                <span className="pillar-link-icon">ᚢ</span>
                <span className="pillar-link-label">Lore-Book</span>
              </Link>
            </div>
            <div className="pillar-runes">ᛊ ᛏ ᛁ ᛜ</div>
          </nav>

          {/* ── Center — Door + Title ── */}
          <div className="center-column">
            <div
              ref={doorRef}
              className={doorClasses}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleDoorClick}
              role="button"
              tabIndex={0}
              aria-label="Durin's Door — click or drop a file to share"
              onKeyDown={e => e.key === 'Enter' && handleDoorClick()}
            >
              <DoorSVG onStarClick={handleStarClick} />

              <div className="door-upload-overlay">
                <div className="upload-overlay-text">
                  ✦ Drop to seal in the vault ✦<br />
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{file ? humanSize(file.size) : ''}</span>
                </div>
              </div>

              <div className="door-glow" />
            </div>

            <h1 ref={titleRef} className="site-title">Durin&apos;s Door</h1>
            <p ref={subtitleRef} className="speak-friend">
              ✦ &thinsp; Speak, friend, and enter &thinsp; ✦
            </p>

            {/* ── Upload options panel ── */}
            {state === 'options' && file && (
              <div className="options-panel fade-in-up">
                <div className="options-file-name">
                  {fileIcon(file.name)} {file.name} <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>({humanSize(file.size)})</span>
                </div>

                {!user && (
                  <div className="auth-hint">
                    <Link href="/login" style={{ color: 'var(--silver)' }}>Sign in</Link> to upload, or use <Link href="/handshake/receive" style={{ color: 'var(--elvish)' }}>Handshake</Link> for anonymous transfer.
                  </div>
                )}

                {user && (
                  <>
                    <div className="options-grid">
                      <div>
                        <label className="form-label">Expiry</label>
                        <select className="rune-select" value={expiry} onChange={e => setExpiry(e.target.value)}>
                          <option value="1h">1 hour</option>
                          <option value="24h">24 hours</option>
                          <option value="7d">7 days</option>
                          <option value="30d">30 days</option>
                          <option value="never">Never</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Max Downloads</label>
                        <select className="rune-select" value={maxDownloads} onChange={e => setMaxDownloads(e.target.value)}>
                          <option value="0">Unlimited</option>
                          <option value="1">1 (one-time)</option>
                          <option value="5">5</option>
                          <option value="10">10</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">🔑 Password (optional)</label>
                      <input
                        type="password"
                        className="rune-input"
                        placeholder="Speak the word to protect…"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                      />
                    </div>

                    <div className="rune-divider">· · ᚠ ᚢ ᚱ ᚨ · ·</div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button className="btn-silver" style={{ flex: 1 }} onClick={reset}>✕ Cancel</button>
                      <button className="btn-portal" style={{ flex: 2 }} onClick={handleUpload}>
                        <span className="btn-rune">🚪</span> Send Through the Door
                      </button>
                    </div>
                  </>
                )}

                {!user && (
                  <button className="btn-silver" style={{ width: '100%', marginTop: '1rem' }} onClick={reset}>✕ Cancel</button>
                )}
              </div>
            )}

            {/* ── Uploading state ── */}
            {state === 'uploading' && (
              <div className="options-panel fade-in-up" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚗️</div>
                <p style={{ fontFamily: 'Cinzel, serif', color: 'var(--elvish)', marginBottom: '0.5rem' }}>
                  {uploadProgress}
                </p>
                <div className="progress-bar-track" style={{ marginTop: '1rem' }}>
                  <div className="progress-bar-fill" style={{ width: '100%', animation: 'progressGlow 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            )}

            {/* ── Done state — share URL ── */}
            {state === 'done' && (
              <div className="options-panel fade-in-up">
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '2.5rem' }}>✦</span>
                  <p style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', marginTop: '0.5rem' }}>
                    The door is open. Share the link.
                  </p>
                </div>
                <div className="share-url-box">
                  <input type="text" readOnly value={shareUrl} />
                  <button className="copy-btn" onClick={copyUrl}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                {password && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                    🔑 Password protected — share the password separately.
                  </p>
                )}
                <div className="rune-divider">· · ᚱ ᛁ ᚾ · ·</div>
                <button className="btn-silver" style={{ width: '100%' }} onClick={reset}>
                  ↩ Share Another File
                </button>
              </div>
            )}

            {/* ── Error state ── */}
            {state === 'error' && (
              <div className="options-panel fade-in-up">
                <div className="error-card">
                  <span className="error-glyph">🚪</span>
                  <p className="error-title">The door would not yield</p>
                  <p className="error-message">{errorMsg}</p>
                  <button className="btn-silver" onClick={reset}>↩ Try Again</button>
                </div>
              </div>
            )}

            {/* ── Idle — stat runes + mobile nav below door ── */}
            {(state === 'idle' || state === 'dragging') && (
              <>
                <div className="stat-runes fade-in-up fade-in-up-delay-3">
                  <span className="stat-rune" title="AES-256-GCM encryption">🔐 AES‑256</span>
                  <span className="stat-separator">·</span>
                  <span className="stat-rune" title="Files self-destruct">⏳ Self‑Destruct</span>
                  <span className="stat-separator">·</span>
                  <span className="stat-rune" title="Decryption key in URL fragment">🔑 Key in URL</span>
                </div>

                {/* Mobile-only nav (hidden on desktop where pillars show) */}
                <nav className="mobile-nav fade-in-up fade-in-up-delay-4" aria-label="Site navigation">
                  <Link href="/gallery" className="mobile-nav-link">ᚠ Vaults</Link>
                  <Link href="/handshake/receive" className="mobile-nav-link">⇄ Handshake</Link>
                  <Link href="/guide" className="mobile-nav-link">ᚢ Lore</Link>
                  {user ? (
                    <button
                      className="mobile-nav-link"
                      onClick={() => createClient().auth.signOut().then(() => setUser(null))}
                    >
                      ↩ Sign Out
                    </button>
                  ) : (
                    <Link href="/login" className="mobile-nav-link">🚪 Sign In</Link>
                  )}
                </nav>
              </>
            )}
          </div>

          {/* ── Right Pillar ── */}
          <nav className="pillar pillar-right fade-in-up fade-in-up-delay-3" aria-label="Right navigation">
            <div className="pillar-runes">ᛞ ᚢ ᚱ ᛁ</div>
            <div className="pillar-links">
              <Link href="/handshake/receive" className="pillar-link pillar-link-elvish">
                <span className="pillar-link-icon">⇄</span>
                <span className="pillar-link-label">Handshake</span>
              </Link>
              {user ? (
                <button
                  className="pillar-link"
                  onClick={() => createClient().auth.signOut().then(() => setUser(null))}
                >
                  <span className="pillar-link-icon">↩</span>
                  <span className="pillar-link-label">Sign Out</span>
                </button>
              ) : (
                <Link href="/login" className="pillar-link">
                  <span className="pillar-link-icon">🚪</span>
                  <span className="pillar-link-label">Sign In</span>
                </Link>
              )}
            </div>
            <div className="pillar-runes">ᚾ ᛊ ᛟ ᛗ</div>
          </nav>

        </div>
      </div>
    </>
  )
}

