import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { verifyCsrf } from '../../../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired.', { status: 403 });
  }

  const user = locals.user;
  if (!user) return redirect('/login');

  const classId = String(formData.get('class_id') ?? '').trim();
  const courseSlug = String(formData.get('course_slug') ?? '').trim();
  if (!classId || !courseSlug) return redirect('/courses?error=Missing+class');

  const supabase = createSupabaseServerClient(cookies, request.headers);

  const { data: cls } = await supabase
    .from('classes')
    .select('slug, title')
    .eq('id', classId)
    .maybeSingle();

  const { error } = await supabase.from('classes').delete().eq('id', classId);

  if (error) {
    return redirect(`/courses/${courseSlug}?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'class_deleted',
    details: { class_id: classId, course_slug: courseSlug, slug: cls?.slug, title: cls?.title },
  });

  return redirect(`/courses/${courseSlug}?ok=class-deleted`);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/courses');
