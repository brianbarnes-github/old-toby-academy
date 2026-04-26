import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired. Refresh and try again.', { status: 403 });
  }

  const user = locals.user;
  if (!user) return redirect('/login');

  const courseId = String(formData.get('course_id') ?? '').trim() || null;
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const title = String(formData.get('title') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim() || null;
  const description = String(formData.get('description') ?? '');
  const orderMode = String(formData.get('order_mode') ?? 'all');

  if (!slug || !title) {
    const back = courseId ? `/courses/${slug || ''}/edit` : '/courses/new';
    return redirect(`${back}?error=${encodeURIComponent('Slug and title are required.')}`);
  }
  if (!SLUG_RE.test(slug)) {
    const back = courseId ? `/courses/${slug}/edit` : '/courses/new';
    return redirect(`${back}?error=${encodeURIComponent('Slug must be lowercase letters, digits, and hyphens.')}`);
  }
  if (!['all', 'sequential'].includes(orderMode)) {
    return redirect('/courses?error=' + encodeURIComponent('Invalid order_mode.'));
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  if (!courseId) {
    // Insert
    const { data, error } = await supabase
      .from('courses')
      .insert({ slug, title, summary, description, order_mode: orderMode, created_by: user.id })
      .select('slug')
      .maybeSingle();

    if (error) {
      return redirect('/courses/new?error=' + encodeURIComponent(error.message));
    }

    await supabase.from('entries').insert({
      user_id: user.id,
      event_type: 'course_created',
      details: { slug, title },
    });

    return redirect(`/courses/${data!.slug}/edit?ok=created`);
  } else {
    // Update
    const { error } = await supabase
      .from('courses')
      .update({ slug, title, summary, description, order_mode: orderMode })
      .eq('id', courseId);

    if (error) {
      return redirect(`/courses/${slug}/edit?error=${encodeURIComponent(error.message)}`);
    }

    await supabase.from('entries').insert({
      user_id: user.id,
      event_type: 'course_updated',
      details: { course_id: courseId, slug, title },
    });

    return redirect(`/courses/${slug}/edit?ok=updated`);
  }
};

export const GET: APIRoute = async ({ redirect }) => redirect('/courses');
