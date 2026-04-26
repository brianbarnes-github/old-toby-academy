import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient, type Profile } from './lib/supabase/server';

// Routes that anyone can visit without a session.
const PUBLIC_ROUTES = new Set<string>([
  '/',
  '/login',
  '/faculty-login',
  '/signup',
  '/thanks',
  '/404',
]);

// API endpoints that must be reachable without a session (the
// authentication endpoints themselves). Other /api/* routes stay
// gated and either require a session or do their own auth check.
const PUBLIC_API_ROUTES = new Set<string>([
  '/api/login',
  '/api/logout',
  '/api/redeem-token',
]);

// Routes a not-yet-onboarded user (rules_accepted_at is null) can
// still reach. Everything else bounces them to /welcome.
const ONBOARDING_ROUTES = new Set<string>([
  '/welcome',
  '/api/accept-rules',
  '/api/complete-profile',
  '/api/finish-onboarding',
  '/api/logout',
]);

// Route prefix → permission slug. First match wins. Add new prefixes
// here as Phase B / future areas grow. The permissions themselves
// must exist in the public.permissions table (seeded via migration).
const ROUTE_PERMISSIONS: Array<{ prefix: string; permission: string }> = [
  { prefix: '/admin', permission: 'admin.access' },
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  if (PUBLIC_API_ROUTES.has(pathname)) return true;
  // Static-asset and Astro internals
  if (pathname.startsWith('/_')) return true;
  if (pathname.startsWith('/assets/')) return true;
  if (pathname === '/crest.svg' || pathname === '/favicon.ico') return true;
  return false;
}

function requiredPermission(pathname: string): string | null {
  for (const { prefix, permission } of ROUTE_PERMISSIONS) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return permission;
  }
  return null;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, locals, url, redirect } = context;

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    profile = (data ?? null) as Profile | null;
  }

  // Expose to pages via Astro.locals
  locals.supabase = supabase;
  locals.user = user;
  locals.profile = profile;

  const pathname = url.pathname.replace(/\/$/, '') || '/';

  // Logged-in user hitting login/signup → bounce to where they should be next
  if (user && (pathname === '/login' || pathname === '/faculty-login' || pathname === '/signup')) {
    return redirect(profile?.rules_accepted_at ? '/courses' : '/welcome');
  }

  // Public routes always pass through
  if (isPublic(pathname)) {
    return next();
  }

  // Anything else requires a session
  if (!user) {
    const next_param = encodeURIComponent(url.pathname + url.search);
    return redirect(`/login?next=${next_param}`);
  }

  // Onboarding gate: a logged-in user who hasn't accepted the rules
  // can only reach the welcome wizard and its API handlers.
  if (!profile?.rules_accepted_at && !ONBOARDING_ROUTES.has(pathname)) {
    return redirect('/welcome');
  }

  // Permission-gated routes (dynamic RBAC). One RPC per gated request.
  const required = requiredPermission(pathname);
  if (required) {
    const { data: ok, error } = await supabase.rpc('has_permission', { p_slug: required });
    if (error) {
      console.error('has_permission RPC failed', error);
      return new Response('Permission check failed.', { status: 500 });
    }
    if (!ok) {
      return new Response("Forbidden — you don't have access to this area.", { status: 403 });
    }
  }

  return next();
});
