import { createServerClient, type CookieOptionsWithName, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in env');
}

export type Role = 'student' | 'faculty' | 'headmaster';

export interface Profile {
  user_id: string;
  role: Role;
  character_name: string | null;
  server: string | null;
  created_at: string;
  rules_accepted_at: string | null;
  onboarding_completed_at: string | null;
  instrument: string | null;
  why_joining: string | null;
  experience: string | null;
}

export function createSupabaseServerClient(cookies: AstroCookies, headers: Headers) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(headers.get('Cookie') ?? '').map(({ name, value }) => ({
          name,
          value: value ?? '',
        }));
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptionsWithName }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
