import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { handshakeToApiJson } from '@/lib/api-mappers'

/**
 * POST /api/handshakes — Create a new handshake.
 * Body: { code, receiver_public_key }
 */
export async function POST(request: NextRequest) {
  const authErr = requireApiAuth(request)
  if (authErr) return authErr

  try {
    const { code, receiver_public_key } = await request.json()
    if (!code || !receiver_public_key) {
      return NextResponse.json(
        { error: 'code and receiver_public_key are required' },
        { status: 400 },
      )
    }

    const supabase = createAdminClient()

    // Check for duplicate code among active handshakes
    const { data: existing } = await supabase
      .from('handshakes')
      .select('id')
      .eq('code', code)
      .in('status', ['waiting', 'paired'])
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Code already in use' }, { status: 409 })
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('handshakes')
      .insert({
        code,
        receiver_public_key,
        status: 'waiting',
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? 'Failed to create handshake' },
        { status: 500 },
      )
    }

    return NextResponse.json(handshakeToApiJson(data), { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * GET /api/handshakes?code=CODE — Look up a handshake by pairing code.
 */
export async function GET(request: NextRequest) {
  const authErr = requireApiAuth(request)
  if (authErr) return authErr

  try {
    const code = request.nextUrl.searchParams.get('code')
    if (!code) {
      return NextResponse.json(
        { error: 'Missing code query parameter' },
        { status: 400 },
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('handshakes')
      .select('*')
      .eq('code', code)
      .in('status', ['waiting', 'paired'])
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Handshake not found for code' },
        { status: 404 },
      )
    }

    return NextResponse.json(handshakeToApiJson(data))
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
