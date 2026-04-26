import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const user = locals.user;
  if (!user) return redirect('/login');

  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired. Refresh the page and try again.', { status: 403 });
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  await supabase.storage
    .from('avatars')
    .remove(EXTENSIONS.map((ext) => `${user.id}/avatar.${ext}`));

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('user_id', user.id);

  if (error) {
    return redirect('/account?error=' + encodeURIComponent(error.message));
  }

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'profile_updated',
    details: { fields_changed: ['avatar_url'] },
  });

  return redirect('/account?ok=avatar-removed');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/account');
