import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/download
 *
 * Proxies encrypted file downloads from Supabase Storage.
 * For password-protected shares, verifies the password hash before serving.
 * This prevents bypassing password protection by downloading directly from
 * the public storage bucket.
 *
 * Body: { shareId: string, passwordHash?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { shareId, passwordHash } = await req.json()

    if (!shareId) {
      return NextResponse.json({ error: 'Missing shareId' }, { status: 400 })
    }

    // Use service role key to bypass RLS for server-side verification
    const supabase = createAdminClient()

    const { data: share, error } = await supabase
      .from('shares')
      .select('id, storage_path, filename, content_type, password_hash, expires_at, max_downloads, download_count')
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

    // Verify password if the share is password-protected
    if (share.password_hash) {
      if (!passwordHash) {
        return NextResponse.json({ error: 'Password required' }, { status: 401 })
      }
      if (share.password_hash !== passwordHash) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
      }
    }

    // Atomically increment download count
    await supabase.rpc('increment_download_count', { share_id: shareId })

    // Download the encrypted blob using the service role (bypasses storage RLS)
    const { data: blob, error: dlError } = await supabase.storage
      .from('encrypted-files')
      .download(share.storage_path)

    if (dlError || !blob) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
    }

    // Stream the encrypted blob to the client
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
