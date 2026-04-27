import { describe, it, expect } from 'vitest';
import { renderMarkdown, containsTasks } from './markdown';

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
