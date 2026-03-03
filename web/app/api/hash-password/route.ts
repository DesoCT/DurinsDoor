import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

/**
 * POST /api/hash-password
 *
 * Accepts a plaintext password and returns a bcrypt hash (cost 10).
 * Used by the browser upload flow because bcrypt cannot run efficiently
 * in the browser — the client sends the plaintext over HTTPS and this
 * endpoint computes the hash server-side.
 *
 * Body: { password: string }
 * Response: { hash: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Missing password' }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 10)
    return NextResponse.json({ hash })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
