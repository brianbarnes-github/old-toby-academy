/* Old Toby Academy — markdown-bridge.js
 *
 * Helpers for the visual class-body editor. Bridges between the
 * `body_md` markdown string (the source of truth) and the
 * tiptap-markdown editor.
 *
 * Three jobs:
 *   1. preprocessMarkdown(md): rewrite `[[quiz: slug]]` shortcodes
 *      into inline HTML the QuizShortcode node can parse, so they
 *      survive setContent().
 *   2. shouldUseSourceMode(md): detect whether the markdown contains
 *      constructs the visual editor can't faithfully roundtrip
 *      (raw HTML for SVG/iframes/details, GFM tables) and force
 *      source mode for those classes.
 *   3. ensureNoOpRoundtrip(md): a sanity check helper used by tests.
 *      Wraps the simple mode-decision rule.
 */

const QUIZ_SHORTCODE_RE = /\[\[quiz:\s*([a-z0-9][a-z0-9-]{0,63})\s*\]\]/g;

// Tags the visual editor can't model as first-class TipTap nodes.
// If the markdown body contains any of these, we open in source mode.
const RAW_HTML_RE = /<(?:iframe|svg|details|script|style|video|audio|canvas|object|embed|figure|figcaption|aside|section|article|nav|header|footer|main|dialog)\b/i;

// GFM pipe-table heuristic: a header row followed by a separator row
// of dashes / pipes / colons. Tables aren't included in v1, so a class
// with a table opens in source mode.
const GFM_TABLE_RE = /^\|.+\|[ \t]*\n\|[\s|:\-]+\|/m;

export function preprocessMarkdown(md) {
  if (!md) return '';
  return md.replace(
    QUIZ_SHORTCODE_RE,
    (_, slug) => `<quiz-shortcode data-slug="${slug}"></quiz-shortcode>`,
  );
}

export function shouldUseSourceMode(md) {
  if (!md) return false;
  return RAW_HTML_RE.test(md) || GFM_TABLE_RE.test(md);
}

export function listQuizShortcodeSlugs(md) {
  const slugs = [];
  if (!md) return slugs;
  const re = new RegExp(QUIZ_SHORTCODE_RE.source, 'g');
  let m;
  while ((m = re.exec(md)) !== null) {
    slugs.push(m[1]);
  }
  return slugs;
}
