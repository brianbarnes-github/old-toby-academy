import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/courses');
  const variant = String(formData.get('variant') ?? 'student');

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const loginPath = variant === 'faculty' ? '/faculty-login' : '/login';
    const params = new URLSearchParams({ error: error.message, email });
    if (next && next !== '/courses') params.set('next', next);
    return redirect(`${loginPath}?${params.toString()}`);
  }

  // Honor ?next= if it's a same-origin path
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/courses';
  return redirect(safeNext);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/login');
