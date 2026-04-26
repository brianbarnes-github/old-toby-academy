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
  const publish = String(formData.get('publish') ?? 'true') === 'true';
  if (!entryId) return redirect('/library/contributed?error=Missing+entry');

  const supabase = createSupabaseServerClient(cookies, request.headers);

  const { data: entry, error } = await supabase
    .from('library_entries')
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq('id', entryId)
    .select('slug')
    .maybeSingle();

  if (error || !entry) {
    return redirect(`/library/contributed?error=${encodeURIComponent(error?.message ?? 'Update failed.')}`);
  }

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: publish ? 'library_entry_published' : 'library_entry_unpublished',
    details: { entry_id: entryId, slug: entry.slug },
  });

  return redirect(`/library/contributed/${entry.slug}/edit?ok=${publish ? 'published' : 'unpublished'}`);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/library/contributed');
