import { describe, it, expect } from 'vitest';
import { generateTempPassword } from './admin';

describe('generateTempPassword', () => {
  it('returns a 16-character string', () => {
    expect(generateTempPassword()).toHaveLength(16);
  });

  it('uses only the unambiguous alphabet (no 0 / O / I / l / 1)', () => {
    // Sample many passwords; none should contain a banned character.
    const banned = /[0OIl1]/;
    for (let i = 0; i < 200; i++) {
      const pwd = generateTempPassword();
      expect(pwd).not.toMatch(banned);
    }
  });

  it('produces (effectively) unique passwords each call', () => {
    const passwords = new Set(Array.from({ length: 100 }, () => generateTempPassword()));
    expect(passwords.size).toBe(100);
  });

  it('only contains alphanumerics', () => {
    const pwd = generateTempPassword();
    expect(pwd).toMatch(/^[A-Za-z0-9]+$/);
  });
});
