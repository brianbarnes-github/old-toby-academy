import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const user = locals.user;
  if (!user) return redirect('/login');

  const formData = await request.formData();

  const updates: Record<string, string | null> = {};
  const fieldsChanged: string[] = [];

  for (const field of ['instrument', 'why_joining', 'experience'] as const) {
    const raw = formData.get(field);
    if (raw === null) continue;
    const value = String(raw).trim() || null;
    updates[field] = value;
    if (value !== null) fieldsChanged.push(field);
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (error) {
      return redirect('/welcome?step=2&error=' + encodeURIComponent(error.message));
    }

    await supabase.from('entries').insert({
      user_id: user.id,
      event_type: 'profile_updated',
      details: { fields_changed: fieldsChanged },
    });
  }

  return redirect('/welcome?step=3');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/welcome?step=2');
