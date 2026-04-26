import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { resolveSignInEmail } from '../../lib/auth';
import { verifyCsrf } from '../../lib/csrf';
import { getClientIp } from '../../lib/request';

export const prerender = false;

const RATE_LIMIT = 10; // attempts per minute per IP

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();

  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired. Refresh the page and try again.', { status: 403 });
  }

  const name = String(formData.get('name') ?? formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/courses');
  const variant = String(formData.get('variant') ?? 'student');
  const loginPath = variant === 'faculty' ? '/faculty-login' : '/login';

  // Rate limit BEFORE doing any expensive work. Use a fresh client to
  // call the SECURITY DEFINER function — no session needed.
  const supabase = createSupabaseServerClient(cookies, request.headers);
  const ip = getClientIp(request);
  const { data: attemptCount } = await supabase.rpc('record_rate_limit', {
    p_ip: ip,
    p_endpoint: '/api/login',
  });
  if (typeof attemptCount === 'number' && attemptCount > RATE_LIMIT) {
    return redirect(
      `${loginPath}?error=${encodeURIComponent('Too many attempts. Please wait a minute and try again.')}&name=${encodeURIComponent(name)}`
    );
  }

  if (!name || !password) {
    return redirect(`${loginPath}?error=${encodeURIComponent('Both fields are required.')}&name=${encodeURIComponent(name)}`);
  }

  let email: string;
  try {
    email = resolveSignInEmail(name);
  } catch (e: any) {
    return redirect(`${loginPath}?error=${encodeURIComponent(e.message)}&name=${encodeURIComponent(name)}`);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const params = new URLSearchParams({ error: error.message, name });
    if (next && next !== '/courses') params.set('next', next);
    return redirect(`${loginPath}?${params.toString()}`);
  }

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/courses';
  return redirect(safeNext);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/login');
