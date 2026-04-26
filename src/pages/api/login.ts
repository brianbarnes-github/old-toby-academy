import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { resolveSignInEmail } from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const name = String(formData.get('name') ?? formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/courses');
  const variant = String(formData.get('variant') ?? 'student');

  if (!name || !password) {
    const loginPath = variant === 'faculty' ? '/faculty-login' : '/login';
    return redirect(`${loginPath}?error=${encodeURIComponent('Both fields are required.')}&name=${encodeURIComponent(name)}`);
  }

  let email: string;
  try {
    email = resolveSignInEmail(name);
  } catch (e: any) {
    const loginPath = variant === 'faculty' ? '/faculty-login' : '/login';
    return redirect(`${loginPath}?error=${encodeURIComponent(e.message)}&name=${encodeURIComponent(name)}`);
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const loginPath = variant === 'faculty' ? '/faculty-login' : '/login';
    const params = new URLSearchParams({ error: error.message, name });
    if (next && next !== '/courses') params.set('next', next);
    return redirect(`${loginPath}?${params.toString()}`);
  }

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/courses';
  return redirect(safeNext);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/login');
