import { createServerClient, type CookieOptionsWithName, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in env');
}

// Built-in role slugs. Custom roles created by the headmaster won't
// be in this union — use plain `string` for those code paths.
export type SystemRole = 'student' | 'faculty' | 'headmaster';
export type Role = SystemRole | (string & {});

// Curated permission catalog. New permissions need both a row in
// public.permissions AND an entry here for type safety.
export type Permission =
  | 'admin.access'
  | 'tokens.list'
  | 'tokens.mint'
  | 'tokens.revoke'
  | 'audit.read'
  | 'users.list'
  | 'users.assign_roles'
  | 'users.reset_password'
  | 'roles.manage';

export type ExperienceLevel = 'none' | 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface Profile {
  user_id: string;
  role: Role;
  character_name: string | null;
  server: string | null;
  created_at: string;
  rules_accepted_at: string | null;
  onboarding_completed_at: string | null;
  // Phase 6: experience profile
  music_level: ExperienceLevel | null;
  ingame_music_level: ExperienceLevel | null;
  technical_level: ExperienceLevel | null;
  hopes: string | null;
  // Pre-Phase-6 columns, kept for backward compatibility (no longer collected)
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
