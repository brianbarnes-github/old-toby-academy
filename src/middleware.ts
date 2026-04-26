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

// Routes only headmaster can reach.
const HEADMASTER_PREFIXES = ['/admin'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  if (PUBLIC_API_ROUTES.has(pathname)) return true;
  // Static-asset and Astro internals
  if (pathname.startsWith('/_')) return true;
  if (pathname.startsWith('/assets/')) return true;
  if (pathname === '/crest.svg' || pathname === '/favicon.ico') return true;
  return false;
}

function requiresHeadmaster(pathname: string): boolean {
  return HEADMASTER_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
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

  // Headmaster-only routes
  if (requiresHeadmaster(pathname) && profile?.role !== 'headmaster') {
    return new Response('Forbidden — headmaster only.', { status: 403 });
  }

  return next();
});
