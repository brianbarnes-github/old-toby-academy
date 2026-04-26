import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const prerender = false;

const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const user = locals.user;
  if (!user) return redirect('/login');

  const supabase = createSupabaseServerClient(cookies, request.headers);

  // Best-effort delete of any avatar file in the user's folder. Don't
  // fail if a particular extension wasn't there.
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
