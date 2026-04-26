// Double-submit cookie CSRF protection.
//
// Pattern: middleware sets a random 32-char token in an HttpOnly cookie
// per session. Every mutating form embeds the same token as a hidden
// input (rendered server-side). Handlers call verifyCsrf() and reject
// any submit where the cookie + form values don't match.
//
// A cross-site attacker can't read the cookie (HttpOnly + SameSite),
// can't guess the token (32 random chars from crypto.getRandomValues),
// and so can't forge a valid form submission.

import type { AstroCookies } from 'astro';

export const CSRF_COOKIE = 'csrf_token';
export const CSRF_FIELD = 'csrf_token';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateCsrfToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function ensureCsrfCookie(cookies: AstroCookies): string {
  const existing = cookies.get(CSRF_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9]{32}$/.test(existing)) return existing;

  const token = generateCsrfToken();
  cookies.set(CSRF_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return token;
}

/**
 * Compare a form's csrf_token field against the cookie. Returns true
 * if they match (constant-time compare to dodge timing attacks).
 */
export function verifyCsrf(formData: FormData, cookies: AstroCookies): boolean {
  const cookieToken = cookies.get(CSRF_COOKIE)?.value;
  const formToken = String(formData.get(CSRF_FIELD) ?? '');
  if (!cookieToken || !formToken) return false;
  if (cookieToken.length !== formToken.length) return false;

  let mismatch = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    mismatch |= cookieToken.charCodeAt(i) ^ formToken.charCodeAt(i);
  }
  return mismatch === 0;
}
