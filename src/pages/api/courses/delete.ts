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
  if (!courseId) return redirect('/courses?error=Missing+course');

  const supabase = createSupabaseServerClient(cookies, request.headers);

  // Look up the slug + title for the audit row before deleting.
  const { data: course } = await supabase
    .from('courses')
    .select('slug, title')
    .eq('id', courseId)
    .maybeSingle();

  const { error } = await supabase.from('courses').delete().eq('id', courseId);

  if (error) {
    return redirect(`/courses?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'course_deleted',
    details: { course_id: courseId, slug: course?.slug, title: course?.title },
  });

  return redirect('/courses?ok=deleted');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/courses');
