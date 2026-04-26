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

export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return '';
  return marked.parse(md, { async: false }) as string;
}
