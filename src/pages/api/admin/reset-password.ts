import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { createSupabaseAdminClient, generateTempPassword } from '../../../lib/supabase/admin';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired. Refresh the page and try again.', { status: 403 });
  }
  const targetUserId = String(formData.get('user_id') ?? '').trim();
  const back = String(formData.get('back') ?? `/admin/users/${targetUserId}`);

  if (!targetUserId) {
    return redirect(`${back}?error=${encodeURIComponent('Missing user.')}`);
  }

  // Permission check uses the caller's session-bound client.
  if (!locals.permissions.has('users.reset_password')) {
    return redirect(`${back}?error=${encodeURIComponent("You don't have permission to reset passwords.")}`);
  }

  const sessionClient = createSupabaseServerClient(cookies, request.headers);
  const callerId = locals.user?.id;
  if (!callerId) {
    return redirect('/login');
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (e: any) {
    return redirect(`${back}?error=${encodeURIComponent(e.message ?? 'Admin client unavailable.')}`);
  }

  const tempPassword = generateTempPassword();

  const { error: updateErr } = await admin.auth.admin.updateUserById(targetUserId, {
    password: tempPassword,
  });

  if (updateErr) {
    return redirect(`${back}?error=${encodeURIComponent(updateErr.message)}`);
  }

  // Audit (with the session client so auth.uid() is the caller).
  await sessionClient.from('entries').insert({
    user_id: callerId,
    event_type: 'password_reset',
    details: { target_user_id: targetUserId },
  });

  // Pass the temporary password back via the URL hash. Hashes never
  // hit the server, never appear in access logs. The page reads it
  // client-side, then JS clears it from the URL.
  return new Response(null, {
    status: 303,
    headers: { Location: `${back}#temp=${encodeURIComponent(tempPassword)}` },
  });
};

export const GET: APIRoute = async ({ redirect }) => redirect('/admin/users');
