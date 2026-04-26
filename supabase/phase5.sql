-- ============================================================
-- Old Toby Academy — Phase 5 migration: token revocation
-- Run once in your Supabase project: SQL Editor → paste → RUN.
-- Additive only — does NOT drop existing data.
-- Idempotent: re-runs cleanly.
-- ============================================================

-- ----------------------------------------------------------
-- invite_tokens: revocation columns
-- ----------------------------------------------------------
alter table public.invite_tokens
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users;

-- ----------------------------------------------------------
-- is_token_valid: revoked tokens are no longer valid
-- ----------------------------------------------------------
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
      and used_at    is null
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  );
$$;

-- ----------------------------------------------------------
-- redeem_token: also reject revoked tokens (the SELECT lock
-- in the original function only checked used_at + expires_at,
-- so we mirror is_token_valid's filter here).
-- ----------------------------------------------------------
create or replace function public.redeem_token(
  p_token     text,
  p_character text default null,
  p_server    text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   text;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'must be authenticated';
  end if;

  select role into v_role
    from public.invite_tokens
   where token = p_token
     and used_at    is null
     and revoked_at is null
     and (expires_at is null or expires_at > now())
     for update;

  if v_role is null then
    raise exception 'invalid or expired token';
  end if;

  update public.invite_tokens
     set used_at = now(), used_by = v_caller
   where token = p_token;

  update public.profiles
     set role           = v_role,
         character_name = coalesce(p_character, character_name),
         server         = coalesce(p_server, server)
   where user_id = v_caller;

  insert into public.entries (user_id, event_type, details)
  values (
    v_caller,
    'token_redeemed',
    jsonb_build_object(
      'token',          p_token,
      'role',           v_role,
      'character_name', p_character,
      'server',         p_server
    )
  );

  return v_role;
end;
$$;

-- ----------------------------------------------------------
-- revoke_invite_token: headmaster invalidates an active token.
-- Safe to call on already-used or already-revoked tokens
-- (no-op in either case). Returns true if it actually revoked
-- a token, false otherwise.
-- ----------------------------------------------------------
create or replace function public.revoke_invite_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_count  int;
begin
  if not public.is_headmaster() then
    raise exception 'only headmaster can revoke tokens';
  end if;

  update public.invite_tokens
     set revoked_at = now(),
         revoked_by = v_caller
   where token = p_token
     and used_at    is null
     and revoked_at is null;

  get diagnostics v_count = row_count;

  if v_count > 0 then
    insert into public.entries (user_id, event_type, details)
    values (
      v_caller,
      'token_revoked',
      jsonb_build_object('token', p_token)
    );
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.revoke_invite_token(text) to authenticated;

-- ----------------------------------------------------------
-- Update the admin view so the table shows a 'revoked' status.
-- DROP-then-CREATE because we're adding to the SELECT list.
-- ----------------------------------------------------------
drop view if exists public.invite_tokens_admin;
create view public.invite_tokens_admin as
  select
    token,
    role,
    notes,
    expires_at,
    used_at,
    used_by,
    revoked_at,
    revoked_by,
    created_at,
    case
      when revoked_at is not null then 'revoked'
      when used_at    is not null then 'used'
      when expires_at is not null and expires_at <= now() then 'expired'
      else 'active'
    end as status
  from public.invite_tokens
  order by created_at desc;
