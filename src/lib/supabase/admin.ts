// Service-role Supabase client. SERVER-ONLY — never import this in
// client-hydrated component scripts. The key bypasses RLS and grants
// full database access; treat it like a root password.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient | null = null;

export function createSupabaseAdminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Supabase admin client unavailable: SUPABASE_SERVICE_ROLE_KEY is not set. Add it to Netlify env vars.'
    );
  }
  if (cached) return cached;
  cached = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}

/**
 * 16-char temporary password from an unambiguous alphabet
 * (no 0/O/I/l/1). Easy to read aloud; still 80+ bits of entropy.
 */
export function generateTempPassword(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => alphabet[b % alphabet.length]).join('');
}
