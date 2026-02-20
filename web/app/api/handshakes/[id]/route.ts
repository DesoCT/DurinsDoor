import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { createAdminClient, createAnonClient } from '@/lib/supabase/admin'
import { handshakeToApiJson } from '@/lib/api-mappers'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/handshakes/[id] — Fetch a handshake by ID.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const authErr = requireApiAuth(request)
  if (authErr) return authErr

  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('handshakes')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Handshake not found' }, { status: 404 })
    }

    return NextResponse.json(handshakeToApiJson(data))
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * PATCH /api/handshakes/[id] — Update sender_public_key and/or share_id.
 *
 * Auto-sets status for Realtime compatibility:
 *   sender_public_key set → status = 'paired'
 *   share_id set          → status = 'completed'
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const authErr = requireApiAuth(request)
  if (authErr) return authErr

  try {
    const { id } = await params
    const body = await request.json()
    // Use anon client so the write triggers Realtime events for
    // subscribers using the anon key (the browser receive page).
    const supabase = createAnonClient()

    // Build the update object, auto-setting status transitions
    const update: Record<string, unknown> = {}

    if (body.sender_public_key !== undefined) {
      update.sender_public_key = body.sender_public_key
      update.status = 'paired'
    }

    if (body.share_id !== undefined) {
      update.share_id = body.share_id
      update.status = 'completed'
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('handshakes')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? 'Handshake not found' },
        { status: error ? 500 : 404 },
      )
    }

    return NextResponse.json(handshakeToApiJson(data))
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
