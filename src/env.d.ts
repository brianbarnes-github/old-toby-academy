/// <reference path="../.astro/types.d.ts" />

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Profile } from './lib/supabase/server';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      user: User | null;
      profile: Profile | null;
      /** Set of permission slugs the current user holds (empty if unauthenticated). */
      permissions: Set<string>;
      /** Per-session CSRF token. Embed in every mutating form via <CsrfField />. */
      csrfToken: string;
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  /** Server-only. Never expose to the client. Required for /api/admin/reset-password. */
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
