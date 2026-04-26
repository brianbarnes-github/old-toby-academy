import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { verifyCsrf } from '../../../../lib/csrf';

export const prerender = false;

const MAX_BYTES = 10 * 1024 * 1024;

function safeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'file';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

function uuid(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Could not read upload.');
  }

  if (!verifyCsrf(formData, cookies)) {
    return jsonError('Session expired. Refresh and try again.', 403);
  }

  const user = locals.user;
  if (!user) return jsonError('Sign in required.', 401);

  if (!locals.permissions.has('courses.author')) {
    return jsonError('Forbidden — courses.author required.', 403);
  }

  const classId = String(formData.get('class_id') ?? '').trim();
  const kind = String(formData.get('kind') ?? '').trim();
  const caption = String(formData.get('caption') ?? '').trim() || null;
  const file = formData.get('file');

  if (!classId) return jsonError('Missing class_id.');
  if (kind !== 'image' && kind !== 'file') return jsonError('Invalid kind.');
  if (!(file instanceof File) || file.size === 0) return jsonError('Pick a file to upload.');
  if (file.size > MAX_BYTES) return jsonError('File must be under 10 MB.');

  const supabase = createSupabaseServerClient(cookies, request.headers);

  // Ownership gate: user must own the class (or be headmaster).
  const { data: cls, error: clsErr } = await supabase
    .from('classes')
    .select('id, course_id, created_by')
    .eq('id', classId)
    .maybeSingle();

  if (clsErr || !cls) return jsonError('Class not found.', 404);

  const isHeadmaster = locals.profile?.role === 'headmaster';
  if (cls.created_by !== user.id && !isHeadmaster) {
    return jsonError("Forbidden — you don't own this class.", 403);
  }

  const folder = uuid();
  const fileName = safeFilename(file.name);
  const storagePath = `${classId}/${folder}/${fileName}`;
  const contentType = file.type || 'application/octet-stream';

  const buffer = await file.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from('class-files')
    .upload(storagePath, buffer, { contentType, upsert: false });

  if (upErr) return jsonError(`Upload failed: ${upErr.message}`, 500);

  const { data: row, error: insErr } = await supabase
    .from('class_attachments')
    .insert({
      class_id: classId,
      kind,
      file_path: storagePath,
      file_name: fileName,
      file_size: file.size,
      content_type: contentType,
      caption,
      created_by: user.id,
    })
    .select('id, kind, file_name, caption')
    .maybeSingle();

  if (insErr || !row) {
    // Roll back the orphaned upload.
    await supabase.storage.from('class-files').remove([storagePath]);
    return jsonError(insErr?.message ?? 'Insert failed.', 500);
  }

  const url = supabase.storage.from('class-files').getPublicUrl(storagePath).data.publicUrl;

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'class_attachment_uploaded',
    details: { class_id: classId, kind, file_name: fileName },
  });

  return new Response(
    JSON.stringify({
      id: row.id,
      kind: row.kind,
      file_name: row.file_name,
      caption: row.caption,
      url,
    }),
    { status: 201, headers: { 'content-type': 'application/json' } },
  );
};

export const GET: APIRoute = async () => jsonError('Use POST.', 405);
