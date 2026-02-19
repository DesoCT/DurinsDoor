'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  generateECDHKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
} from '@/lib/ecdh'
import { deriveVerificationPhrase } from '@/lib/tolkien-words'
import { encryptFileWithKey, humanSize, fileIcon } from '@/lib/crypto'
import type { Handshake } from '@/lib/types'

type PageState = 'idle' | 'looking' | 'verified' | 'uploading' | 'done' | 'error'

export default function HandshakeSendPage() {
  const [pageState, setPageState] = useState<PageState>('idle')
  const [code, setCode] = useState('')
  const [verificationPhrase, setVerificationPhrase] = useState('')
  const [handshake, setHandshake] = useState<Handshake | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const sharedKeyRef = useRef<CryptoKey | null>(null)
  const handshakeRef = useRef<Handshake | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleConnect = useCallback(async () => {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 6) {
      setErrorMsg('Enter a 6-character pairing code.')
      return
    }

    setPageState('looking')
    setErrorMsg('')

    try {
      const supabase = createClient()

      // Look up handshake by code
      const { data, error } = await supabase
        .from('handshakes')
        .select('*')
        .eq('code', trimmed)
        .eq('status', 'waiting')
        .single()

      if (error || !data) {
        setErrorMsg('Code not found or already used. Check the code and try again.')
        setPageState('idle')
        return
      }

      const hs = data as Handshake
      if (new Date(hs.expires_at) < new Date()) {
        setErrorMsg('This pairing code has expired. Ask the receiver to generate a new one.')
        setPageState('idle')
        return
      }

      // Generate our keypair
      const keypair = await generateECDHKeyPair()
      const senderPubB64 = await exportPublicKey(keypair)

      // Import receiver's public key
      const receiverPub = await importPublicKey(hs.receiver_public_key)

      // Derive shared secret
      const sharedKey = await deriveSharedKey(keypair.privateKey, receiverPub)
      sharedKeyRef.current = sharedKey

      // Derive verification phrase
      const phrase = await deriveVerificationPhrase(sharedKey)
      setVerificationPhrase(phrase)

      // Update handshake in Supabase: add sender pubkey, set status = 'paired'
      const { error: updateError } = await supabase
        .from('handshakes')
        .update({
          sender_public_key: senderPubB64,
          status: 'paired',
        })
        .eq('id', hs.id)

      if (updateError) throw updateError

      setHandshake(hs)
      handshakeRef.current = hs
      setPageState('verified')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed.')
      setPageState('idle')
    }
  }, [code])

  const handleSend = useCallback(async () => {
    if (!file || !sharedKeyRef.current || !handshakeRef.current) return
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('File too large. Max 50 MB.')
      return
    }

    setPageState('uploading')
    setUploadProgress('Reading file…')

    try {
      const supabase = createClient()
      const buffer = await file.arrayBuffer()

      setUploadProgress('Encrypting with shared key…')
      const encryptedBlob = await encryptFileWithKey(buffer, sharedKeyRef.current)

      setUploadProgress('Sending through the door…')
      const storagePath = `handshakes/${handshakeRef.current.id}/${crypto.randomUUID()}`
      const { error: uploadError } = await supabase.storage
        .from('encrypted-files')
        .upload(storagePath, encryptedBlob, { contentType: 'application/octet-stream' })

      if (uploadError) throw uploadError

      setUploadProgress('Recording in the vault…')

      // Create a share record for the receiver to reference
      const { data: share, error: shareError } = await supabase
        .from('shares')
        .insert({
          filename: file.name,
          size_bytes: file.size,
          content_type: file.type || 'application/octet-stream',
          storage_path: storagePath,
          max_downloads: 1,
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2h
          created_by: null,
        })
        .select()
        .single()

      if (shareError) throw shareError

      // Update handshake: completed + share_id
      const { error: doneError } = await supabase
        .from('handshakes')
        .update({
          status: 'completed',
          share_id: share.id,
        })
        .eq('id', handshakeRef.current.id)

      if (doneError) throw doneError

      setPageState('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed.')
      setPageState('error')
    }
  }, [file])

  return (
    <>
      <div className="mist-layer" />
      <MountainSilhouette />

      <div className="page-wrapper">
        <nav style={{ width: '100%', maxWidth: 600, margin: '0 auto 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" className="guide-back">← Durin&apos;s Door</Link>
          <Link href="/handshake/receive" className="guide-back">Receive a file →</Link>
        </nav>

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) setFile(f)
            e.target.value = ''
          }}
        />

        <div className="handshake-card fade-in-up">
          {/* Header */}
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⇄</span>
            <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.3rem', color: 'var(--elvish-glow)', marginBottom: '0.3rem' }}>
              Handshake — Send
            </h1>
            <p className="handshake-status">Enter the receiver&apos;s pairing code to begin the exchange</p>
          </div>

          <div className="rune-divider">· · ᛊᛖᚾᛞ · ·</div>

          {/* IDLE — enter code */}
          {(pageState === 'idle' || pageState === 'looking') && (
            <>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Pairing Code
              </p>

              <div className="code-input-wrap">
                <input
                  type="text"
                  className="code-input"
                  placeholder="XXXXXX"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
                  maxLength={6}
                  disabled={pageState === 'looking'}
                  onKeyDown={e => e.key === 'Enter' && handleConnect()}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  className="btn-elvish"
                  onClick={handleConnect}
                  disabled={pageState === 'looking' || code.trim().length < 6}
                  style={{ flexShrink: 0 }}
                >
                  {pageState === 'looking' ? '…' : 'Connect'}
                </button>
              </div>

              {errorMsg && (
                <p className="error-rune" style={{ marginTop: '0.5rem' }}>✕ {errorMsg}</p>
              )}

              <p className="handshake-status" style={{ marginTop: '1rem' }}>
                Enter the code shown on the receiver&apos;s screen.
                The ECDH key exchange happens automatically — no URL to share.
              </p>
            </>
          )}

          {/* VERIFIED — show phrase + file picker */}
          {pageState === 'verified' && (
            <>
              <div className="badge badge-active" style={{ marginBottom: '1rem' }}>
                ✓ Key exchange complete
              </div>

              <p className="handshake-status">
                Confirm the verification phrase matches the receiver&apos;s screen:
              </p>

              <div className="verification-box">
                <p className="verification-label">Tolkien Verification Phrase</p>
                <p className="verification-phrase">{verificationPhrase}</p>
              </div>

              <div className="shield-box" style={{ textAlign: 'left', margin: '1rem 0' }}>
                <span className="shield-box-icon">🤝</span>
                <p className="shield-box-text">
                  If both sides show <strong>identical words</strong>, the key exchange is authentic.
                  Now select the file to send — it will be encrypted with your shared key.
                </p>
              </div>

              <div className="rune-divider">· · ᚠᛁᛚᛖ · ·</div>

              {!file ? (
                <button
                  className="btn-portal"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="btn-rune">📁</span> Choose File to Send
                </button>
              ) : (
                <div>
                  <div style={{
                    background: 'var(--bg-stone)',
                    border: '1px solid var(--border-rune)',
                    borderRadius: 'var(--radius)',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>{fileIcon(file.name)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'var(--gold)', wordBreak: 'break-all' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {humanSize(file.size)}
                      </div>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }}
                      title="Remove file"
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      className="btn-silver"
                      style={{ flex: 1 }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change
                    </button>
                    <button
                      className="btn-portal"
                      style={{ flex: 2 }}
                      onClick={handleSend}
                    >
                      <span className="btn-rune">🚪</span> Encrypt &amp; Send
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* UPLOADING */}
          {pageState === 'uploading' && (
            <div style={{ padding: '1rem 0', textAlign: 'center' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '1rem' }}>⚗️</span>
              <p style={{ fontFamily: 'Cinzel, serif', color: 'var(--elvish)', marginBottom: '0.5rem' }}>
                {uploadProgress}
              </p>
              <div className="progress-bar-track" style={{ marginTop: '1rem' }}>
                <div className="progress-bar-fill" style={{ width: '100%' }} />
              </div>
            </div>
          )}

          {/* DONE */}
          {pageState === 'done' && (
            <>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>✦</span>
              <h2 style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', marginBottom: '0.5rem' }}>
                The artifact has passed through the door.
              </h2>
              <p className="handshake-status" style={{ marginBottom: '1.5rem' }}>
                The receiver&apos;s screen will update automatically. The encrypted file
                is ready to be decrypted on their end.
              </p>
              {verificationPhrase && (
                <div className="verification-box" style={{ marginBottom: '1.5rem' }}>
                  <p className="verification-label">Verification Phrase</p>
                  <p className="verification-phrase">{verificationPhrase}</p>
                </div>
              )}
              <Link href="/" className="btn-silver" style={{ textDecoration: 'none', display: 'flex', maxWidth: 260, margin: '0 auto' }}>
                ↩ Return to the Door
              </Link>
            </>
          )}

          {/* ERROR */}
          {pageState === 'error' && (
            <div className="error-card">
              <span className="error-glyph">🌑</span>
              <p className="error-title">The passage failed</p>
              <p className="error-message">{errorMsg}</p>
              <button className="btn-silver" onClick={() => { setPageState('verified'); setErrorMsg('') }}>
                ↩ Try Again
              </button>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/guide#handshake" style={{ color: 'var(--text-dim)', fontSize: '0.78rem', opacity: 0.6 }}>
            How does Handshake mode work? →
          </Link>
        </div>
      </div>
    </>
  )
}

function MountainSilhouette() {
  return (
    <svg className="mountain-silhouette" viewBox="0 0 1400 130" preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="mountFade-hs-send" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0e1a" stopOpacity="0"/>
          <stop offset="55%" stopColor="#080c16" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#050810" stopOpacity="1"/>
        </linearGradient>
      </defs>
      <path d="M0 130 L0 90 L60 55 L110 75 L170 32 L230 62 L290 20 L360 58 L430 35 L500 70 L570 15 L640 55 L700 30 L760 65 L830 10 L890 50 L950 25 L1020 60 L1080 38 L1140 70 L1200 22 L1260 55 L1320 40 L1380 68 L1400 50 L1400 130 Z"
        fill="#07090f"/>
      <rect x="0" y="0" width="1400" height="130" fill="url(#mountFade-hs-send)"/>
    </svg>
  )
}
