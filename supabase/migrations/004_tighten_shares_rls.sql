-- Durin's Door — Tighten shares RLS for anon role
-- Problem: "Anyone can view shares" used `using (true)` for both anon and
-- authenticated, allowing anonymous Supabase/PostgREST callers to list ALL
-- shares without any authentication.
--
-- Fix: Remove anon SELECT entirely. All public-facing share lookups are
-- routed through the Go API server, which uses the service-role key (bypasses
-- RLS) and applies its own expiry/password/exhaustion checks. Anon clients
-- have no legitimate reason to query the shares table directly.

-- Drop the old blanket policy (covers both anon + authenticated)
drop policy if exists "Anyone can view shares" on shares;

-- Authenticated users can read shares (owner dashboards, etc.)
create policy "Authenticated users can view shares" on shares
  for select to authenticated
  using (true);

-- Anon role: NO select policy → zero rows returned for any direct DB query.
-- Public file access is exclusively served by the Go API, which authenticates
-- and authorises each request before touching the database.
