// Server-side markdown rendering for course / class content.
//
// Authors are trusted (gated by courses.author / library.contribute);
// v1 does NOT sanitize HTML in the rendered output. Pasting raw HTML
// in body_md is allowed by design. If we ever broaden the author
// pool to less-trusted folks, swap to a sanitizing renderer
// (e.g. dompurify on jsdom, or rehype-sanitize).

import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Render markdown to HTML and rewrite GFM task-list checkboxes so the
 * frontend can hydrate them with persistent state. Each checkbox gets a
 * `data-task-index` numbered in document order, and its parent `<li>` gets
 * `class="task-li"` (replacing the default `task-list-item`). The
 * `disabled` attribute is dropped so users can interact with them.
 */
export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return '';
  const raw = marked.parse(md, { async: false }) as string;
  return rewriteTaskCheckboxes(raw);
}

/**
 * Returns true if the rendered HTML contains any interactive task
 * checkboxes. Pages can use this to conditionally include the
 * client-side hydration script.
 */
export function containsTasks(html: string): boolean {
  return /data-task-index=/.test(html);
}

function rewriteTaskCheckboxes(html: string): string {
  let index = 0;

  // marked emits something like:
  //   <li><input disabled="" type="checkbox"> task text</li>
  // (with possible extra whitespace and attribute ordering).
  // We replace each `<input ... type="checkbox" ...>` that has `disabled`
  // with one that has `data-task-index` instead, and add `class="task-li"`
  // to the enclosing <li>.
  return html.replace(
    /<li(?:\s+class="task-list-item")?>\s*<input([^>]*?)type="checkbox"([^>]*?)>/g,
    (match, before, after) => {
      const combined = `${before} ${after}`;
      // Only rewrite ones that look like the disabled GFM checkboxes.
      if (!/disabled/.test(combined)) return match;
      const checked = /checked/.test(combined) ? ' checked' : '';
      const i = ++index;
      return `<li class="task-li"><input type="checkbox" data-task-index="${i}"${checked}>`;
    },
  );
}

/**
 * Quiz shortcode helpers. Authors mount a quiz inline by writing
 *   [[quiz: my-slug]]
 * anywhere in the body. The shortcode survives marked.parse() unchanged
 * because the brackets don't form valid markdown link syntax. The
 * class viewer page replaces each shortcode with the server-rendered
 * quiz markup at SSR time.
 */

const QUIZ_SLUG_BODY = '([a-z0-9][a-z0-9-]{0,63})';

export function containsQuizShortcodes(html: string): boolean {
  return new RegExp(`\\[\\[quiz:\\s*${QUIZ_SLUG_BODY}\\s*\\]\\]`).test(html);
}

export function listQuizShortcodes(html: string): string[] {
  const slugs: string[] = [];
  const re = new RegExp(`\\[\\[quiz:\\s*${QUIZ_SLUG_BODY}\\s*\\]\\]`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    slugs.push(m[1]);
  }
  return slugs;
}

export function replaceQuizShortcodes(
  html: string,
  resolver: (slug: string) => string,
): string {
  return html.replace(
    new RegExp(`\\[\\[quiz:\\s*${QUIZ_SLUG_BODY}\\s*\\]\\]`, 'g'),
    (_, slug) => resolver(slug),
  );
}
