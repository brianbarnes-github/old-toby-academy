// Synthetic-email domain for character-name-based logins.
// `.invalid` is RFC 6761 — guaranteed never to be a real domain,
// so accidental email sends just bounce harmlessly.
const SYNTHETIC_EMAIL_DOMAIN = 'academy.invalid';

/**
 * Lowercase, replace anything that isn't a-z/0-9 with `-`,
 * collapse runs of `-`, trim leading/trailing `-`.
 * Example: "Vy'dor the Bold!" → "vy-dor-the-bold"
 */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Convert a character name to the synthetic email we store in
 * Supabase auth.users. Stable for a given name.
 */
export function characterNameToEmail(name: string): string {
  const slug = slugifyName(name);
  if (!slug) throw new Error('character name must contain at least one letter or digit');
  return `${slug}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/**
 * Decide whether a sign-in input is an email or a character name.
 * Real emails contain `@`; character names don't.
 */
export function resolveSignInEmail(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes('@')) return trimmed;
  return characterNameToEmail(trimmed);
}
