-- Durin's Door — Shares table

create table shares (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  size_bytes bigint not null,
  content_type text,
  storage_path text not null,
  password_hash text,
  max_downloads int,
  download_count int default 0,
  expires_at timestamptz,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Indexes for RLS filter columns
create index idx_shares_created_by on shares(created_by);

alter table shares enable row level security;

-- SELECT: anyone can view share metadata
create policy "Anyone can view shares" on shares
  for select to anon, authenticated
  using (true);

-- INSERT: authenticated users set created_by = their uid,
-- anonymous handshake inserts set created_by = null
create policy "Users and handshakes can create shares" on shares
  for insert to anon, authenticated
  with check (
    created_by is null
    or created_by = (select auth.uid())
  );

-- UPDATE: anyone can increment download_count
create policy "Anyone can update download count" on shares
  for update to anon, authenticated
  using (true)
  with check (true);

-- DELETE: only the owner can delete their shares
create policy "Owners can delete shares" on shares
  for delete to authenticated
  using ((select auth.uid()) = created_by);

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('encrypted-files', 'encrypted-files', true)
on conflict (id) do nothing;

-- Storage RLS
create policy "Public can read encrypted files" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'encrypted-files');

create policy "Auth users can upload encrypted files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'encrypted-files'
    and (select auth.uid()) is not null
  );

create policy "Anon can upload encrypted files" on storage.objects
  for insert to anon
  with check (bucket_id = 'encrypted-files');

create policy "Owners can delete encrypted files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'encrypted-files'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
