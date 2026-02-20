import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/shares/[id]/file — Download the encrypted blob.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const authErr = requireApiAuth(request)
  if (authErr) return authErr

  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { data: share, error } = await supabase
      .from('shares')
      .select('id, storage_path, filename, expires_at, max_downloads, download_count')
      .eq('id', id)
      .single()

    if (error || !share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Share expired' }, { status: 410 })
    }

    // Check download limit
    if (share.max_downloads && share.download_count >= share.max_downloads) {
      return NextResponse.json({ error: 'Download limit reached' }, { status: 410 })
    }

    const { data: blob, error: dlError } = await supabase.storage
      .from('encrypted-files')
      .download(share.storage_path)

    if (dlError || !blob) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
    }

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
