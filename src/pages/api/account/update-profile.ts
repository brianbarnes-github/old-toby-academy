import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

const LEVELS = new Set(['none', 'beginner', 'intermediate', 'advanced', 'expert']);

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const user = locals.user;
  const profile = locals.profile;
  if (!user) return redirect('/login');

  const requireHopes = profile?.role === 'student';

  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired. Refresh the page and try again.', { status: 403 });
  }
  const musicLevel = String(formData.get('music_level') ?? '').trim();
  const ingameLevel = String(formData.get('ingame_music_level') ?? '').trim();
  const technicalLevel = String(formData.get('technical_level') ?? '').trim();
  const hopes = String(formData.get('hopes') ?? '').trim();

  const missing: string[] = [];
  if (!LEVELS.has(musicLevel))     missing.push('music_level');
  if (!LEVELS.has(ingameLevel))    missing.push('ingame_music_level');
  if (!LEVELS.has(technicalLevel)) missing.push('technical_level');
  if (requireHopes && !hopes)      missing.push('hopes');

  if (missing.length > 0) {
    return redirect('/account?error=' + encodeURIComponent(`Please answer every question (${missing.length} missing).`));
  }

  const updates: Record<string, string | null> = {
    music_level: musicLevel,
    ingame_music_level: ingameLevel,
    technical_level: technicalLevel,
  };
  if (hopes) updates.hopes = hopes;

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', user.id);

  if (error) {
    return redirect('/account?error=' + encodeURIComponent(error.message));
  }

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'profile_updated',
    details: { fields_changed: Object.keys(updates) },
  });

  return redirect('/account?ok=profile');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/account');
