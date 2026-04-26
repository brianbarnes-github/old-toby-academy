import { describe, it, expect } from 'vitest';
import {
  renderMarkdown,
  containsTasks,
  containsQuizShortcodes,
  listQuizShortcodes,
  replaceQuizShortcodes,
} from './markdown';

describe('renderMarkdown', () => {
  it('renders headings, paragraphs, and lists', () => {
    const html = renderMarkdown('# H\n\nbody\n\n- one\n- two');
    expect(html).toContain('<h1>H</h1>');
    expect(html).toContain('<p>body</p>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
  });

  it('returns an empty string for null/undefined/empty input', () => {
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
    expect(renderMarkdown('')).toBe('');
  });

  it('passes raw HTML through (authors are trusted)', () => {
    const html = renderMarkdown('<div class="callout">hi</div>');
    expect(html).toContain('<div class="callout">hi</div>');
  });

  it('rewrites GFM task list checkboxes with data-task-index', () => {
    const html = renderMarkdown('- [ ] first\n- [ ] second\n- [x] third');
    expect(html).toContain('data-task-index="1"');
    expect(html).toContain('data-task-index="2"');
    expect(html).toContain('data-task-index="3"');
    // The third one was [x] checked in markdown.
    expect(html).toMatch(/data-task-index="3"\s+checked/);
    // Each li carries the task-li class.
    const liMatches = html.match(/<li class="task-li">/g);
    expect(liMatches?.length).toBe(3);
    // The disabled attribute is dropped.
    expect(html).not.toContain('disabled');
  });

  it('does not rewrite plain checkbox HTML the author wrote themselves', () => {
    const html = renderMarkdown('<input type="checkbox" />');
    expect(html).not.toContain('data-task-index');
  });

  it('numbers tasks across multiple lists', () => {
    const md = `- [ ] a\n- [ ] b\n\nsome prose\n\n- [ ] c`;
    const html = renderMarkdown(md);
    expect(html).toContain('data-task-index="1"');
    expect(html).toContain('data-task-index="2"');
    expect(html).toContain('data-task-index="3"');
  });
});

describe('containsTasks', () => {
  it('returns true when rendered HTML has tasks', () => {
    const html = renderMarkdown('- [ ] thing');
    expect(containsTasks(html)).toBe(true);
  });

  it('returns false on prose-only HTML', () => {
    const html = renderMarkdown('# heading\n\nbody');
    expect(containsTasks(html)).toBe(false);
  });
});

describe('quiz shortcodes', () => {
  it('detects [[quiz: slug]] shortcodes after rendering', () => {
    const html = renderMarkdown('Pre-prose.\n\n[[quiz: relative-minors]]\n\nPost-prose.');
    expect(containsQuizShortcodes(html)).toBe(true);
    expect(listQuizShortcodes(html)).toEqual(['relative-minors']);
  });

  it('lists multiple shortcodes in document order', () => {
    const html = renderMarkdown('[[quiz: one]]\n\nbody\n\n[[quiz: two]]\n\n[[quiz: three]]');
    expect(listQuizShortcodes(html)).toEqual(['one', 'two', 'three']);
  });

  it('returns empty / false when there are no shortcodes', () => {
    const html = renderMarkdown('# Just prose');
    expect(containsQuizShortcodes(html)).toBe(false);
    expect(listQuizShortcodes(html)).toEqual([]);
  });

  it('tolerates whitespace inside the shortcode', () => {
    const html = renderMarkdown('[[quiz:   spaced   ]]');
    expect(listQuizShortcodes(html)).toEqual(['spaced']);
  });

  it('rejects invalid slugs', () => {
    // Uppercase, leading dash, and underscores are not valid slugs.
    const html = renderMarkdown('[[quiz: Bad_Slug]] [[quiz: -leading]] [[quiz: ok-one]]');
    expect(listQuizShortcodes(html)).toEqual(['ok-one']);
  });

  it('replaces shortcodes via a resolver', () => {
    const html = renderMarkdown('Before\n\n[[quiz: foo]]\n\nAfter');
    const out = replaceQuizShortcodes(html, (slug) => `<div class="quiz" data-slug="${slug}"></div>`);
    expect(out).toContain('<div class="quiz" data-slug="foo"></div>');
    expect(out).not.toContain('[[quiz:');
  });
});
