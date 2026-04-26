import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const userId = String(formData.get('user_id') ?? '').trim();
  const roleId = String(formData.get('role_id') ?? '').trim();
  const back = String(formData.get('back') ?? `/admin/users/${userId}`);

  if (!userId || !roleId) {
    return redirect(`${back}?error=${encodeURIComponent('Missing user or role.')}`);
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const { error } = await supabase.rpc('admin_grant_role', { p_target: userId, p_role_id: roleId });

  if (error) return redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  return redirect(`${back}?ok=granted`);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/admin/users');
