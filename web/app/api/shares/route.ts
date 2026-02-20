import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { shareToApiJson } from '@/lib/api-mappers'

/**
 * GET /api/shares — List all shares.
 */
export async function GET(request: NextRequest) {
  const authErr = requireApiAuth(request)
  if (authErr) return authErr

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('shares')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json((data ?? []).map(shareToApiJson))
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
