import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export const prerender = false;

function fail(redirect: APIRoute extends infer R ? any : never, message: string, fields: Record<string, string>): Response {
  const params = new URLSearchParams({ error: message, ...fields });
  return redirect(`/signup?${params.toString()}`);
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const token = String(formData.get('token') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const character = String(formData.get('character') ?? '').trim();
  const server = String(formData.get('server') ?? '').trim() || null;

  const fields = { token, email };

  if (!token || !email || !password || !character) {
    return fail(redirect, 'All required fields must be filled.', fields);
  }
  if (password.length < 6) {
    return fail(redirect, 'Password must be at least 6 characters.', fields);
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  // 1) Pre-check token without exposing the role to anonymous users.
  const { data: validData, error: validErr } = await supabase.rpc('is_token_valid', { p_token: token });
  if (validErr) return fail(redirect, `Token check failed: ${validErr.message}`, fields);
  if (!validData) return fail(redirect, 'That token is invalid or has expired.', fields);

  // 2) Create the auth user (auto-signs them in via cookie).
  const { error: signUpErr } = await supabase.auth.signUp({ email, password });
  if (signUpErr) return fail(redirect, signUpErr.message, fields);

  // 3) Redeem the token — atomically marks it used and updates the
  //    profile's role + character/server. The function runs as the
  //    just-created user (auth.uid() works because signUp set the cookie).
  const { data: roleData, error: redeemErr } = await supabase.rpc('redeem_token', {
    p_token: token,
    p_character: character,
    p_server: server,
  });
  if (redeemErr) return fail(redirect, `Could not redeem token: ${redeemErr.message}`, fields);

  // 4) Faculty-default land on faculty entrance to reinforce the divide.
  const dest = roleData === 'faculty' ? '/courses' : '/courses';
  return redirect(dest);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/signup');
