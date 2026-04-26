import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
  const questionId = String(formData.get('question_id') ?? '').trim();
  const optionId = String(formData.get('option_id') ?? '').trim();

  if (!courseSlug || !classId || !questionId || !optionId) {
    return new Response('Missing fields.', { status: 400 });
  }
  if (!UUID_RE.test(classId) || !UUID_RE.test(questionId) || !UUID_RE.test(optionId)) {
    return new Response('Invalid id.', { status: 400 });
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  // Confirm the option belongs to the question, and grade it.
  const { data: opt, error: optErr } = await supabase
    .from('class_quiz_options')
    .select('id, is_correct, question_id')
    .eq('id', optionId)
    .eq('question_id', questionId)
    .maybeSingle();

  if (optErr || !opt) return new Response('Option not found.', { status: 404 });

  const correct = opt.is_correct === true;

  // Find the correct option id so we can return it (for the "you got it
  // wrong, the correct answer was X" reveal).
  const { data: correctRow } = await supabase
    .from('class_quiz_options')
    .select('id')
    .eq('question_id', questionId)
    .eq('is_correct', true)
    .maybeSingle();

  const markKey = `${classId}:${questionId}`;
  const { error: upErr } = await supabase.from('progress_marks').upsert(
    {
      user_id: user.id,
      course_slug: courseSlug,
      mark_type: 'quiz',
      mark_key: markKey,
      value: { option_id: optionId, correct },
      recorded_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,course_slug,mark_type,mark_key' },
  );

  if (upErr) return new Response(upErr.message, { status: 500 });

  return new Response(
    JSON.stringify({
      correct,
      correct_option_id: correctRow?.id ?? null,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
};

export const GET: APIRoute = async () => new Response('Use POST.', { status: 405 });
