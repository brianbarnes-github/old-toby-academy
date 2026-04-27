import { describe, it, expect } from 'vitest';
import {
  preprocessMarkdown,
  shouldUseSourceMode,
  listQuizShortcodeSlugs,
} from './markdown-bridge.js';

describe('preprocessMarkdown', () => {
  it('converts [[quiz: slug]] to <quiz-shortcode>', () => {
    const out = preprocessMarkdown('Try [[quiz: relative-minors]] now.');
    expect(out).toBe('Try <quiz-shortcode data-slug="relative-minors"></quiz-shortcode> now.');
  });

  it('handles multiple shortcodes', () => {
    const out = preprocessMarkdown('[[quiz: a]] then [[quiz: b]]');
    expect(out).toContain('data-slug="a"');
    expect(out).toContain('data-slug="b"');
  });

  it('tolerates whitespace inside the shortcode', () => {
    const out = preprocessMarkdown('[[quiz:   spaced   ]]');
    expect(out).toContain('data-slug="spaced"');
  });

  it('passes prose through unchanged', () => {
    expect(preprocessMarkdown('# Heading\n\nbody')).toBe('# Heading\n\nbody');
  });

  it('returns empty for empty / null / undefined', () => {
    expect(preprocessMarkdown('')).toBe('');
    expect(preprocessMarkdown(null)).toBe('');
    expect(preprocessMarkdown(undefined)).toBe('');
  });

  it('passes invalid slugs through as literal text (so authors notice and fix)', () => {
    const out = preprocessMarkdown('[[quiz: Bad_Slug]] [[quiz: -leading]] [[quiz: ok-one]]');
    expect(out).toContain('data-slug="ok-one"');
    // The bad ones stay as literal markdown so they're visible to the author.
    expect(out).toContain('[[quiz: Bad_Slug]]');
    expect(out).toContain('[[quiz: -leading]]');
  });
});

describe('shouldUseSourceMode', () => {
  it('triggers on inline SVG', () => {
    expect(shouldUseSourceMode('# H\n\n<svg width="10" height="10"></svg>')).toBe(true);
  });

  it('triggers on iframe', () => {
    expect(shouldUseSourceMode('<iframe src="..."></iframe>')).toBe(true);
  });

  it('triggers on <details>', () => {
    expect(shouldUseSourceMode('<details><summary>x</summary>y</details>')).toBe(true);
  });

  it('triggers on a GFM pipe table', () => {
    const md = '| a | b |\n| - | - |\n| 1 | 2 |';
    expect(shouldUseSourceMode(md)).toBe(true);
  });

  it('does NOT trigger on prose with task lists / quizzes / code blocks', () => {
    const md = '# H\n\n- [ ] task\n\n```js\ncode\n```\n\n[[quiz: foo]]';
    expect(shouldUseSourceMode(md)).toBe(false);
  });

  it('does NOT trigger on inline HTML the editor can model (a, em, strong)', () => {
    expect(shouldUseSourceMode('<a href="x">link</a>')).toBe(false);
    expect(shouldUseSourceMode('<em>x</em>')).toBe(false);
  });

  it('returns false for empty/null', () => {
    expect(shouldUseSourceMode('')).toBe(false);
    expect(shouldUseSourceMode(null)).toBe(false);
    expect(shouldUseSourceMode(undefined)).toBe(false);
  });
});

describe('listQuizShortcodeSlugs', () => {
  it('lists slugs in document order', () => {
    expect(listQuizShortcodeSlugs('[[quiz: a]] body [[quiz: b]] [[quiz: c]]')).toEqual(['a', 'b', 'c']);
  });

  it('returns [] when no shortcodes', () => {
    expect(listQuizShortcodeSlugs('# Heading\n\nbody')).toEqual([]);
  });

  it('skips invalid slugs', () => {
    expect(listQuizShortcodeSlugs('[[quiz: Bad_Slug]] [[quiz: ok]]')).toEqual(['ok']);
  });
});
