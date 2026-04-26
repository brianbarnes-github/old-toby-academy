import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const formData = await request.formData();
  const agreed = formData.get('agree');

  if (!agreed) {
    return redirect('/welcome?error=' + encodeURIComponent('You must agree to the rules to continue.'));
  }

  const user = locals.user;
  if (!user) return redirect('/login');

  const supabase = createSupabaseServerClient(cookies, request.headers);

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ rules_accepted_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (updateErr) {
    return redirect('/welcome?error=' + encodeURIComponent(updateErr.message));
  }

  // Audit log
  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'rules_accepted',
    details: {},
  });

  return redirect('/welcome?step=2');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/welcome');
