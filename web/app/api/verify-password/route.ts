import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { shareId, passwordHash } = await req.json()

    if (!shareId || !passwordHash) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: share, error } = await supabase
      .from('shares')
      .select('id, password_hash, expires_at, max_downloads, download_count')
      .eq('id', shareId)
      .single()

    if (error || !share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Share has expired' }, { status: 410 })
    }

    // Check download limit
    if (share.max_downloads && share.download_count >= share.max_downloads) {
      return NextResponse.json({ error: 'Download limit reached' }, { status: 410 })
    }

    // Verify password hash (SHA-256 stored as base64)
    if (share.password_hash !== passwordHash) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
