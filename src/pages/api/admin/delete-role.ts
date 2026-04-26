import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { verifyCsrf } from '../../../lib/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  if (!verifyCsrf(formData, cookies)) {
    return new Response('Session expired. Refresh the page and try again.', { status: 403 });
  }
  const roleId = String(formData.get('role_id') ?? '').trim();

  if (!roleId) {
    return redirect('/admin/roles?error=' + encodeURIComponent('Missing role.'));
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const { error } = await supabase.rpc('admin_delete_role', { p_role_id: roleId });

  if (error) {
    return redirect(`/admin/roles/${roleId}?error=${encodeURIComponent(error.message)}`);
  }

  return redirect('/admin/roles?ok=deleted');
};

export const GET: APIRoute = async ({ redirect }) => redirect('/admin/roles');
