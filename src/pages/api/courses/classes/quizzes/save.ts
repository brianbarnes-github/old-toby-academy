import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { verifyCsrf } from '../../../../../lib/csrf';

export const prerender = false;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

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

  const quizId = String(formData.get('quiz_id') ?? '').trim() || null;
  const classId = String(formData.get('class_id') ?? '').trim();
  const courseSlug = String(formData.get('course_slug') ?? '').trim();
  const classSlug = String(formData.get('class_slug') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const title = String(formData.get('title') ?? '').trim();
  const introMd = String(formData.get('intro_md') ?? '');
  const orderIndex = Number(formData.get('order_index') ?? 0);

  if (!classId || !courseSlug || !classSlug) {
    return redirect('/courses?error=Missing+fields');
  }

  const back = `/courses/${courseSlug}/${classSlug}/edit`;
  if (!slug || !title) {
    return redirect(`${back}?error=${encodeURIComponent('Slug and title are required.')}`);
  }
  if (!SLUG_RE.test(slug)) {
    return redirect(`${back}?error=${encodeURIComponent('Quiz slug must be lowercase letters, digits, and hyphens.')}`);
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  // Ownership gate.
  const { data: cls } = await supabase
    .from('classes')
    .select('id, created_by')
    .eq('id', classId)
    .maybeSingle();
  if (!cls) return redirect(`${back}?error=Class+not+found`);

  const isHeadmaster = locals.profile?.role === 'headmaster';
  if (cls.created_by !== user.id && !isHeadmaster) {
    return new Response("Forbidden — you don't own this class.", { status: 403 });
  }

  if (!quizId) {
    const { error } = await supabase.from('class_quizzes').insert({
      class_id: classId,
      slug,
      title,
      intro_md: introMd || null,
      order_index: Number.isFinite(orderIndex) ? orderIndex : 0,
      created_by: user.id,
    });
    if (error) return redirect(`${back}?error=${encodeURIComponent(error.message)}`);

    await supabase.from('entries').insert({
      user_id: user.id,
      event_type: 'quiz_created',
      details: { class_id: classId, slug, title },
    });
  } else {
    const { error } = await supabase
      .from('class_quizzes')
      .update({
        slug,
        title,
        intro_md: introMd || null,
        order_index: Number.isFinite(orderIndex) ? orderIndex : 0,
      })
      .eq('id', quizId);
    if (error) return redirect(`${back}?error=${encodeURIComponent(error.message)}`);

    await supabase.from('entries').insert({
      user_id: user.id,
      event_type: 'quiz_updated',
      details: { quiz_id: quizId, slug, title },
    });
  }

  return redirect(`${back}?ok=quiz_saved`);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/courses');
