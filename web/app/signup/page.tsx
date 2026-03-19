'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SmallArch from '@/components/SmallArch'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match — speak the same word twice.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <>
        <div className="mist-layer" />
        <div className="page-wrapper">
          <div className="auth-card fade-in-up" style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>✦</span>
            <h1 className="auth-title">Fellowship Joined</h1>
            <p className="auth-subtitle" style={{ marginBottom: '1.5rem' }}>
              A scroll has been sent to <strong style={{ color: 'var(--silver-glow)' }}>{email}</strong>.
              Follow the link within to confirm your passage.
            </p>
            <div className="rune-divider">· · ᚠᚱᛖᛟᚾᛞ · ·</div>
            <Link href="/login" className="btn-portal" style={{ textDecoration: 'none' }}>
              <span className="btn-rune">🚪</span> Proceed to the Door
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="mist-layer" />
      <div className="page-wrapper">
        <div style={{ marginBottom: '2rem', opacity: 0.7 }}>
          <SmallArch />
        </div>

        <div className="auth-card fade-in-up">
          <h1 className="auth-title">✦ Join the Fellowship</h1>
          <p className="auth-subtitle">
            Carve your name in the stone. The door shall remember you.
          </p>

          <div className="rune-divider">· · ᚠᛖᛚᛚᛟᚹᛊᚺᛁᛈ · ·</div>

          <form onSubmit={handleSignup}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="rune-input"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="rune-input"
                placeholder="Choose your word of passage…"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm">Confirm Password</label>
              <input
                id="confirm"
                type="password"
                className="rune-input"
                placeholder="Speak it once more…"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="error-rune" style={{ marginBottom: '1rem' }}>
                ✕ {error}
              </p>
            )}

            <button
              type="submit"
              className="btn-portal"
              disabled={loading}
              style={{ marginTop: '0.5rem' }}
            >
              <span className="btn-rune">✦</span>
              {loading ? 'Carving your name…' : 'Join the Fellowship'}
            </button>
          </form>

          <div className="rune-divider">· · ᚱᚢᚾᛖ · ·</div>

          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            Already a member?{' '}
            <Link href="/login" className="auth-link">Enter the Hall →</Link>
          </p>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/" style={{ color: 'var(--text-dim)', fontSize: '0.8rem', opacity: 0.55 }}>
            ← Return to Durin&apos;s Door
          </Link>
        </div>
      </div>
    </>
  )
}

