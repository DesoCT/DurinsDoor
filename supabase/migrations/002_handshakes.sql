-- Durin's Door — Handshake table for P2P key exchange
-- Run this migration AFTER 001_shares.sql

create table handshakes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,               -- 6-char pairing code
  receiver_public_key text not null,        -- base64 ECDH P-256 public key
  sender_public_key text,                   -- filled when sender connects
  share_id uuid references shares(id) on delete set null,  -- linked once file is uploaded
  status text default 'waiting',            -- waiting | paired | completed | expired
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index idx_handshakes_code on handshakes(code);
create index idx_handshakes_status on handshakes(status);
create index idx_handshakes_expires_at on handshakes(expires_at);

-- RLS: anyone can interact with handshakes (they're ephemeral + code-gated)
alter table handshakes enable row level security;

create policy "Anyone can interact with handshakes" on handshakes
  for all using (true) with check (true);

-- Enable realtime for handshakes (run in Supabase dashboard if needed)
-- alter publication supabase_realtime add table handshakes;
