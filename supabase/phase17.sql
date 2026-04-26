-- ============================================================
-- Old Toby Academy — Phase 17: The Library
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive + idempotent.
--
-- A flat collection of reference documents (music theory PDFs,
-- ABC examples, MIDI files, etc.) — separate from the structured
-- course system. Faculty uploads, members download.
-- ============================================================

-- ----------------------------------------------------------
-- library_entries
-- ----------------------------------------------------------
create table if not exists public.library_entries (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  description  text,
  category     text,
  file_path    text not null,                       -- path inside library-files bucket
  file_name    text not null,                       -- original filename
  file_size    bigint,
  content_type text,
  created_by   uuid references auth.users,
  published_at timestamptz,                          -- null = draft
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists library_entries_category_idx
  on public.library_entries (category);
create index if not exists library_entries_published_idx
  on public.library_entries (published_at)
  where published_at is not null;

-- ----------------------------------------------------------
-- library.contribute permission
-- ----------------------------------------------------------
insert into public.permissions (slug, area, action, description, is_system)
values ('library.contribute', 'library', 'contribute',
        'Upload and manage Library entries', true)
on conflict (slug) do update
  set area        = excluded.area,
      action      = excluded.action,
      description = excluded.description,
      is_system   = excluded.is_system;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r, public.permissions p
 where r.slug in ('faculty', 'headmaster')
   and p.slug = 'library.contribute'
on conflict do nothing;

-- ----------------------------------------------------------
-- RLS
-- ----------------------------------------------------------
alter table public.library_entries enable row level security;

drop policy if exists "library readable when published or by author" on public.library_entries;
create policy "library readable when published or by author"
  on public.library_entries for select
  using (
    published_at is not null
    or created_by = auth.uid()
    or public.is_headmaster()
  );

drop policy if exists "library insertable by contributors" on public.library_entries;
create policy "library insertable by contributors"
  on public.library_entries for insert
  with check (
    public.has_permission('library.contribute')
    and created_by = auth.uid()
  );

drop policy if exists "library mutable by owner or headmaster" on public.library_entries;
create policy "library mutable by owner or headmaster"
  on public.library_entries for update
  using (created_by = auth.uid() or public.is_headmaster())
  with check (created_by = auth.uid() or public.is_headmaster());

drop policy if exists "library deletable by owner or headmaster" on public.library_entries;
create policy "library deletable by owner or headmaster"
  on public.library_entries for delete
  using (created_by = auth.uid() or public.is_headmaster());

-- ----------------------------------------------------------
-- updated_at trigger (reuses public.touch_updated_at from Phase 16)
-- ----------------------------------------------------------
drop trigger if exists library_touch_updated_at on public.library_entries;
create trigger library_touch_updated_at
  before update on public.library_entries
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------
-- Storage bucket: library-files
-- Public read; contributors write/delete. Public access is fine —
-- entries are reference documents, members are trusted, and a leaked
-- URL just exposes a music-theory PDF.
-- ----------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('library-files', 'library-files', true, 10 * 1024 * 1024)
on conflict (id) do update
  set public          = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "anyone reads library files" on storage.objects;
create policy "anyone reads library files"
  on storage.objects for select
  using (bucket_id = 'library-files');

drop policy if exists "contributors manage library files" on storage.objects;
create policy "contributors manage library files"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'library-files'
    and public.has_permission('library.contribute')
  )
  with check (
    bucket_id = 'library-files'
    and public.has_permission('library.contribute')
  );

-- ----------------------------------------------------------
-- Mark this migration applied
-- ----------------------------------------------------------
insert into public.schema_migrations (filename) values ('phase17.sql')
on conflict (filename) do nothing;
