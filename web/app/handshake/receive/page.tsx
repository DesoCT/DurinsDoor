'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  generateECDHKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPrivateKey,
  importPublicKey,
  deriveSharedKey,
  deriveRawSharedSecret,
  generatePairingCode,
} from '@/lib/ecdh'
import { deriveVerificationPhrase } from '@/lib/tolkien-words'
import { decryptFileWithKey, triggerDownload } from '@/lib/crypto'
import { Button } from '@/components/ui/button'
import type { Handshake } from '@/lib/types'

type PageState = 'init' | 'waiting' | 'paired' | 'completed' | 'expired' | 'error'

const SESSION_KEY = 'durin_hs_receive_private'

export default function HandshakeReceivePage() {
  const [pageState, setPageState] = useState<PageState>('init')
  const [pairingCode, setPairingCode] = useState('')
  const [handshakeId, setHandshakeId] = useState('')
  const [verificationPhrase, setVerificationPhrase] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [shareId, setShareId] = useState('')
  const [downloading, setDownloading] = useState(false)
  const sharedKeyRef = useRef<CryptoKey | null>(null)

  // Initialize: generate keypair, create handshake, subscribe to realtime
  useEffect(() => {
    let channelRef: ReturnType<typeof createClient>['channel'] extends (...args: infer A) => infer R ? R : never

    async function init() {
      try {
        // Generate fresh keypair
        const keypair = await generateECDHKeyPair()
        const pubKeyB64 = await exportPublicKey(keypair)
        const privKeyJwk = await exportPrivateKey(keypair)

        // Store private key in sessionStorage for recovery if page refreshes
        sessionStorage.setItem(SESSION_KEY, privKeyJwk)

        const code = generatePairingCode()
        setPairingCode(code)

        // Insert handshake into Supabase
        const supabase = createClient()
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1h
        const { data, error } = await supabase
          .from('handshakes')
          .insert({
            code,
            receiver_public_key: pubKeyB64,
            status: 'waiting',
            expires_at: expiresAt,
          })
          .select()
          .single()

        if (error || !data) {
          setErrorMsg(error?.message ?? 'Failed to open the receiving chamber.')
          setPageState('error')
          return
        }

        setHandshakeId(data.id)
        setPageState('waiting')

        // Subscribe to realtime changes on this handshake row
        const client = createClient()
        channelRef = client
          .channel(`handshake-recv-${data.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'handshakes',
              filter: `id=eq.${data.id}`,
            },
            async (payload) => {
              const updated = payload.new as Handshake
              if (updated.status === 'paired' && updated.sender_public_key) {
                // Derive shared secret
                const privJwk = sessionStorage.getItem(SESSION_KEY)
                if (!privJwk) {
                  setErrorMsg('Session key lost — please refresh and try again.')
                  setPageState('error')
                  return
                }
                try {
                  const privateKey = await importPrivateKey(privJwk)
                  const senderPub = await importPublicKey(updated.sender_public_key)
                  const sharedKey = await deriveSharedKey(privateKey, senderPub)
                  sharedKeyRef.current = sharedKey
                  // Use raw ECDH secret for verification phrase (matches Go CLI)
                  const rawSecret = await deriveRawSharedSecret(privateKey, senderPub)
                  const phrase = await deriveVerificationPhrase(rawSecret)
                  setVerificationPhrase(phrase)
                  setPageState('paired')
                } catch (err) {
                  setErrorMsg(err instanceof Error ? err.message : 'Key derivation failed.')
                  setPageState('error')
                }
              } else if (updated.status === 'completed') {
                if (updated.share_id) {
                  setShareId(updated.share_id)
                }
                setPageState('completed')
              } else if (updated.status === 'expired') {
                setPageState('expired')
              }
            }
          )
          .subscribe()
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to initialise the handshake.')
        setPageState('error')
      }
    }

    init()

    return () => {
      if (channelRef) channelRef.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDownload = useCallback(async () => {
    if (!shareId || !sharedKeyRef.current) return
    setDownloading(true)
    try {
      const supabase = createClient()
      const { data: share } = await supabase
        .from('shares')
        .select('*')
        .eq('id', shareId)
        .single()

      if (!share) throw new Error('File record not found.')

      const { data: blob, error: dlErr } = await supabase.storage
        .from('encrypted-files')
        .download(share.storage_path)

      if (dlErr || !blob) throw dlErr ?? new Error('Download failed.')

      const buffer = await blob.arrayBuffer()
      const decrypted = await decryptFileWithKey(buffer, sharedKeyRef.current)
      triggerDownload(decrypted, share.filename, share.content_type ?? 'application/octet-stream')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Download failed.')
    } finally {
      setDownloading(false)
    }
  }, [shareId])

  return (
    <>
      <div className="mist-layer" />
      <MountainSilhouette />

      <div className="page-wrapper flex flex-col items-center justify-center min-h-[100dvh] relative z-[2] px-4 py-8">
        <nav className="w-full max-w-[600px] mx-auto mb-6 flex justify-between items-center">
          <Link href="/" className="guide-back">← Durin&apos;s Door</Link>
          <Link href="/handshake/send" className="guide-back">Send a file →</Link>
        </nav>

        <div className="handshake-card fade-in-up">
          {/* Header */}
          <div className="mb-4">
            <span className="text-3xl block mb-2">⇄</span>
            <h1 className="font-cinzel text-[1.3rem] text-elvish-glow mb-1">
              Handshake — Receive
            </h1>
            <p className="handshake-status">Open the receiving chamber &amp; share your pairing code</p>
          </div>

          <div className="rune-divider">· · ᚱᛖᚲᛖᛁᚢᛖ · ·</div>

          {/* INIT */}
          {pageState === 'init' && (
            <div className="py-8">
              <p className="waiting-runes">ᚠ ᚢ ᚱ ᚨ</p>
              <p className="handshake-status">Opening the receiving chamber…</p>
            </div>
          )}

          {/* WAITING */}
          {pageState === 'waiting' && (
            <>
              <p className="text-[0.8rem] text-dim mb-2 uppercase tracking-wider">
                Your Pairing Code
              </p>
              <span className="pairing-code">{pairingCode}</span>
              <p className="handshake-status">
                Share this code with your sender. The door awaits.
              </p>
              <p className="waiting-runes" aria-label="Waiting for sender">
                ᚠ ᚢ ᚱ ᚨ ᛊ ᛏ ᛁ ᛜ
              </p>
              <p className="text-[0.78rem] text-dim mt-2 italic">
                Waiting for sender to connect… This code expires in 1 hour.
              </p>
            </>
          )}

          {/* PAIRED — show verification phrase */}
          {pageState === 'paired' && (
            <>
              <div className="badge badge-active mb-4">
                ✓ Sender connected
              </div>
              <p className="handshake-status">
                Confirm the verification phrase matches your sender&apos;s screen:
              </p>
              <div className="verification-box">
                <p className="verification-label">Tolkien Verification Phrase</p>
                <p className="verification-phrase">{verificationPhrase}</p>
              </div>
              <div className="shield-box text-left mt-4">
                <span className="shield-box-icon">🤝</span>
                <p className="shield-box-text">
                  If both sides show <strong>identical words</strong>, the key exchange is authentic.
                  The sender will now encrypt and send the file.
                </p>
              </div>
              <p className="waiting-runes mt-4">ᛁ ᛜ ᛞ ᚢ ᚱ ᛁ ᚾ</p>
              <p className="handshake-status">Awaiting the file from the sender…</p>
            </>
          )}

          {/* COMPLETED — download ready */}
          {pageState === 'completed' && (
            <>
              <span className="text-5xl block mb-4">✦</span>
              <h2 className="font-cinzel text-gold mb-2">
                The vault has yielded its secret.
              </h2>
              {verificationPhrase && (
                <div className="verification-box mb-6">
                  <p className="verification-label">Verification Phrase</p>
                  <p className="verification-phrase">{verificationPhrase}</p>
                </div>
              )}
              {shareId ? (
                <Button
                  variant="portal"
                  rune="⬇"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? 'Decrypting…' : 'Receive & Decrypt File'}
                </Button>
              ) : (
                <p className="handshake-status">File record not linked — ask sender to retry.</p>
              )}
            </>
          )}

          {/* EXPIRED */}
          {pageState === 'expired' && (
            <div className="error-card">
              <span className="error-glyph">⏳</span>
              <p className="error-title text-dim">The pairing code has expired.</p>
              <p className="error-message">Generate a new code to try again.</p>
              <Button variant="elvish" onClick={() => window.location.reload()}>
                ↩ Generate New Code
              </Button>
            </div>
          )}

          {/* ERROR */}
          {pageState === 'error' && (
            <div className="error-card">
              <span className="error-glyph">🌑</span>
              <p className="error-title">The chamber would not open</p>
              <p className="error-message">{errorMsg}</p>
              <Button variant="silver" onClick={() => window.location.reload()}>
                ↩ Try Again
              </Button>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <Link href="/guide#handshake" className="text-dim text-[0.78rem] opacity-60">
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
        <linearGradient id="mountFade-hs" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0e1a" stopOpacity="0"/>
          <stop offset="55%" stopColor="#080c16" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#050810" stopOpacity="1"/>
        </linearGradient>
      </defs>
      <path d="M0 130 L0 90 L60 55 L110 75 L170 32 L230 62 L290 20 L360 58 L430 35 L500 70 L570 15 L640 55 L700 30 L760 65 L830 10 L890 50 L950 25 L1020 60 L1080 38 L1140 70 L1200 22 L1260 55 L1320 40 L1380 68 L1400 50 L1400 130 Z"
        fill="#07090f"/>
      <rect x="0" y="0" width="1400" height="130" fill="url(#mountFade-hs)"/>
    </svg>
  )
}
