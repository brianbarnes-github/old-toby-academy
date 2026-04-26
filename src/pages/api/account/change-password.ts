import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const user = locals.user;
  if (!user || !user.email) return redirect('/login');

  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired. Refresh the page and try again.', { status: 403 });
  }
  const currentPassword = String(formData.get('current_password') ?? '');
  const newPassword = String(formData.get('new_password') ?? '');
  const confirm = String(formData.get('new_password_confirm') ?? '');

  if (!currentPassword || !newPassword) {
    return redirect('/account?error=' + encodeURIComponent('Please fill every field.'));
  }
  if (newPassword.length < 6) {
    return redirect('/account?error=' + encodeURIComponent('New password must be at least 6 characters.'));
  }
  if (newPassword !== confirm) {
    return redirect('/account?error=' + encodeURIComponent('New password and confirmation do not match.'));
  }
  if (newPassword === currentPassword) {
    return redirect('/account?error=' + encodeURIComponent('New password must be different from the current one.'));
  }

  // Verify the current password using a fresh, isolated Supabase client.
  // This client doesn't share cookie state with the user's session, so
  // a successful or failed signIn won't disturb their existing session.
  const verifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: verifyErr } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyErr) {
    return redirect('/account?error=' + encodeURIComponent('Current password is incorrect.'));
  }

  // Apply the password change via the user's own session client.
  const sessionClient = createSupabaseServerClient(cookies, request.headers);
  const { error: updateErr } = await sessionClient.auth.updateUser({ password: newPassword });

  if (updateErr) {
    return redirect('/account?error=' + encodeURIComponent(updateErr.message));
  }

  await sessionClient.from('entries').insert({
    user_id: user.id,
    event_type: 'password_changed',
    details: {},
  });

  return redirect('/account?ok=password');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/account');
