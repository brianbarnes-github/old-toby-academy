import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { verifyCsrf } from '../../../../../lib/csrf';

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

  const quizId = String(formData.get('quiz_id') ?? '').trim();
  const courseSlug = String(formData.get('course_slug') ?? '').trim();
  const classSlug = String(formData.get('class_slug') ?? '').trim();
  if (!quizId || !courseSlug || !classSlug) return redirect('/courses?error=Missing+fields');

  const back = `/courses/${courseSlug}/${classSlug}/edit`;

  const supabase = createSupabaseServerClient(cookies, request.headers);

  const { data: quiz } = await supabase
    .from('class_quizzes')
    .select('id, slug, title, class_id, classes!inner(created_by)')
    .eq('id', quizId)
    .maybeSingle();

  if (!quiz) return redirect(`${back}?error=Quiz+not+found`);

  const ownerId = (quiz as any).classes?.created_by as string | undefined;
  const isHeadmaster = locals.profile?.role === 'headmaster';
  if (ownerId !== user.id && !isHeadmaster) {
    return new Response("Forbidden — you don't own this class.", { status: 403 });
  }

  const { error } = await supabase.from('class_quizzes').delete().eq('id', quizId);
  if (error) return redirect(`${back}?error=${encodeURIComponent(error.message)}`);

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'quiz_deleted',
    details: { quiz_id: quizId, slug: quiz.slug, title: quiz.title, class_id: quiz.class_id },
  });

  return redirect(`${back}?ok=quiz_deleted`);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/courses');
