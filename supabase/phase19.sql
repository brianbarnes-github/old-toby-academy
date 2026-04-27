-- ============================================================
-- Old Toby Academy — Phase 19 migration: class attachments
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive + idempotent.
--
-- Adds image and file attachments to classes, plus the storage
-- bucket they live in. Class authors upload images and files via
-- the editor; attachments render inline (images) or as downloads
-- (files). RLS mirrors the parent class.
-- ============================================================

-- ----------------------------------------------------------
-- class_attachments
-- ----------------------------------------------------------
create table if not exists public.class_attachments (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  kind         text not null check (kind in ('image', 'file')),
  file_path    text not null,
  file_name    text not null,
  file_size    bigint,
  content_type text,
  caption      text,
  created_by   uuid references auth.users,
  created_at   timestamptz not null default now()
);

create index if not exists class_attachments_class_idx
  on public.class_attachments (class_id);

-- ----------------------------------------------------------
-- RLS: class_attachments — readable when parent class readable
-- ----------------------------------------------------------
alter table public.class_attachments enable row level security;

drop policy if exists "class attachments readable when parent class readable"
  on public.class_attachments;
create policy "class attachments readable when parent class readable"
  on public.class_attachments for select
  using (
    exists (
      select 1
        from public.classes cl
        join public.courses co on co.id = cl.course_id
       where cl.id = class_attachments.class_id
         and (
           co.published_at is not null
           or co.created_by = auth.uid()
           or public.is_headmaster()
         )
         and (
           cl.published_at is not null
           or cl.created_by = auth.uid()
           or public.is_headmaster()
         )
    )
  );

drop policy if exists "class attachments insertable by class owner"
  on public.class_attachments;
create policy "class attachments insertable by class owner"
  on public.class_attachments for insert
  with check (
    public.has_permission('courses.author')
    and created_by = auth.uid()
    and exists (
      select 1
        from public.classes cl
       where cl.id = class_attachments.class_id
         and (cl.created_by = auth.uid() or public.is_headmaster())
    )
  );

drop policy if exists "class attachments deletable by class owner"
  on public.class_attachments;
create policy "class attachments deletable by class owner"
  on public.class_attachments for delete
  using (
    exists (
      select 1
        from public.classes cl
       where cl.id = class_attachments.class_id
         and (cl.created_by = auth.uid() or public.is_headmaster())
    )
  );

-- ----------------------------------------------------------
-- Storage bucket: class-files (mirrors library-files from Phase 17)
-- ----------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('class-files', 'class-files', true, 10 * 1024 * 1024)
on conflict (id) do update
  set public          = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "anyone reads class files" on storage.objects;
create policy "anyone reads class files"
  on storage.objects for select
  using (bucket_id = 'class-files');

drop policy if exists "authors manage class files" on storage.objects;
create policy "authors manage class files"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'class-files'
    and public.has_permission('courses.author')
  )
  with check (
    bucket_id = 'class-files'
    and public.has_permission('courses.author')
  );

-- ----------------------------------------------------------
-- Mark this migration applied
-- ----------------------------------------------------------
insert into public.schema_migrations (filename) values ('phase19.sql')
on conflict (filename) do nothing;
