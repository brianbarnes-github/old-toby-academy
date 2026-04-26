import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

const MAX_BIO = 500;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const user = locals.user;
  if (!user) return redirect('/login');

  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired. Refresh the page and try again.', { status: 403 });
  }
  const server = String(formData.get('server') ?? '').trim() || null;
  const bio = String(formData.get('bio') ?? '').trim() || null;

  if (bio && bio.length > MAX_BIO) {
    return redirect('/account?error=' + encodeURIComponent(`Bio is ${bio.length} chars; max is ${MAX_BIO}.`));
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const { error } = await supabase
    .from('profiles')
    .update({ server, bio })
    .eq('user_id', user.id);

  if (error) {
    return redirect('/account?error=' + encodeURIComponent(error.message));
  }

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'profile_updated',
    details: { fields_changed: ['server', 'bio'] },
  });

  return redirect('/account?ok=info');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/account');
