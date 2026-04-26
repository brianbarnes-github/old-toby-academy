import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const TYPE_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const user = locals.user;
  if (!user) return redirect('/login');

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return redirect('/account?error=' + encodeURIComponent('Could not read upload.'));
  }

  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired. Refresh the page and try again.', { status: 403 });
  }

  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size === 0) {
    return redirect('/account?error=' + encodeURIComponent('Pick an image to upload.'));
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return redirect('/account?error=' + encodeURIComponent('PNG, JPEG, WEBP, or GIF only.'));
  }
  if (file.size > MAX_BYTES) {
    return redirect('/account?error=' + encodeURIComponent('Image must be under 2 MB.'));
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const ext = TYPE_TO_EXT[file.type] ?? 'png';
  const path = `${user.id}/avatar.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadErr) {
    return redirect('/account?error=' + encodeURIComponent(`Upload failed: ${uploadErr.message}`));
  }

  // Add a cache-busting query so the masthead/account refresh after re-upload.
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('user_id', user.id);

  if (updateErr) {
    return redirect('/account?error=' + encodeURIComponent(updateErr.message));
  }

  await supabase.from('entries').insert({
    user_id: user.id,
    event_type: 'profile_updated',
    details: { fields_changed: ['avatar_url'] },
  });

  return redirect('/account?ok=avatar');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/account');
