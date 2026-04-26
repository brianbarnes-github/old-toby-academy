-- ============================================================
-- Old Toby Academy — Phase 15 migration: progress tracking
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive + idempotent.
--
-- A generic progress-marks table that's shape-agnostic about how
-- course content is authored. Each row is one (user, course,
-- mark_type, mark_key) tuple with a JSONB value payload.
--
-- Examples:
--   exercise step done   → mark_type=exercise, key=step-3,
--                          value={completed: true}
--   quiz question        → mark_type=quiz,     key=q-5,
--                          value={answered: 'C2', correct: true}
--   lesson section read  → mark_type=section,  key=intro,
--                          value={viewed_at: '2026-04-26T...'}
--   whole-lesson done    → mark_type=lesson,   key=abc-101,
--                          value={completed_at: '...'}
-- ============================================================

create table if not exists public.progress_marks (
  id          bigserial primary key,
  user_id     uuid not null references auth.users on delete cascade,
  course_slug text not null,
  mark_type   text not null check (mark_type in ('section', 'exercise', 'quiz', 'lesson')),
  mark_key    text not null,
  value       jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  unique (user_id, course_slug, mark_type, mark_key)
);

create index if not exists progress_marks_user_course_idx
  on public.progress_marks (user_id, course_slug);
create index if not exists progress_marks_course_type_idx
  on public.progress_marks (course_slug, mark_type);

alter table public.progress_marks enable row level security;

drop policy if exists "self manages own progress" on public.progress_marks;
create policy "self manages own progress"
  on public.progress_marks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------
-- progress.read — for faculty / headmaster dashboards (future)
-- ----------------------------------------------------------
insert into public.permissions (slug, area, action, description, is_system)
values ('progress.read', 'progress', 'read',
        'Read progress marks for any member (for dashboards/grading)', true)
on conflict (slug) do update
  set area        = excluded.area,
      action      = excluded.action,
      description = excluded.description,
      is_system   = excluded.is_system;

-- Bundle into headmaster.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r, public.permissions p
 where r.slug = 'headmaster'
   and p.slug = 'progress.read'
on conflict do nothing;

drop policy if exists "privileged reads all progress" on public.progress_marks;
create policy "privileged reads all progress"
  on public.progress_marks for select
  using (public.has_permission('progress.read'));

-- Mark this migration applied
insert into public.schema_migrations (filename) values ('phase15.sql')
on conflict (filename) do nothing;
