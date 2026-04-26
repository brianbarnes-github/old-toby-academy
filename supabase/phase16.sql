-- ============================================================
-- Old Toby Academy — Phase 16: dynamic course system v1
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive + idempotent.
-- ============================================================

-- ----------------------------------------------------------
-- courses
-- ----------------------------------------------------------
create table if not exists public.courses (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  summary      text,
  description  text,
  order_mode   text not null check (order_mode in ('all', 'sequential')) default 'all',
  published_at timestamptz,
  created_by   uuid references auth.users,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists courses_published_idx on public.courses (published_at) where published_at is not null;
create index if not exists courses_created_by_idx on public.courses (created_by);

-- ----------------------------------------------------------
-- classes
-- ----------------------------------------------------------
create table if not exists public.classes (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses on delete cascade,
  slug         text not null,
  title        text not null,
  summary      text,
  body_md      text not null default '',
  order_index  int not null default 0,
  published_at timestamptz,
  closed_at    timestamptz,
  created_by   uuid references auth.users,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (course_id, slug)
);

create index if not exists classes_course_order_idx on public.classes (course_id, order_index);

-- ----------------------------------------------------------
-- New permission: courses.author
-- ----------------------------------------------------------
insert into public.permissions (slug, area, action, description, is_system)
values ('courses.author', 'courses', 'author',
        'Create and manage your own courses + classes', true)
on conflict (slug) do update
  set area        = excluded.area,
      action      = excluded.action,
      description = excluded.description,
      is_system   = excluded.is_system;

-- Bundle into faculty + headmaster (faculty's first real ability)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r, public.permissions p
 where r.slug in ('faculty', 'headmaster')
   and p.slug = 'courses.author'
on conflict do nothing;

-- ----------------------------------------------------------
-- RLS: courses
-- ----------------------------------------------------------
alter table public.courses enable row level security;

drop policy if exists "courses readable when published or by author" on public.courses;
create policy "courses readable when published or by author"
  on public.courses for select
  using (
    published_at is not null
    or created_by = auth.uid()
    or public.is_headmaster()
  );

drop policy if exists "courses insertable by authors" on public.courses;
create policy "courses insertable by authors"
  on public.courses for insert
  with check (
    public.has_permission('courses.author')
    and created_by = auth.uid()
  );

drop policy if exists "courses mutable by owner or headmaster" on public.courses;
create policy "courses mutable by owner or headmaster"
  on public.courses for update
  using (created_by = auth.uid() or public.is_headmaster())
  with check (created_by = auth.uid() or public.is_headmaster());

drop policy if exists "courses deletable by owner or headmaster" on public.courses;
create policy "courses deletable by owner or headmaster"
  on public.courses for delete
  using (created_by = auth.uid() or public.is_headmaster());

-- ----------------------------------------------------------
-- RLS: classes — mirror courses
-- ----------------------------------------------------------
alter table public.classes enable row level security;

drop policy if exists "classes readable if parent course readable" on public.classes;
create policy "classes readable if parent course readable"
  on public.classes for select
  using (
    -- A user can read a class if they can read its parent course AND
    -- (the class is published OR they're the author/headmaster).
    exists (
      select 1 from public.courses c
       where c.id = classes.course_id
         and (c.published_at is not null
              or c.created_by = auth.uid()
              or public.is_headmaster())
    )
    and (
      published_at is not null
      or created_by = auth.uid()
      or public.is_headmaster()
    )
  );

drop policy if exists "classes insertable by authors" on public.classes;
create policy "classes insertable by authors"
  on public.classes for insert
  with check (
    public.has_permission('courses.author')
    and created_by = auth.uid()
  );

drop policy if exists "classes mutable by owner or headmaster" on public.classes;
create policy "classes mutable by owner or headmaster"
  on public.classes for update
  using (created_by = auth.uid() or public.is_headmaster())
  with check (created_by = auth.uid() or public.is_headmaster());

drop policy if exists "classes deletable by owner or headmaster" on public.classes;
create policy "classes deletable by owner or headmaster"
  on public.classes for delete
  using (created_by = auth.uid() or public.is_headmaster());

-- ----------------------------------------------------------
-- updated_at triggers (touch on every UPDATE)
-- ----------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists courses_touch_updated_at on public.courses;
create trigger courses_touch_updated_at
  before update on public.courses
  for each row execute function public.touch_updated_at();

drop trigger if exists classes_touch_updated_at on public.classes;
create trigger classes_touch_updated_at
  before update on public.classes
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------
-- Mark this migration applied
-- ----------------------------------------------------------
insert into public.schema_migrations (filename) values ('phase16.sql')
on conflict (filename) do nothing;
