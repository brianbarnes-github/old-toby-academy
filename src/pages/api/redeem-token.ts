import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { characterNameToEmail, slugifyName } from '../../lib/auth';

export const prerender = false;

function fail(redirect: any, message: string, fields: Record<string, string>): Response {
  const params = new URLSearchParams({ error: message, ...fields });
  return redirect(`/signup?${params.toString()}`);
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const token = String(formData.get('token') ?? '').trim();
  const character = String(formData.get('character') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const server = String(formData.get('server') ?? '').trim() || null;

  const fields = { token, character };

  if (!token || !character || !password) {
    return fail(redirect, 'All required fields must be filled.', fields);
  }
  if (password.length < 6) {
    return fail(redirect, 'Password must be at least 6 characters.', fields);
  }
  if (!slugifyName(character)) {
    return fail(redirect, 'Character name must contain letters or digits.', fields);
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  // 1) Token must be valid (unused, not expired).
  const { data: tokenOk, error: tokenErr } = await supabase.rpc('is_token_valid', { p_token: token });
  if (tokenErr) return fail(redirect, `Token check failed: ${tokenErr.message}`, fields);
  if (!tokenOk) return fail(redirect, 'That token is invalid or has expired.', fields);

  // 2) Character name must be available (case-insensitive, globally unique).
  const { data: nameOk, error: nameErr } = await supabase.rpc('is_character_name_available', { p_name: character });
  if (nameErr) return fail(redirect, `Name check failed: ${nameErr.message}`, fields);
  if (!nameOk) return fail(redirect, 'That character name is already in the Hall. Pick another.', fields);

  // 3) Sign up using a synthetic email derived from the character name.
  //    No real email is collected or shown; this just satisfies Supabase Auth.
  const email = characterNameToEmail(character);
  const { error: signUpErr } = await supabase.auth.signUp({ email, password });
  if (signUpErr) return fail(redirect, signUpErr.message, fields);

  // 4) Atomically mark the token used and set the new profile's role +
  //    character + server. Runs as the just-created user.
  const { error: redeemErr } = await supabase.rpc('redeem_token', {
    p_token: token,
    p_character: character,
    p_server: server,
  });
  if (redeemErr) return fail(redirect, `Could not redeem token: ${redeemErr.message}`, fields);

  return redirect('/courses');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/signup');
