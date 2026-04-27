import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server';
import { verifyCsrf } from '../../../../../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired.', { status: 403 });
  }

  const user = locals.user;
  if (!user) return redirect('/login');

  if (!locals.permissions.has('courses.author')) {
    return new Response('Forbidden — courses.author required.', { status: 403 });
  }

  const questionId = String(formData.get('question_id') ?? '').trim();
  const courseSlug = String(formData.get('course_slug') ?? '').trim();
  const classSlug = String(formData.get('class_slug') ?? '').trim();
  if (!questionId || !courseSlug || !classSlug) return redirect('/courses?error=Missing+fields');

  const back = `/courses/${courseSlug}/${classSlug}/edit`;

  const supabase = createSupabaseServerClient(cookies, request.headers);

  const { data: q } = await supabase
    .from('class_quiz_questions')
    .select('id, quiz_id, class_quizzes!inner(class_id, classes!inner(created_by))')
    .eq('id', questionId)
    .maybeSingle();

  if (!q) return redirect(`${back}?error=Question+not+found`);

  const ownerId = (q as any).class_quizzes?.classes?.created_by as string | undefined;
  const isHeadmaster = locals.profile?.role === 'headmaster';
  if (ownerId !== user.id && !isHeadmaster) {
    return new Response("Forbidden — you don't own this class.", { status: 403 });
  }

  const { error } = await supabase.from('class_quiz_questions').delete().eq('id', questionId);
  if (error) return redirect(`${back}?error=${encodeURIComponent(error.message)}`);

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'quiz_question_changed',
    details: { quiz_id: q.quiz_id, question_id: questionId, deleted: true },
  });

  return redirect(`${back}?ok=question_deleted`);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/courses');
