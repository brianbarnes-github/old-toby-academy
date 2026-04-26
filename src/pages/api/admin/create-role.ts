import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const slug = String(formData.get('slug') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;

  if (!slug || !name) {
    return redirect('/admin/roles?error=' + encodeURIComponent('Slug and name are required.'));
  }

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const { data, error } = await supabase.rpc('admin_create_role', {
    p_slug: slug,
    p_name: name,
    p_description: description,
  });

  if (error) {
    return redirect('/admin/roles?error=' + encodeURIComponent(error.message));
  }

  return redirect(`/admin/roles/${data}?ok=created`);
};

export const GET: APIRoute = async ({ redirect }) => redirect('/admin/roles');
