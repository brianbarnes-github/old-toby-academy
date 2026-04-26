import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired.', { status: 403 });
  }

  const user = locals.user;
  if (!user) return redirect('/login');

  const courseId = String(formData.get('course_id') ?? '').trim();
  const publish = String(formData.get('publish') ?? 'true') === 'true';
  if (!courseId) return redirect('/courses?error=Missing+course');

  const supabase = createSupabaseServerClient(cookies, request.headers);

  const { data: course, error } = await supabase
    .from('courses')
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq('id', courseId)
    .select('slug')
    .maybeSingle();

  if (error || !course) {
    return redirect(`/courses?error=${encodeURIComponent(error?.message ?? 'Update failed.')}`);
  }

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: publish ? 'course_published' : 'course_unpublished',
    details: { course_id: courseId, slug: course.slug },
  });

  return redirect(`/courses/${course.slug}/edit?ok=${publish ? 'published' : 'unpublished'}`);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/courses');
