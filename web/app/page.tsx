'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { encryptFile, hashPassword, humanSize, fileIcon } from '@/lib/crypto'
import type { User } from '@supabase/supabase-js'

type PageState =
  | 'idle'
  | 'dragging'
  | 'options'
  | 'uploading'
  | 'done'
  | 'error'

export default function HomePage() {
  const router = useRouter()
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const doorRef = useRef<HTMLDivElement>(null)

  // Check auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Stars canvas
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
      W = cv!.width = window.innerWidth
      H = cv!.height = window.innerHeight
      stars = []
      const N = Math.min(Math.floor(W * H / 4200) + 60, 320)
      for (let i = 0; i < N; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H * 0.74,
          r: Math.random() * 1.45 + 0.18,
          phase: Math.random() * Math.PI * 2,
          speed: 0.003 + Math.random() * 0.018,
          blue: Math.random() < 0.22,
        })
      }
    }

    function draw() {
      cx!.clearRect(0, 0, W, H)
      frame++
      for (const s of stars) {
        const lum = 0.30 + 0.70 * (0.5 + 0.5 * Math.sin(s.phase + frame * s.speed))
        cx!.fillStyle = s.blue ? `rgba(155,215,255,${lum})` : `rgba(218,208,186,${lum * 0.88})`
        cx!.beginPath()
        cx!.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        cx!.fill()
      }
      rafId = requestAnimationFrame(draw)
    }

    window.addEventListener('resize', resize, { passive: true })
    resize()
    draw()
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
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
    if (!user) { router.push('/login'); return }
    if (dropped.size > 50 * 1024 * 1024) { setState('error'); setErrorMsg('File too large. Max 50 MB.'); return }
    setFile(dropped)
    setState('options')
  }

  function handleDoorClick() {
    if (!user) { router.push('/login'); return }
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

      // Password hash
      const pwHash = password ? await hashPassword(password) : null

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
      <canvas id="stars-canvas" ref={canvasRef} />
      <MountainSilhouette />
      <div className="mist-layer" />

      {/* ── Hidden file input ── */}
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />

      <div className="page-wrapper">

        {/* ── The Door ── */}
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

          {/* Upload hint overlay (shown on drag) */}
          <div className="door-upload-overlay">
            <div className="upload-overlay-text">
              ✦ Drop to seal in the vault ✦<br />
              <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{file ? humanSize(file.size) : ''}</span>
            </div>
          </div>

          <div className="door-glow" />
        </div>

        {/* ── Title ── */}
        <h1 className="site-title fade-in-up fade-in-up-delay-1">Durin&apos;s Door</h1>
        <p className="site-subtitle fade-in-up fade-in-up-delay-2">
          Encrypted. Temporary. Forgotten when the time comes.
        </p>
        <p className="speak-friend fade-in-up fade-in-up-delay-2">
          ✦ &thinsp; Speak, friend, and enter — then download. &thinsp; ✦
        </p>

        {/* ── Upload options panel ── */}
        {state === 'options' && file && (
          <div className="options-panel fade-in-up">
            <div className="options-file-name">
              {fileIcon(file.name)} {file.name} <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>({humanSize(file.size)})</span>
            </div>

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

        {/* ── Idle — stats and navigation ── */}
        {(state === 'idle' || state === 'dragging') && (
          <>
            <div className="stone-tablets fade-in-up fade-in-up-delay-3">
              <div className="stone-tablet">
                <span className="tablet-value" style={{ fontSize: '1.4rem', letterSpacing: '-0.03em' }}>AES</span>
                <span className="tablet-label">256‑GCM</span>
              </div>
              <div className="stone-tablet">
                <span className="tablet-value" style={{ fontSize: '1.6rem' }}>⏳</span>
                <span className="tablet-label">Self‑Destruct</span>
              </div>
              <div className="stone-tablet">
                <span className="tablet-value" style={{ fontSize: '1.4rem' }}>🔑</span>
                <span className="tablet-label">Key in URL</span>
              </div>
            </div>

            {/* Upload hint */}
            <div className="fade-in-up fade-in-up-delay-4" style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              {!user ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  <Link href="/login" style={{ color: 'var(--silver)' }}>Sign in</Link> to share files.
                  Anyone with a link can download — no account needed.
                </p>
              ) : (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Click the door or drag a file to share. Max 50 MB.
                </p>
              )}
            </div>

            {/* Hall navigation */}
            <nav className="hall-nav fade-in-up fade-in-up-delay-4" aria-label="Site navigation">
              <Link href="/gallery" className="hall-link">
                <span className="hall-link-rune">ᚠ</span>The Vaults
              </Link>
              <Link href="/handshake/receive" className="hall-link" style={{ borderColor: 'rgba(107,197,255,0.3)', color: 'var(--elvish)' }}>
                <span className="hall-link-rune">⇄</span>Handshake
              </Link>
              <Link href="/guide" className="hall-link">
                <span className="hall-link-rune">ᚢ</span>The Lore-Book
              </Link>
              {user ? (
                <button
                  className="hall-link"
                  style={{ background: 'none', cursor: 'pointer' }}
                  onClick={() => createClient().auth.signOut().then(() => setUser(null))}
                >
                  <span className="hall-link-rune">↩</span>Sign Out
                </button>
              ) : (
                <Link href="/login" className="hall-link">
                  <span className="hall-link-rune">🚪</span>Sign In
                </Link>
              )}
            </nav>
          </>
        )}

      </div>
    </>
  )
}

/* ── Sub-components ── */

function MountainSilhouette() {
  return (
    <svg className="mountain-silhouette" viewBox="0 0 1400 130" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="mountFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0e1a" stopOpacity="0" />
          <stop offset="55%" stopColor="#080c16" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#050810" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d="M0 130 L0 90 L60 55 L110 75 L170 32 L230 62 L290 20 L360 58 L430 35 L500 70 L570 15 L640 55 L700 30 L760 65 L830 10 L890 50 L950 25 L1020 60 L1080 38 L1140 70 L1200 22 L1260 55 L1320 40 L1380 68 L1400 50 L1400 130 Z" fill="#07090f" />
      <rect x="0" y="0" width="1400" height="130" fill="url(#mountFade)" />
    </svg>
  )
}

function DoorSVG({ onStarClick }: { onStarClick: () => void }) {
  return (
    <svg className="door-svg" viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Durin's Door arch" id="door-svg">
      <defs>
        <filter id="glow-elvish" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-silver" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-gold" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-crack" x="-200%" y="-50%" width="500%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="voidGrad" cx="50%" cy="25%" r="70%">
          <stop offset="0%" stopColor="#0c1424"/>
          <stop offset="60%" stopColor="#060910"/>
          <stop offset="100%" stopColor="#020408"/>
        </radialGradient>
        <radialGradient id="crackGrad" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="rgba(107,197,255,0.45)"/>
          <stop offset="100%" stopColor="rgba(107,197,255,0)"/>
        </radialGradient>
        <pattern id="stoneTex" x="0" y="0" width="60" height="44" patternUnits="userSpaceOnUse">
          <rect width="60" height="44" fill="#0d1525"/>
          <line x1="0" y1="0" x2="60" y2="0" stroke="#111e34" strokeWidth="0.7"/>
          <line x1="0" y1="22" x2="60" y2="22" stroke="#111e34" strokeWidth="0.7"/>
          <line x1="30" y1="0" x2="30" y2="22" stroke="#111e34" strokeWidth="0.4"/>
        </pattern>
        <clipPath id="archVoidClip">
          <path d="M 88 512 L 88 308 Q 86 105 200 68 Q 314 105 312 308 L 312 512 Z"/>
        </clipPath>
      </defs>

      {/* Stone wall */}
      <path fill="url(#stoneTex)" stroke="#1a2844" strokeWidth="0.6" fillRule="evenodd"
        d="M 0 0 L 400 0 L 400 520 L 0 520 Z M 88 512 L 88 308 Q 86 105 200 68 Q 314 105 312 308 L 312 512 Z"/>

      {/* Door void */}
      <path fill="url(#voidGrad)" d="M 88 512 L 88 308 Q 86 105 200 68 Q 314 105 312 308 L 312 512 Z"/>

      {/* Base crack glow */}
      <ellipse cx="200" cy="512" rx="90" ry="16" fill="url(#crackGrad)">
        <animate attributeName="opacity" values="0.5;1.0;0.5" dur="3.2s" repeatCount="indefinite"/>
      </ellipse>

      {/* Arch outlines */}
      <path fill="none" stroke="#2e4268" strokeWidth="1.2" opacity="0.45"
        d="M 65 512 L 65 305 Q 62 90 200 48 Q 338 90 335 305 L 335 512"/>
      <path fill="none" stroke="#3a5080" strokeWidth="2"
        d="M 88 512 L 88 308 Q 86 105 200 68 Q 314 105 312 308 L 312 512"/>
      <path fill="none" stroke="var(--gold)" strokeWidth="1" opacity="0.7"
        d="M 106 512 L 106 312 Q 106 122 200 87 Q 294 122 294 312 L 294 512"/>

      {/* Rune inscription band */}
      <text className="rune-text" x="200" y="52" textAnchor="middle" fontSize="12" letterSpacing="5">ᛗᛖᛚᛚᛟᚾ · ᚠᚱᛖᛟᚾᛞ · ᛖᚾᛏᛖᚱ</text>

      {/* Rune spin ring */}
      <circle cx="200" cy="200" r="148" fill="none" stroke="rgba(107,197,255,0.06)" strokeWidth="0.8" strokeDasharray="4 8">
        <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="60s" repeatCount="indefinite"/>
      </circle>

      {/* Star of Durin */}
      <g filter="url(#glow-silver)">
        <g className="star-of-durin" transform="translate(200,196)" style={{ cursor: 'pointer' }}
           onClick={e => { e.stopPropagation(); onStarClick() }}
           role="button" aria-label="Star of Durin">
          <line x1="0" y1="-46" x2="0" y2="46" stroke="var(--silver-glow)" strokeWidth="1.5"/>
          <line x1="-46" y1="0" x2="46" y2="0" stroke="var(--silver-glow)" strokeWidth="1.5"/>
          <line x1="-33" y1="-33" x2="33" y2="33" stroke="var(--silver-glow)" strokeWidth="1.4"/>
          <line x1="33" y1="-33" x2="-33" y2="33" stroke="var(--silver-glow)" strokeWidth="1.4"/>
          <polygon points="0,-54 38,-38 54,0 38,38 0,54 -38,38 -54,0 -38,-38" fill="none" stroke="var(--silver)" strokeWidth="0.7" opacity="0.45"/>
          <circle r="30" fill="none" stroke="var(--silver)" strokeWidth="0.5" opacity="0.3"/>
          <circle r="10" fill="none" stroke="var(--silver-glow)" strokeWidth="1.2"/>
          <circle r="4" fill="var(--silver-glow)" stroke="none"/>
          <circle r="60" fill="transparent" stroke="none"/>
        </g>
      </g>

      {/* Elvish tree */}
      <g filter="url(#glow-elvish)" opacity="0.80">
        <line x1="200" y1="278" x2="200" y2="335" stroke="var(--elvish)" strokeWidth="1.6"/>
        <line x1="200" y1="335" x2="182" y2="346" stroke="var(--elvish)" strokeWidth="1"/>
        <line x1="200" y1="335" x2="218" y2="346" stroke="var(--elvish)" strokeWidth="1"/>
        <line x1="200" y1="325" x2="176" y2="312" stroke="var(--elvish)" strokeWidth="1.0"/>
        <line x1="200" y1="313" x2="170" y2="296" stroke="var(--elvish)" strokeWidth="0.8"/>
        <line x1="200" y1="325" x2="224" y2="312" stroke="var(--elvish)" strokeWidth="1.0"/>
        <line x1="200" y1="313" x2="230" y2="296" stroke="var(--elvish)" strokeWidth="0.8"/>
        <circle cx="174" cy="310" r="2.8" fill="var(--elvish)" opacity="0.75"/>
        <circle cx="168" cy="293" r="2.2" fill="var(--elvish)" opacity="0.65"/>
        <circle cx="226" cy="310" r="2.8" fill="var(--elvish)" opacity="0.75"/>
        <circle cx="232" cy="293" r="2.2" fill="var(--elvish)" opacity="0.65"/>
        <circle cx="200" cy="255" r="2.5" fill="var(--elvish)" opacity="0.55"/>
      </g>

      {/* Pillar rune strips */}
      <rect fill="rgba(30,44,72,0.35)" stroke="rgba(42,58,92,0.3)" strokeWidth="0.5" x="65" y="112" width="23" height="195" rx="2"/>
      <rect fill="rgba(30,44,72,0.35)" stroke="rgba(42,58,92,0.3)" strokeWidth="0.5" x="312" y="112" width="23" height="195" rx="2"/>

      {/* Left pillar runes */}
      {['ᚠ','ᚢ','ᚱ','ᚨ','ᛊ','ᛏ','ᛁ','ᛜ'].map((r, i) => (
        <text key={`L${i}`} className="rune-text" x="76.5" y={140 + i * 21} textAnchor="middle" fontSize="11" style={{ animationDelay: `${0.1 + i * 0.4}s` }}>{r}</text>
      ))}
      {/* Right pillar runes */}
      {['ᛞ','ᚢ','ᚱ','ᛁ','ᚾ','ᛊ','ᛟ','ᛗ'].map((r, i) => (
        <text key={`R${i}`} className="rune-text" x="323.5" y={140 + i * 21} textAnchor="middle" fontSize="11" style={{ animationDelay: `${0.3 + i * 0.4}s` }}>{r}</text>
      ))}

      {/* Animated rune lines */}
      <line className="rune-line" x1="76.5" y1="305" x2="76.5" y2="118" style={{ animationDelay: '0.2s' }}/>
      <line className="rune-line" x1="323.5" y1="305" x2="323.5" y2="118" style={{ animationDelay: '0.7s' }}/>

      {/* Central door crack */}
      <line x1="200" y1="90" x2="200" y2="512" stroke="var(--elvish)" strokeWidth="0.6" filter="url(#glow-crack)">
        <animate attributeName="opacity" values="0.10;0.38;0.10" dur="4.5s" repeatCount="indefinite"/>
      </line>

      {/* Crown jewel */}
      <circle cx="200" cy="68" r="5" fill="none" stroke="var(--gold)" strokeWidth="1.2" filter="url(#glow-gold)" opacity="0.8"/>
      <circle cx="200" cy="68" r="9" fill="none" stroke="var(--gold-dim)" strokeWidth="0.5" opacity="0.45"/>
      <circle cx="200" cy="68" r="2.5" fill="var(--gold)" filter="url(#glow-gold)" opacity="0.9"/>

      {/* Stone threshold */}
      <rect x="55" y="508" width="290" height="9" rx="2" fill="#0d1525" stroke="#1e2d48" strokeWidth="0.8"/>

      {/* Corner knotwork */}
      <circle cx="86" cy="110" r="8" fill="none" stroke="rgba(107,197,255,0.18)" strokeWidth="0.8"/>
      <circle cx="314" cy="110" r="8" fill="none" stroke="rgba(107,197,255,0.18)" strokeWidth="0.8"/>
    </svg>
  )
}
