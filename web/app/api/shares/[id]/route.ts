import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { shareToApiJson } from '@/lib/api-mappers'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/shares/[id] — Fetch share metadata by ID.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const authErr = requireApiAuth(request)
  if (authErr) return authErr

  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('shares')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    return NextResponse.json(shareToApiJson(data))
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * DELETE /api/shares/[id] — Revoke a share (delete row + storage file).
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const authErr = requireApiAuth(request)
  if (authErr) return authErr

  try {
    const { id } = await params
    const supabase = createAdminClient()

    // Fetch the share to get the storage path
    const { data: share, error: fetchErr } = await supabase
      .from('shares')
      .select('id, storage_path')
      .eq('id', id)
      .single()

    if (fetchErr || !share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    // Remove from storage
    if (share.storage_path) {
      await supabase.storage.from('encrypted-files').remove([share.storage_path])
    }

    // Delete the database row
    const { error: delErr } = await supabase
      .from('shares')
      .delete()
      .eq('id', id)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ status: 'revoked', id })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
