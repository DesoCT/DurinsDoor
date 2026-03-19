'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SmallArch from '@/components/SmallArch'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <>
      <div className="mist-layer" />
      <div className="page-wrapper">
        <div style={{ marginBottom: '2rem', opacity: 0.7 }}>
          <SmallArch />
        </div>

        <div className="auth-card fade-in-up">
          <h1 className="auth-title">🔑 Enter the Hall</h1>
          <p className="auth-subtitle">
            Speak your name and the word, and the door shall open.
          </p>

          <div className="rune-divider">· · ᛖᚾᛏᛖᚱ · ·</div>

          <form onSubmit={handleLogin}>
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
                placeholder="Speak the word…"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
              <span className="btn-rune">🚪</span>
              {loading ? 'Opening the door…' : 'Enter'}
            </button>
          </form>

          <div className="rune-divider">· · ᚱᚢᚾᛖ · ·</div>

          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            No account?{' '}
            <Link href="/signup" className="auth-link">Join the Fellowship →</Link>
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

