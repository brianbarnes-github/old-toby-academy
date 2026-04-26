import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const user = locals.user;
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const server = String(formData.get('server') ?? '').trim() || null;

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const { error } = await supabase
    .from('profiles')
    .update({ server })
    .eq('user_id', user.id);

  if (error) {
    return redirect('/account?error=' + encodeURIComponent(error.message));
  }

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'profile_updated',
    details: { fields_changed: ['server'] },
  });

  return redirect('/account?ok=server');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/account');
