import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

const ALLOWED_TYPES = new Set(['section', 'exercise', 'quiz', 'lesson']);

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired.', { status: 403 });
  }

  const user = locals.user;
  if (!user) return new Response('Unauthorized.', { status: 401 });

  const courseSlug = String(formData.get('course_slug') ?? '').trim();
  const markType = String(formData.get('mark_type') ?? '').trim();
  const markKey = String(formData.get('mark_key') ?? '').trim();
  const valueRaw = String(formData.get('value') ?? '{}');

  if (!courseSlug || !markType || !markKey) {
    return new Response('Missing fields.', { status: 400 });
  }
  if (!ALLOWED_TYPES.has(markType)) {
    return new Response(`Invalid mark_type. Allowed: ${[...ALLOWED_TYPES].join(', ')}`, { status: 400 });
  }
  if (courseSlug.length > 64 || markKey.length > 128) {
    return new Response('Slug/key too long.', { status: 400 });
  }

  let value: any;
  try {
    value = JSON.parse(valueRaw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('value must be a JSON object');
    }
  } catch {
    return new Response('Invalid value JSON.', { status: 400 });
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const { error } = await supabase
    .from('progress_marks')
    .upsert(
      {
        user_id: user.id,
        course_slug: courseSlug,
        mark_type: markType,
        mark_key: markKey,
        value,
        recorded_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,course_slug,mark_type,mark_key' }
    );

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(null, { status: 204 });
};

export const GET: APIRoute = async () => new Response('Method not allowed.', { status: 405 });
