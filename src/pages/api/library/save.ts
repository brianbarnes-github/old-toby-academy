import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

const MAX_BYTES = 10 * 1024 * 1024;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

function safeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'file';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

function uuid(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return redirect('/library/contributed?error=' + encodeURIComponent('Could not read upload.'));
  }

  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired.', { status: 403 });
  }

  const user = locals.user;
  if (!user) return redirect('/login');

  if (!locals.permissions.has('library.contribute')) {
    return new Response('Forbidden — library.contribute required.', { status: 403 });
  }

  const entryId = String(formData.get('entry_id') ?? '').trim() || null;
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const category = String(formData.get('category') ?? '').trim() || null;
  const file = formData.get('file');

  if (!slug || !title) {
    const back = entryId ? `/library/contributed/${slug}/edit` : '/library/contributed/new';
    return redirect(`${back}?error=${encodeURIComponent('Slug and title are required.')}`);
  }
  if (!SLUG_RE.test(slug)) {
    const back = entryId ? `/library/contributed/${slug}/edit` : '/library/contributed/new';
    return redirect(`${back}?error=${encodeURIComponent('Slug must be lowercase letters, digits, and hyphens.')}`);
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);

  // ---- File handling: required on create, optional on edit ----
  let storagePath: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;
  let contentType: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      const back = entryId ? `/library/contributed/${slug}/edit` : '/library/contributed/new';
      return redirect(`${back}?error=${encodeURIComponent('File must be under 10 MB.')}`);
    }
    const folder = uuid();
    fileName = safeFilename(file.name);
    storagePath = `${folder}/${fileName}`;
    fileSize = file.size;
    contentType = file.type || 'application/octet-stream';

    const buffer = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage
      .from('library-files')
      .upload(storagePath, buffer, { contentType, upsert: false });

    if (upErr) {
      const back = entryId ? `/library/contributed/${slug}/edit` : '/library/contributed/new';
      return redirect(`${back}?error=${encodeURIComponent(`Upload failed: ${upErr.message}`)}`);
    }
  } else if (!entryId) {
    // Creating a new entry without a file is invalid.
    return redirect(`/library/contributed/new?error=${encodeURIComponent('Please pick a file to upload.')}`);
  }

  if (!entryId) {
    // INSERT
    const { data, error } = await supabase
      .from('library_entries')
      .insert({
        slug,
        title,
        description,
        category,
        file_path: storagePath!,
        file_name: fileName!,
        file_size: fileSize,
        content_type: contentType,
        created_by: user.id,
      })
      .select('slug')
      .maybeSingle();

    if (error) {
      // Roll back the orphaned upload
      if (storagePath) {
        await supabase.storage.from('library-files').remove([storagePath]);
      }
      return redirect(`/library/contributed/new?error=${encodeURIComponent(error.message)}`);
    }

    await supabase.from('entries').insert({
      user_id: user.id,
      event_type: 'library_entry_created',
      details: { slug, title, file_name: fileName },
    });

    return redirect(`/library/contributed/${data!.slug}/edit?ok=created`);
  } else {
    // UPDATE — replace metadata; if a new file was supplied, replace it too
    const updates: Record<string, any> = { slug, title, description, category };
    let oldFilePath: string | null = null;

    if (storagePath) {
      // Look up the old path before overwriting
      const { data: existing } = await supabase
        .from('library_entries')
        .select('file_path')
        .eq('id', entryId)
        .maybeSingle();
      oldFilePath = (existing?.file_path as string | undefined) ?? null;

      updates.file_path = storagePath;
      updates.file_name = fileName;
      updates.file_size = fileSize;
      updates.content_type = contentType;
    }

    const { error } = await supabase
      .from('library_entries')
      .update(updates)
      .eq('id', entryId);

    if (error) {
      if (storagePath) {
        await supabase.storage.from('library-files').remove([storagePath]);
      }
      return redirect(`/library/contributed/${slug}/edit?error=${encodeURIComponent(error.message)}`);
    }

    // Remove the old file once the new one is committed
    if (oldFilePath && oldFilePath !== storagePath) {
      await supabase.storage.from('library-files').remove([oldFilePath]);
    }

    await supabase.from('entries').insert({
      user_id: user.id,
      event_type: 'library_entry_updated',
      details: { slug, title, replaced_file: !!storagePath },
    });

    return redirect(`/library/contributed/${slug}/edit?ok=updated`);
  }
};

export const GET: APIRoute = async ({ redirect }) => redirect('/library/contributed');
