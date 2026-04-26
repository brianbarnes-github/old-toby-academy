-- ============================================================
-- Old Toby Academy — Phase 20 migration: in-class quizzes
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive + idempotent.
--
-- A class can have one or more quizzes; each quiz has one or
-- more single-correct multiple-choice questions; each question
-- has one or more options, exactly one of which is correct.
-- Authors mount a quiz in the class body via a shortcode:
--   [[quiz: my-quiz-slug]]
-- Student answers persist in progress_marks (Phase 15) using
-- mark_type='quiz' and mark_key='<class_id>:<question_id>'.
-- ============================================================

-- ----------------------------------------------------------
-- class_quizzes
-- ----------------------------------------------------------
create table if not exists public.class_quizzes (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  slug        text not null,
  title       text not null,
  intro_md    text,
  order_index int not null default 0,
  created_by  uuid references auth.users,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (class_id, slug)
);

create index if not exists class_quizzes_class_idx
  on public.class_quizzes (class_id, order_index);

-- ----------------------------------------------------------
-- class_quiz_questions
-- ----------------------------------------------------------
create table if not exists public.class_quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.class_quizzes(id) on delete cascade,
  prompt_md      text not null,
  explanation_md text,
  order_index    int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists class_quiz_questions_quiz_idx
  on public.class_quiz_questions (quiz_id, order_index);

-- ----------------------------------------------------------
-- class_quiz_options
-- ----------------------------------------------------------
create table if not exists public.class_quiz_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.class_quiz_questions(id) on delete cascade,
  label       text not null,
  is_correct  boolean not null default false,
  order_index int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists class_quiz_options_question_idx
  on public.class_quiz_options (question_id, order_index);

-- Enforce: at most one option marked correct per question.
-- (We rely on the editor to ensure exactly one; an empty-correct
-- question is a draft state we tolerate.)
create unique index if not exists class_quiz_options_one_correct
  on public.class_quiz_options (question_id)
  where is_correct = true;

-- ----------------------------------------------------------
-- updated_at triggers (reuse Phase 16's helper if present)
-- ----------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_proc where proname = 'touch_updated_at') then
    drop trigger if exists touch_class_quizzes_updated on public.class_quizzes;
    create trigger touch_class_quizzes_updated
      before update on public.class_quizzes
      for each row execute function public.touch_updated_at();

    drop trigger if exists touch_class_quiz_questions_updated on public.class_quiz_questions;
    create trigger touch_class_quiz_questions_updated
      before update on public.class_quiz_questions
      for each row execute function public.touch_updated_at();
  end if;
end $$;

-- ----------------------------------------------------------
-- RLS — readable when parent class is readable; mutated by
-- the class author or headmaster.
-- ----------------------------------------------------------
alter table public.class_quizzes        enable row level security;
alter table public.class_quiz_questions enable row level security;
alter table public.class_quiz_options   enable row level security;

-- ---- class_quizzes ----
drop policy if exists "quizzes readable when parent class readable" on public.class_quizzes;
create policy "quizzes readable when parent class readable"
  on public.class_quizzes for select
  using (
    exists (
      select 1
        from public.classes cl
        join public.courses co on co.id = cl.course_id
       where cl.id = class_quizzes.class_id
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

drop policy if exists "quizzes writable by class owner" on public.class_quizzes;
create policy "quizzes writable by class owner"
  on public.class_quizzes for all
  using (
    exists (
      select 1
        from public.classes cl
       where cl.id = class_quizzes.class_id
         and (cl.created_by = auth.uid() or public.is_headmaster())
    )
  )
  with check (
    public.has_permission('courses.author')
    and exists (
      select 1
        from public.classes cl
       where cl.id = class_quizzes.class_id
         and (cl.created_by = auth.uid() or public.is_headmaster())
    )
  );

-- ---- class_quiz_questions ----
drop policy if exists "quiz questions readable when quiz readable" on public.class_quiz_questions;
create policy "quiz questions readable when quiz readable"
  on public.class_quiz_questions for select
  using (
    exists (
      select 1
        from public.class_quizzes q
        join public.classes cl on cl.id = q.class_id
        join public.courses co on co.id = cl.course_id
       where q.id = class_quiz_questions.quiz_id
         and (co.published_at is not null or co.created_by = auth.uid() or public.is_headmaster())
         and (cl.published_at is not null or cl.created_by = auth.uid() or public.is_headmaster())
    )
  );

drop policy if exists "quiz questions writable by class owner" on public.class_quiz_questions;
create policy "quiz questions writable by class owner"
  on public.class_quiz_questions for all
  using (
    exists (
      select 1
        from public.class_quizzes q
        join public.classes cl on cl.id = q.class_id
       where q.id = class_quiz_questions.quiz_id
         and (cl.created_by = auth.uid() or public.is_headmaster())
    )
  )
  with check (
    public.has_permission('courses.author')
    and exists (
      select 1
        from public.class_quizzes q
        join public.classes cl on cl.id = q.class_id
       where q.id = class_quiz_questions.quiz_id
         and (cl.created_by = auth.uid() or public.is_headmaster())
    )
  );

-- ---- class_quiz_options ----
drop policy if exists "quiz options readable when question readable" on public.class_quiz_options;
create policy "quiz options readable when question readable"
  on public.class_quiz_options for select
  using (
    exists (
      select 1
        from public.class_quiz_questions qq
        join public.class_quizzes q on q.id = qq.quiz_id
        join public.classes cl on cl.id = q.class_id
        join public.courses co on co.id = cl.course_id
       where qq.id = class_quiz_options.question_id
         and (co.published_at is not null or co.created_by = auth.uid() or public.is_headmaster())
         and (cl.published_at is not null or cl.created_by = auth.uid() or public.is_headmaster())
    )
  );

drop policy if exists "quiz options writable by class owner" on public.class_quiz_options;
create policy "quiz options writable by class owner"
  on public.class_quiz_options for all
  using (
    exists (
      select 1
        from public.class_quiz_questions qq
        join public.class_quizzes q on q.id = qq.quiz_id
        join public.classes cl on cl.id = q.class_id
       where qq.id = class_quiz_options.question_id
         and (cl.created_by = auth.uid() or public.is_headmaster())
    )
  )
  with check (
    public.has_permission('courses.author')
    and exists (
      select 1
        from public.class_quiz_questions qq
        join public.class_quizzes q on q.id = qq.quiz_id
        join public.classes cl on cl.id = q.class_id
       where qq.id = class_quiz_options.question_id
         and (cl.created_by = auth.uid() or public.is_headmaster())
    )
  );

-- ----------------------------------------------------------
-- Mark this migration applied
-- ----------------------------------------------------------
insert into public.schema_migrations (filename) values ('phase20.sql')
on conflict (filename) do nothing;
