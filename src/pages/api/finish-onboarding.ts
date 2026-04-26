import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { verifyCsrf } from '../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const user = locals.user;
  if (!user) return redirect('/login');

  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired. Refresh the page and try again.', { status: 403 });
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (updateErr) {
    return redirect('/welcome?step=3&error=' + encodeURIComponent(updateErr.message));
  }

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'onboarding_completed',
    details: {},
  });

  return redirect('/courses');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/welcome?step=3');
