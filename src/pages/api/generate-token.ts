import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const role = String(formData.get('role') ?? 'student').trim();
  const expiresDays = Number(formData.get('expires_days') ?? 30);

  if (role !== 'student' && role !== 'faculty') {
    return redirect('/admin/tokens?error=' + encodeURIComponent('Role must be student or faculty.'));
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  // generate_invite_token() runs as the calling user (headmaster) and
  // checks is_headmaster() internally. Middleware already gated /admin
  // to headmaster, so we only get here if the user is one — but the
  // SQL function is the real source of truth.
  const { data, error } = await supabase.rpc('generate_invite_token', {
    p_role: role,
    p_expires_days: expiresDays,
  });

  if (error || !data) {
    return redirect('/admin/tokens?error=' + encodeURIComponent(error?.message ?? 'Failed to mint token.'));
  }

  const params = new URLSearchParams({ new: String(data), role });
  return redirect('/admin/tokens?' + params.toString());
};

export const GET: APIRoute = async ({ redirect }) => redirect('/admin/tokens');
