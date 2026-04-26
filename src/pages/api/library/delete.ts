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

  const entryId = String(formData.get('entry_id') ?? '').trim();
  if (!entryId) return redirect('/library?error=Missing+entry');

  const supabase = createSupabaseServerClient(cookies, request.headers);

  const { data: entry } = await supabase
    .from('library_entries')
    .select('slug, title, file_path')
    .eq('id', entryId)
    .maybeSingle();

  const { error } = await supabase.from('library_entries').delete().eq('id', entryId);

  if (error) {
    return redirect(`/library?error=${encodeURIComponent(error.message)}`);
  }

  if (entry?.file_path) {
    await supabase.storage.from('library-files').remove([entry.file_path]);
  }

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'library_entry_deleted',
    details: { entry_id: entryId, slug: entry?.slug, title: entry?.title },
  });

  return redirect('/library?ok=deleted');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/library');
