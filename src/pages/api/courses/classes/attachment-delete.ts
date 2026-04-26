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

  if (!locals.permissions.has('courses.author')) {
    return new Response('Forbidden — courses.author required.', { status: 403 });
  }

  const attachmentId = String(formData.get('attachment_id') ?? '').trim();
  const courseSlug = String(formData.get('course_slug') ?? '').trim();
  const classSlug = String(formData.get('class_slug') ?? '').trim();

  if (!attachmentId || !courseSlug || !classSlug) {
    return redirect('/courses?error=Missing+fields');
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  const { data: row, error: rowErr } = await supabase
    .from('class_attachments')
    .select('id, file_path, file_name, class_id, classes!inner(created_by)')
    .eq('id', attachmentId)
    .maybeSingle();

  if (rowErr || !row) {
    return redirect(`/courses/${courseSlug}/${classSlug}/edit?error=Attachment+not+found`);
  }

  const classCreatedBy = (row as any).classes?.created_by as string | undefined;
  const isHeadmaster = locals.profile?.role === 'headmaster';
  if (classCreatedBy !== user.id && !isHeadmaster) {
    return new Response("Forbidden — you don't own this class.", { status: 403 });
  }

  const { error: delErr } = await supabase
    .from('class_attachments')
    .delete()
    .eq('id', attachmentId);

  if (delErr) {
    return redirect(`/courses/${courseSlug}/${classSlug}/edit?error=${encodeURIComponent(delErr.message)}`);
  }

  await supabase.storage.from('class-files').remove([row.file_path]);

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'class_attachment_deleted',
    details: { class_id: row.class_id, file_name: row.file_name },
  });

  return redirect(`/courses/${courseSlug}/${classSlug}/edit?ok=attachment_deleted`);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/courses');
