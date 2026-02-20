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

/**
 * Creates a Supabase client using the anon key (subject to RLS).
 * Use this for writes that need to trigger Realtime events,
 * since Realtime only broadcasts changes visible under the
 * subscriber's RLS context.
 */
export function createAnonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
