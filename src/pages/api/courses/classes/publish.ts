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
  const publish = String(formData.get('publish') ?? 'true') === 'true';
  if (!classId || !courseSlug) return redirect('/courses?error=Missing+class');

  const supabase = createSupabaseServerClient(cookies, request.headers);

  const { data: cls, error } = await supabase
    .from('classes')
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq('id', classId)
    .select('slug')
    .maybeSingle();

  if (error || !cls) {
    return redirect(`/courses/${courseSlug}?error=${encodeURIComponent(error?.message ?? 'Update failed.')}`);
  }

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: publish ? 'class_published' : 'class_unpublished',
    details: { class_id: classId, course_slug: courseSlug, slug: cls.slug },
  });

  return redirect(`/courses/${courseSlug}/${cls.slug}/edit?ok=${publish ? 'published' : 'unpublished'}`);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/courses');
