import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client using the service-role key.
 * Bypasses RLS — use only in server-side API routes.
 */
export function createAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
