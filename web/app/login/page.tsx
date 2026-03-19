'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SmallArch from '@/components/SmallArch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
      <div className="page-wrapper flex flex-col items-center justify-center min-h-[100dvh] relative z-[2] px-4 py-8">
        <div className="mb-8 opacity-70">
          <SmallArch />
        </div>

        <div className="auth-card fade-in-up">
          <h1 className="auth-title">🔑 Enter the Hall</h1>
          <p className="auth-subtitle">
            Speak your name and the word, and the door shall open.
          </p>

          <div className="rune-divider">· · ᛖᚾᛏᛖᚱ · ·</div>

          <form onSubmit={handleLogin}>
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
                placeholder="Speak the word…"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
              rune="🚪"
              disabled={loading}
              className="mt-2"
            >
              {loading ? 'Opening the door…' : 'Enter'}
            </Button>
          </form>

          <div className="rune-divider">· · ᚱᚢᚾᛖ · ·</div>

          <p className="text-center text-[0.85rem] text-dim">
            No account?{' '}
            <Link href="/signup" className="auth-link">Join the Fellowship →</Link>
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
