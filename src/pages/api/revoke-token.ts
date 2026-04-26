import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const token = String(formData.get('token') ?? '').trim();

  if (!token) {
    return redirect('/admin/tokens?error=' + encodeURIComponent('No token specified.'));
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  // revoke_invite_token() does the headmaster check internally and
  // also writes the audit-log row on success.
  const { data, error } = await supabase.rpc('revoke_invite_token', { p_token: token });

  if (error) {
    return redirect('/admin/tokens?error=' + encodeURIComponent(error.message));
  }

  if (!data) {
    return redirect('/admin/tokens?error=' + encodeURIComponent('Token was not active (already used, expired, or revoked).'));
  }

  return redirect('/admin/tokens?revoked=1');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/admin/tokens');
