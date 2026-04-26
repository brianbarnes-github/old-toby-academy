-- ============================================================
-- Old Toby Academy — Phase 3 migration
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive only — does NOT drop existing tables or data.
-- Idempotent: re-runs cleanly; replaces functions in place.
-- ============================================================

-- Character names are the academy's user identifier.
-- Unique (case-insensitive) when set; null is allowed for the
-- pre-character-auth headmaster account.
create unique index if not exists profiles_character_name_unique_ci
  on public.profiles (lower(character_name))
  where character_name is not null;

-- Public helper so /signup can check name availability without
-- exposing the profiles table to anonymous users.
create or replace function public.is_character_name_available(p_name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where character_name is not null
      and lower(character_name) = lower(p_name)
  );
$$;

grant execute on function public.is_character_name_available(text) to anon, authenticated;


-- Public function: any authenticated user can ask whether a token
-- is currently redeemable, without needing read access to the
-- invite_tokens table itself (RLS keeps that headmaster-only).
create or replace function public.is_token_valid(p_token text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.invite_tokens
    where token = p_token
      and used_at is null
      and (expires_at is null or expires_at > now())
  );
$$;

grant execute on function public.is_token_valid(text) to anon, authenticated;

-- ----------------------------------------------------------
-- Token generation: a SECURITY DEFINER function so the headmaster's
-- API handler can insert into invite_tokens via the server client
-- without needing service_role. The RLS policy already enforces
-- that only the headmaster reaches this code path.
-- ----------------------------------------------------------
create or replace function public.generate_invite_token(p_role text, p_expires_days int default 30)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_token  text;
begin
  if not public.is_headmaster() then
    raise exception 'only headmaster can generate tokens';
  end if;

  if p_role not in ('student', 'faculty') then
    raise exception 'role must be student or faculty';
  end if;

  -- 16-char URL-safe token from random bytes (base64-like, hex for simplicity)
  v_token := encode(gen_random_bytes(12), 'hex');

  insert into public.invite_tokens (token, role, expires_at, created_by)
  values (
    v_token,
    p_role,
    case when p_expires_days > 0 then now() + (p_expires_days || ' days')::interval else null end,
    v_caller
  );

  return v_token;
end;
$$;

grant execute on function public.generate_invite_token(text, int) to authenticated;

-- ----------------------------------------------------------
-- List tokens for the admin UI. Returns only the headmaster's tokens
-- (RLS already enforces this; this view is for convenience).
-- ----------------------------------------------------------
create or replace view public.invite_tokens_admin as
  select
    token,
    role,
    expires_at,
    used_at,
    used_by,
    created_at,
    case
      when used_at is not null then 'used'
      when expires_at is not null and expires_at <= now() then 'expired'
      else 'active'
    end as status
  from public.invite_tokens
  order by created_at desc;
