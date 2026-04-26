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

// Per-route permission requirements. A user passes the check if they
// hold ANY of the listed permissions. First match wins (more specific
// prefixes listed first).
const ROUTE_PERMISSIONS: Array<{ prefix: string; anyOf: string[] }> = [
  { prefix: '/admin/users',       anyOf: ['users.list', 'users.assign_roles'] },
  { prefix: '/admin/roles',       anyOf: ['roles.manage'] },
  { prefix: '/admin/permissions', anyOf: ['roles.manage'] },
  { prefix: '/admin/tokens',      anyOf: ['tokens.list', 'tokens.mint', 'tokens.revoke'] },
  { prefix: '/admin/log',         anyOf: ['audit.read'] },
];

// Areas considered "admin": a user with any permission in any of these
// areas can reach the /admin dashboard index.
const ADMIN_AREAS = new Set(['admin', 'tokens', 'users', 'roles', 'audit']);

function isPublic(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  if (PUBLIC_API_ROUTES.has(pathname)) return true;
  if (pathname.startsWith('/_')) return true;
  if (pathname.startsWith('/assets/')) return true;
  if (pathname === '/crest.svg' || pathname === '/favicon.ico') return true;
  return false;
}

function routeRequirement(pathname: string): string[] | null {
  for (const { prefix, anyOf } of ROUTE_PERMISSIONS) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return anyOf;
  }
  return null;
}

function hasAdminAreaPermission(perms: Set<string>): boolean {
  for (const slug of perms) {
    const area = slug.split('.', 1)[0];
    if (ADMIN_AREAS.has(area)) return true;
  }
  return false;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, locals, url, redirect } = context;

  const supabase = createSupabaseServerClient(cookies, request.headers);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  let permissions = new Set<string>();
  if (user) {
    const [{ data: profileData }, { data: permsData, error: permsErr }] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('my_permissions').select('slug'),
    ]);
    profile = (profileData ?? null) as Profile | null;
    if (permsErr) {
      console.error('my_permissions select failed', permsErr);
    } else if (Array.isArray(permsData)) {
      permissions = new Set(
        permsData
          .map((row: any) => row?.slug)
          .filter((slug: any): slug is string => typeof slug === 'string')
      );
    }
  }

  locals.supabase = supabase;
  locals.user = user;
  locals.profile = profile;
  locals.permissions = permissions;

  const pathname = url.pathname.replace(/\/$/, '') || '/';

  if (user && (pathname === '/login' || pathname === '/faculty-login' || pathname === '/signup')) {
    return redirect(profile?.rules_accepted_at ? '/courses' : '/welcome');
  }

  if (isPublic(pathname)) {
    return next();
  }

  if (!user) {
    const next_param = encodeURIComponent(url.pathname + url.search);
    return redirect(`/login?next=${next_param}`);
  }

  if (!profile?.rules_accepted_at && !ONBOARDING_ROUTES.has(pathname)) {
    return redirect('/welcome');
  }

  // Helper for diagnostic 403 responses while RBAC is being debugged.
  const forbidden = (need: string[] | string) => {
    const needList = Array.isArray(need) ? need.join(', ') : need;
    const have = [...permissions];
    const body = [
      "Forbidden — you don't have access to this area.",
      '',
      `Required (any of): ${needList}`,
      `You have: ${have.length > 0 ? have.join(', ') : '(none)'}`,
      `User id: ${user?.id ?? '(none)'}`,
    ].join('\n');
    return new Response(body, { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  };

  // /admin index — pass if user has any admin-area permission
  if (pathname === '/admin') {
    if (!hasAdminAreaPermission(permissions)) {
      return forbidden('any admin-area permission (admin.*, tokens.*, users.*, roles.*, audit.*)');
    }
    return next();
  }

  // Specific /admin/* routes — pass if user has ANY of the listed perms
  const required = routeRequirement(pathname);
  if (required) {
    const allowed = required.some((slug) => permissions.has(slug));
    if (!allowed) {
      return forbidden(required);
    }
  }

  return next();
});
