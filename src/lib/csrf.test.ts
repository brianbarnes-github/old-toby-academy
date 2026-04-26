import { describe, it, expect } from 'vitest';
import { generateCsrfToken, verifyCsrf, CSRF_FIELD } from './csrf';
import type { AstroCookies } from 'astro';

function makeCookies(value: string | undefined): AstroCookies {
  return {
    get: (name: string) =>
      name === 'csrf_token' && value !== undefined ? ({ value } as any) : undefined,
  } as unknown as AstroCookies;
}

function makeForm(token: string | undefined): FormData {
  const fd = new FormData();
  if (token !== undefined) fd.set(CSRF_FIELD, token);
  return fd;
}

describe('generateCsrfToken', () => {
  it('returns 32 alphanumeric characters', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[A-Za-z0-9]{32}$/);
  });

  it('returns a different token on each call (effectively unique)', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateCsrfToken()));
    expect(tokens.size).toBe(50);
  });
});

describe('verifyCsrf', () => {
  const valid = 'A'.repeat(32);

  it('accepts matching cookie + form values', () => {
    expect(verifyCsrf(makeForm(valid), makeCookies(valid))).toBe(true);
  });

  it('rejects when cookie is missing', () => {
    expect(verifyCsrf(makeForm(valid), makeCookies(undefined))).toBe(false);
  });

  it('rejects when form value is missing', () => {
    expect(verifyCsrf(makeForm(undefined), makeCookies(valid))).toBe(false);
  });

  it('rejects when both are missing', () => {
    expect(verifyCsrf(makeForm(undefined), makeCookies(undefined))).toBe(false);
  });

  it('rejects when values differ', () => {
    expect(verifyCsrf(makeForm('A'.repeat(32)), makeCookies('B'.repeat(32)))).toBe(false);
  });

  it('rejects when lengths differ (no length-leak through compare)', () => {
    expect(verifyCsrf(makeForm('short'), makeCookies(valid))).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(verifyCsrf(makeForm(''), makeCookies(''))).toBe(false);
  });

  it('treats whitespace as different from empty', () => {
    expect(verifyCsrf(makeForm(' '), makeCookies(''))).toBe(false);
  });
});
