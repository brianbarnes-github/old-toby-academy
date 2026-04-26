import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export const prerender = false;

const LEVELS = new Set(['none', 'beginner', 'intermediate', 'advanced', 'expert']);

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const user = locals.user;
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const musicLevel = String(formData.get('music_level') ?? '').trim();
  const ingameLevel = String(formData.get('ingame_music_level') ?? '').trim();
  const technicalLevel = String(formData.get('technical_level') ?? '').trim();
  const hopes = String(formData.get('hopes') ?? '').trim();

  // All four are required.
  const missing: string[] = [];
  if (!LEVELS.has(musicLevel))     missing.push('music_level');
  if (!LEVELS.has(ingameLevel))    missing.push('ingame_music_level');
  if (!LEVELS.has(technicalLevel)) missing.push('technical_level');
  if (!hopes)                      missing.push('hopes');

  if (missing.length > 0) {
    const msg = `Please answer every question (${missing.length} missing).`;
    return redirect('/welcome?step=2&error=' + encodeURIComponent(msg));
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  const { error } = await supabase
    .from('profiles')
    .update({
      music_level: musicLevel,
      ingame_music_level: ingameLevel,
      technical_level: technicalLevel,
      hopes,
    })
    .eq('user_id', user.id);

  if (error) {
    return redirect('/welcome?step=2&error=' + encodeURIComponent(error.message));
  }

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'profile_updated',
    details: {
      fields_changed: ['music_level', 'ingame_music_level', 'technical_level', 'hopes'],
    },
  });

  return redirect('/welcome?step=3');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/welcome?step=2');
