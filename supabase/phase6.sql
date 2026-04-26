-- ============================================================
-- Old Toby Academy — Phase 6 migration: redesigned profile step
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive only — does NOT drop existing tables or data.
-- The old instrument / why_joining / experience columns remain
-- in place (already filled for some accounts) but are no longer
-- collected by the welcome wizard.
-- ============================================================

-- New profile columns: three experience levels + free-text hopes.
alter table public.profiles
  add column if not exists music_level        text,
  add column if not exists ingame_music_level text,
  add column if not exists technical_level    text,
  add column if not exists hopes              text;

-- CHECK constraints. Drop-then-add for idempotency (Postgres doesn't
-- have ADD CONSTRAINT IF NOT EXISTS; the drop is a no-op if absent).
alter table public.profiles drop constraint if exists profiles_music_level_check;
alter table public.profiles add  constraint profiles_music_level_check
  check (music_level is null or music_level in ('none','beginner','intermediate','advanced','expert'));

alter table public.profiles drop constraint if exists profiles_ingame_music_level_check;
alter table public.profiles add  constraint profiles_ingame_music_level_check
  check (ingame_music_level is null or ingame_music_level in ('none','beginner','intermediate','advanced','expert'));

alter table public.profiles drop constraint if exists profiles_technical_level_check;
alter table public.profiles add  constraint profiles_technical_level_check
  check (technical_level is null or technical_level in ('none','beginner','intermediate','advanced','expert'));
