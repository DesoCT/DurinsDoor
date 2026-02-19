-- Durin's Door — Shares table
-- Run this migration in your Supabase SQL editor

create table shares (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  size_bytes bigint not null,
  content_type text,
  storage_path text not null,  -- path in supabase storage bucket
  password_hash text,          -- bcrypt hash if password-protected
  max_downloads int,
  download_count int default 0,
  expires_at timestamptz,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- RLS: anyone can read share metadata, only creator can insert/delete
alter table shares enable row level security;

create policy "Anyone can view shares" on shares
  for select using (true);

create policy "Auth users can create shares" on shares
  for insert with check (auth.uid() = created_by);

create policy "Owners can delete shares" on shares
  for delete using (auth.uid() = created_by);

create policy "Anyone can update download count" on shares
  for update using (true) with check (true);

-- Storage bucket: run in SQL editor or via Supabase dashboard
-- create the bucket "encrypted-files" with public access for downloads
insert into storage.buckets (id, name, public)
values ('encrypted-files', 'encrypted-files', true)
on conflict (id) do nothing;

-- Storage RLS
create policy "Public can read encrypted files" on storage.objects
  for select using (bucket_id = 'encrypted-files');

create policy "Auth users can upload encrypted files" on storage.objects
  for insert with check (
    bucket_id = 'encrypted-files'
    and auth.uid() is not null
  );

create policy "Owners can delete encrypted files" on storage.objects
  for delete using (
    bucket_id = 'encrypted-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
