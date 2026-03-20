'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SmallArch from '@/components/SmallArch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SignupPage() {
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
        <div className="page-wrapper flex flex-col items-center justify-center min-h-[100dvh] relative z-[2] px-4 py-8">
          <div className="auth-card fade-in-up text-center">
            <span className="text-5xl block mb-4">✦</span>
            <h1 className="auth-title">Fellowship Joined</h1>
            <p className="auth-subtitle mb-6">
              A scroll has been sent to <strong className="text-silver-glow">
              {email}</strong>.
              Follow the link within to confirm your passage.
            </p>
            <div className="rune-divider">· · ᚠᚱᛖᛟᚾᛞ · ·</div>
            <Link href="/login" className="btn-portal no-underline inline-flex items-center justify-center gap-2">
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
      <div className="page-wrapper flex flex-col items-center justify-center min-h-[100dvh] relative z-[2] px-4 py-8">
        <div className="mb-8 opacity-70">
          <SmallArch />
        </div>

        <div className="auth-card fade-in-up">
          <h1 className="auth-title">✦ Join the Fellowship</h1>
          <p className="auth-subtitle">
            Carve your name in the stone. The door shall remember you.
          </p>

          <div className="rune-divider">· · ᚠᛖᛚᛚᛟᚹᛊᚺᛁᛈ · ·</div>

          <form onSubmit={handleSignup}>
            <div className="form-group flex flex-col gap-1.5 mb-4">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group flex flex-col gap-1.5 mb-4">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Choose your word of passage…"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            <div className="form-group flex flex-col gap-1.5 mb-4">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Speak it once more…"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="error-rune mb-4">
                ✕ {error}
              </p>
            )}

            <Button
              type="submit"
              variant="portal"
              rune="✦"
              disabled={loading}
              className="mt-2"
            >
              {loading ? 'Carving your name…' : 'Join the Fellowship'}
            </Button>
          </form>

          <div className="rune-divider">· · ᚱᚢᚾᛖ · ·</div>

          <p className="text-center text-[0.85rem] text-dim">
            Already a member?{' '}
            <Link href="/login" className="auth-link">Enter the Hall →</Link>
          </p>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-dim text-[0.8rem] opacity-55">
            ← Return to Durin&apos;s Door
          </Link>
        </div>
      </div>
    </>
  )
}
