import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

const TASK_KEY_RE = /^task-\d+$/;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response('Bad request.', { status: 400 });
  }

  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired.', { status: 403 });
  }

  const user = locals.user;
  if (!user) return new Response('Sign in required.', { status: 401 });

  const courseSlug = String(formData.get('course_slug') ?? '').trim();
  const classId = String(formData.get('class_id') ?? '').trim();
  const taskKey = String(formData.get('task_key') ?? '').trim();
  const completed = String(formData.get('completed') ?? '') === 'true';

  if (!courseSlug || !classId || !taskKey) {
    return new Response('Missing fields.', { status: 400 });
  }
  if (!TASK_KEY_RE.test(taskKey)) {
    return new Response('Invalid task_key.', { status: 400 });
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  const markKey = `${classId}:${taskKey}`;
  const { error } = await supabase
    .from('progress_marks')
    .upsert(
      {
        user_id: user.id,
        course_slug: courseSlug,
        mark_type: 'exercise',
        mark_key: markKey,
        value: { completed },
        recorded_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,course_slug,mark_type,mark_key' },
    );

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(null, { status: 204 });
};

export const GET: APIRoute = async () => new Response('Use POST.', { status: 405 });
