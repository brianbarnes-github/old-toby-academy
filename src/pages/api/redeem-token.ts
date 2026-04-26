import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { characterNameToEmail, slugifyName } from '../../lib/auth';
import { verifyCsrf } from '../../lib/csrf';
import { getClientIp } from '../../lib/request';

export const prerender = false;

const RATE_LIMIT = 5; // attempts per minute per IP

function fail(redirect: any, message: string, fields: Record<string, string>): Response {
  const params = new URLSearchParams({ error: message, ...fields });
  return redirect(`/signup?${params.toString()}`);
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();

  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired. Refresh the page and try again.', { status: 403 });
  }

  const token = String(formData.get('token') ?? '').trim();
  const character = String(formData.get('character') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const server = String(formData.get('server') ?? '').trim() || null;
  const honeypot = String(formData.get('hp_website') ?? '').trim();

  const fields = { token, character };
  const supabase = createSupabaseServerClient(cookies, request.headers);
  const ip = getClientIp(request);

  // Honeypot — if a bot filled the hidden field, log it and silently
  // redirect home. They get no signal that the account wasn't created.
  if (honeypot) {
    await supabase.rpc('log_bot_block', { p_endpoint: '/api/redeem-token', p_ip: ip });
    return redirect('/');
  }

  // Rate limit
  const { data: attemptCount } = await supabase.rpc('record_rate_limit', {
    p_ip: ip,
    p_endpoint: '/api/redeem-token',
  });
  if (typeof attemptCount === 'number' && attemptCount > RATE_LIMIT) {
    return fail(redirect, 'Too many attempts. Please wait a minute and try again.', fields);
  }

  if (!token || !character || !password) {
    return fail(redirect, 'All required fields must be filled.', fields);
  }
  if (password.length < 6) {
    return fail(redirect, 'Password must be at least 6 characters.', fields);
  }
  if (!slugifyName(character)) {
    return fail(redirect, 'Character name must contain letters or digits.', fields);
  }

  // 1) Token must be valid (unused, not expired).
  const { data: tokenOk, error: tokenErr } = await supabase.rpc('is_token_valid', { p_token: token });
  if (tokenErr) return fail(redirect, `Token check failed: ${tokenErr.message}`, fields);
  if (!tokenOk) return fail(redirect, 'That token is invalid or has expired.', fields);

  // 2) Character name must be available (case-insensitive, globally unique).
  const { data: nameOk, error: nameErr } = await supabase.rpc('is_character_name_available', { p_name: character });
  if (nameErr) return fail(redirect, `Name check failed: ${nameErr.message}`, fields);
  if (!nameOk) return fail(redirect, 'That character name is already in the Hall. Pick another.', fields);

  // 3) Sign up using a synthetic email derived from the character name.
  const email = characterNameToEmail(character);
  const { error: signUpErr } = await supabase.auth.signUp({ email, password });
  if (signUpErr) return fail(redirect, signUpErr.message, fields);

  // 4) Atomically mark the token used and set the new profile's role.
  const { error: redeemErr } = await supabase.rpc('redeem_token', {
    p_token: token,
    p_character: character,
    p_server: server,
  });
  if (redeemErr) return fail(redirect, `Could not redeem token: ${redeemErr.message}`, fields);

  return redirect('/welcome');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/signup');
