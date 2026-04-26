import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { verifyCsrf } from '../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired. Refresh the page and try again.', { status: 403 });
  }
  const supabase = createSupabaseServerClient(cookies, request.headers);
  await supabase.auth.signOut();
  return redirect('/');
};

// Don't allow GET — that turns logout into a CSRF target via <img src>.
export const GET: APIRoute = async ({ redirect }) => redirect('/');
