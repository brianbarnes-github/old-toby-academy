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

  const questionId = String(formData.get('question_id') ?? '').trim() || null;
  const quizId = String(formData.get('quiz_id') ?? '').trim();
  const courseSlug = String(formData.get('course_slug') ?? '').trim();
  const classSlug = String(formData.get('class_slug') ?? '').trim();
  const promptMd = String(formData.get('prompt_md') ?? '').trim();
  const explanationMd = String(formData.get('explanation_md') ?? '');
  const orderIndex = Number(formData.get('order_index') ?? 0);
  const correctIndex = Number(formData.get('correct_index') ?? -1);

  if (!quizId || !courseSlug || !classSlug) {
    return redirect('/courses?error=Missing+fields');
  }

  const back = `/courses/${courseSlug}/${classSlug}/edit`;

  if (!promptMd) {
    return redirect(`${back}?error=${encodeURIComponent('Question prompt is required.')}`);
  }

  const optionLabels = (formData.getAll('option_label') as string[])
    .map((s) => String(s ?? '').trim())
    .filter((s) => s.length > 0);

  if (optionLabels.length < 2) {
    return redirect(`${back}?error=${encodeURIComponent('A question needs at least two options.')}`);
  }
  if (optionLabels.length > 6) {
    return redirect(`${back}?error=${encodeURIComponent('A question can have at most six options.')}`);
  }
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= optionLabels.length) {
    return redirect(`${back}?error=${encodeURIComponent('Pick which option is correct.')}`);
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  // Ownership gate via the quiz → class chain.
  const { data: quiz } = await supabase
    .from('class_quizzes')
    .select('id, class_id, classes!inner(created_by)')
    .eq('id', quizId)
    .maybeSingle();

  if (!quiz) return redirect(`${back}?error=Quiz+not+found`);

  const ownerId = (quiz as any).classes?.created_by as string | undefined;
  const isHeadmaster = locals.profile?.role === 'headmaster';
  if (ownerId !== user.id && !isHeadmaster) {
    return new Response("Forbidden — you don't own this class.", { status: 403 });
  }

  let resolvedQuestionId = questionId;

  if (!resolvedQuestionId) {
    const { data: q, error: qErr } = await supabase
      .from('class_quiz_questions')
      .insert({
        quiz_id: quizId,
        prompt_md: promptMd,
        explanation_md: explanationMd || null,
        order_index: Number.isFinite(orderIndex) ? orderIndex : 0,
      })
      .select('id')
      .maybeSingle();
    if (qErr || !q) return redirect(`${back}?error=${encodeURIComponent(qErr?.message ?? 'Insert failed')}`);
    resolvedQuestionId = q.id as string;
  } else {
    const { error: qErr } = await supabase
      .from('class_quiz_questions')
      .update({
        prompt_md: promptMd,
        explanation_md: explanationMd || null,
        order_index: Number.isFinite(orderIndex) ? orderIndex : 0,
      })
      .eq('id', resolvedQuestionId);
    if (qErr) return redirect(`${back}?error=${encodeURIComponent(qErr.message)}`);
  }

  // Replace options wholesale — simpler than diffing.
  await supabase.from('class_quiz_options').delete().eq('question_id', resolvedQuestionId);

  const optionRows = optionLabels.map((label, i) => ({
    question_id: resolvedQuestionId!,
    label,
    is_correct: i === correctIndex,
    order_index: i,
  }));

  const { error: optErr } = await supabase.from('class_quiz_options').insert(optionRows);
  if (optErr) return redirect(`${back}?error=${encodeURIComponent(optErr.message)}`);

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'quiz_question_changed',
    details: {
      quiz_id: quizId,
      question_id: resolvedQuestionId,
      created: !questionId,
      option_count: optionLabels.length,
    },
  });

  return redirect(`${back}?ok=question_saved`);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/courses');
