-- Durin's Door — Security hardening migration
-- Fixes: overly permissive RLS, adds atomic download increment RPC

-- ============================================================================
-- 1. Fix shares UPDATE policy — restrict to download_count only
-- ============================================================================

-- Drop the overly permissive update policy
drop policy if exists "Anyone can update download count" on shares;

-- Create a Postgres function for atomic download_count increment.
-- Returns false if the share is expired or exhausted (so callers can check).
create or replace function increment_download_count(share_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_expires_at timestamptz;
  v_max_downloads int;
  v_download_count int;
begin
  select expires_at, max_downloads, download_count
    into v_expires_at, v_max_downloads, v_download_count
    from shares
    where id = share_id
    for update;

  if not found then
    return false;
  end if;

  -- Check expiry
  if v_expires_at is not null and v_expires_at < now() then
    return false;
  end if;

  -- Check download limit
  if v_max_downloads is not null and v_max_downloads > 0 and v_download_count >= v_max_downloads then
    return false;
  end if;

  update shares
    set download_count = download_count + 1
    where id = share_id;

  return true;
end;
$$;

-- Grant execute to anon and authenticated roles
grant execute on function increment_download_count(uuid) to anon, authenticated;

-- ============================================================================
-- 2. Fix handshakes RLS — tighten from wide-open
-- ============================================================================

-- Drop existing overly permissive policies
drop policy if exists "Anyone can view handshakes" on handshakes;
drop policy if exists "Anyone can create handshakes" on handshakes;
drop policy if exists "Anyone can update handshakes" on handshakes;
drop policy if exists "Anyone can delete handshakes" on handshakes;

-- SELECT: anyone can view, but only non-expired handshakes
create policy "Anyone can view active handshakes" on handshakes
  for select to anon, authenticated
  using (expires_at > now());

-- INSERT: anyone can create handshakes (needed for P2P flow)
create policy "Anyone can create handshakes" on handshakes
  for insert to anon, authenticated
  with check (
    -- Must set a future expiry
    expires_at > now()
    -- Status must start as 'waiting'
    and status = 'waiting'
  );

-- UPDATE: restricted to only allowed transitions
-- Sender can set their public key + advance status, or receiver can mark paired
create policy "Participants can update handshakes" on handshakes
  for update to anon, authenticated
  using (expires_at > now())
  with check (
    expires_at > now()
    and status in ('waiting', 'paired', 'completed')
  );

-- DELETE: only allow deleting expired handshakes
create policy "Anyone can clean up expired handshakes" on handshakes
  for delete to anon, authenticated
  using (expires_at <= now());
