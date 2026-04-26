-- ============================================================
-- Old Toby Academy — Phase 10 migration: avatars + bio
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive + idempotent. Adds two profile columns and a storage
-- bucket for avatar uploads.
-- ============================================================

-- ----------------------------------------------------------
-- profiles: avatar URL + bio
-- ----------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists bio        text;

alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add  constraint profiles_bio_length check (bio is null or char_length(bio) <= 500);

-- ----------------------------------------------------------
-- Storage: 'avatars' bucket — public read, owner write
-- File path convention: <user_id>/avatar.<ext>
-- ----------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024,
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone authenticated can list/read objects in the avatars bucket
-- (the public flag covers anonymous public-URL reads; this covers
-- authenticated API reads).
drop policy if exists "auth reads avatars" on storage.objects;
create policy "auth reads avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

-- A user can write/update/delete only objects in their own folder.
drop policy if exists "users manage own avatars" on storage.objects;
create policy "users manage own avatars"
  on storage.objects for all to authenticated
  using      (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
