-- Durin's Door — Handshake table for P2P key exchange
-- Run this migration AFTER 001_shares.sql

create table handshakes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  receiver_public_key text not null,
  sender_public_key text,
  share_id uuid references shares(id) on delete set null,
  status text default 'waiting',
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Indexes for RLS filter and lookup columns
create index idx_handshakes_code on handshakes(code);
create index idx_handshakes_status on handshakes(status);
create index idx_handshakes_expires_at on handshakes(expires_at);

alter table handshakes enable row level security;

-- SELECT: anyone can look up handshakes by code
create policy "Anyone can view handshakes" on handshakes
  for select to anon, authenticated
  using (true);

-- INSERT: anyone can create a handshake
create policy "Anyone can create handshakes" on handshakes
  for insert to anon, authenticated
  with check (true);

-- UPDATE: anyone can update handshakes (sender connects, status changes)
create policy "Anyone can update handshakes" on handshakes
  for update to anon, authenticated
  using (true)
  with check (true);

-- DELETE: anyone can clean up expired handshakes
create policy "Anyone can delete handshakes" on handshakes
  for delete to anon, authenticated
  using (true);

-- Enable realtime for handshakes (uncomment in Supabase dashboard if needed)
-- alter publication supabase_realtime add table handshakes;
