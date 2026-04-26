import { describe, it, expect } from 'vitest';
import { slugifyName, characterNameToEmail, resolveSignInEmail } from './auth';

describe('slugifyName', () => {
  it('lowercases plain ASCII names', () => {
    expect(slugifyName('Vydor')).toBe('vydor');
  });

  it('leaves digits alone', () => {
    expect(slugifyName('Pippin42')).toBe('pippin42');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugifyName('Pippin Took')).toBe('pippin-took');
  });

  it('replaces apostrophes and other special chars with hyphens', () => {
    expect(slugifyName("Vy'dor")).toBe('vy-dor');
    expect(slugifyName('Foo!Bar')).toBe('foo-bar');
  });

  it('collapses runs of non-alphanumeric into a single hyphen', () => {
    expect(slugifyName('Foo!!! Bar')).toBe('foo-bar');
    expect(slugifyName('A___B')).toBe('a-b');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugifyName('--foo--')).toBe('foo');
    expect(slugifyName('!!!Vydor!!!')).toBe('vydor');
  });

  it('strips non-ASCII unicode (treated as separator)', () => {
    expect(slugifyName('Vydór')).toBe('vyd-r');
    expect(slugifyName('Æthelwulf')).toBe('thelwulf');
  });

  it('returns empty string when input has no alphanumerics', () => {
    expect(slugifyName('!!!')).toBe('');
    expect(slugifyName('   ')).toBe('');
    expect(slugifyName('')).toBe('');
  });
});

describe('characterNameToEmail', () => {
  it('returns synthetic email at academy.invalid', () => {
    expect(characterNameToEmail('Vydor')).toBe('vydor@academy.invalid');
  });

  it('uses the slug, not the original name', () => {
    expect(characterNameToEmail('Pippin Took')).toBe('pippin-took@academy.invalid');
  });

  it('throws on names with no usable characters', () => {
    expect(() => characterNameToEmail('!!!')).toThrow();
    expect(() => characterNameToEmail('')).toThrow();
  });
});

describe('resolveSignInEmail', () => {
  it('returns the input unchanged if it contains @', () => {
    expect(resolveSignInEmail('foo@example.com')).toBe('foo@example.com');
  });

  it('trims whitespace around emails', () => {
    expect(resolveSignInEmail('  foo@example.com  ')).toBe('foo@example.com');
  });

  it('treats character-name input as a synthetic email', () => {
    expect(resolveSignInEmail('Vydor')).toBe('vydor@academy.invalid');
  });

  it('trims whitespace around character names', () => {
    expect(resolveSignInEmail('  Vydor  ')).toBe('vydor@academy.invalid');
  });
});
