import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { verifyCsrf } from '../../../../lib/csrf';

export const prerender = false;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired.', { status: 403 });
  }

  const user = locals.user;
  if (!user) return redirect('/login');

  const classId = String(formData.get('class_id') ?? '').trim() || null;
  const courseId = String(formData.get('course_id') ?? '').trim();
  const courseSlug = String(formData.get('course_slug') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const title = String(formData.get('title') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim() || null;
  const bodyMd = String(formData.get('body_md') ?? '');
  const orderIndex = Number(formData.get('order_index') ?? 0);

  if (!courseId || !courseSlug) return redirect('/courses?error=Missing+course');

  if (!slug || !title) {
    const back = classId ? `/courses/${courseSlug}/${slug}/edit` : `/courses/${courseSlug}/classes/new`;
    return redirect(`${back}?error=${encodeURIComponent('Slug and title are required.')}`);
  }
  if (!SLUG_RE.test(slug)) {
    const back = classId ? `/courses/${courseSlug}/${slug}/edit` : `/courses/${courseSlug}/classes/new`;
    return redirect(`${back}?error=${encodeURIComponent('Slug must be lowercase letters, digits, and hyphens.')}`);
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  if (!classId) {
    const { data, error } = await supabase
      .from('classes')
      .insert({
        course_id: courseId,
        slug,
        title,
        summary,
        body_md: bodyMd,
        order_index: Number.isFinite(orderIndex) ? orderIndex : 0,
        created_by: user.id,
      })
      .select('slug')
      .maybeSingle();

    if (error) {
      return redirect(`/courses/${courseSlug}/classes/new?error=${encodeURIComponent(error.message)}`);
    }

    await supabase.from('entries').insert({
      user_id: user.id,
      event_type: 'class_created',
      details: { course_id: courseId, course_slug: courseSlug, slug, title },
    });

    return redirect(`/courses/${courseSlug}/${data!.slug}/edit?ok=created`);
  } else {
    const { error } = await supabase
      .from('classes')
      .update({
        slug,
        title,
        summary,
        body_md: bodyMd,
        order_index: Number.isFinite(orderIndex) ? orderIndex : 0,
      })
      .eq('id', classId);

    if (error) {
      return redirect(`/courses/${courseSlug}/${slug}/edit?error=${encodeURIComponent(error.message)}`);
    }

    await supabase.from('entries').insert({
      user_id: user.id,
      event_type: 'class_updated',
      details: { class_id: classId, course_slug: courseSlug, slug, title },
    });

    return redirect(`/courses/${courseSlug}/${slug}/edit?ok=updated`);
  }
};

export const GET: APIRoute = async ({ redirect }) => redirect('/courses');
