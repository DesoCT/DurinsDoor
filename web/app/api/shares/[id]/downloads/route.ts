import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/shares/[id]/downloads — Increment the download counter.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const authErr = requireApiAuth(request)
  if (authErr) return authErr

  try {
    const { id } = await params
    const supabase = createAdminClient()

    // Verify the share exists
    const { data: share, error: fetchErr } = await supabase
      .from('shares')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchErr || !share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    const { error } = await supabase.rpc('increment_download_count', {
      share_id: id,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
