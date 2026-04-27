/* QuizShortcode — custom TipTap inline atom node.
 *
 * Author types nothing — they pick from the toolbar's Quiz dropdown,
 * which inserts this node with attrs.slug. Renders in the editor as
 * a parchment+gold chip showing "Quiz: <slug>". Serializes to
 * `[[quiz: <slug>]]` markdown text that survives unchanged through
 * marked.parse() server-side and gets resolved by replaceQuizShortcodes
 * in src/lib/markdown.ts.
 *
 * Parsed from <quiz-shortcode data-slug="..."></quiz-shortcode> input
 * — markdown bridge preprocesses [[quiz: slug]] into that form before
 * the editor sees it.
 */
import { Node, mergeAttributes } from '@tiptap/core';

export const QuizShortcode = Node.create({
  name: 'quizShortcode',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      slug: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-slug') ?? '',
        renderHTML: (attrs) => ({ 'data-slug': attrs.slug }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'quiz-shortcode' },
      { tag: 'span[data-quiz-shortcode]' },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-quiz-shortcode': '',
        class: 'be-quiz-chip',
        contenteditable: 'false',
      }),
      `Quiz: ${node.attrs.slug || '(no slug)'}`,
    ];
  },

  // tiptap-markdown reads this storage to serialize back to markdown.
  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          state.write(`[[quiz: ${node.attrs.slug}]]`);
        },
        parse: {
          // We pre-process [[quiz: ...]] into HTML before setContent,
          // so this hook isn't strictly needed, but it's here in case
          // tiptap-markdown sees a raw shortcode in input.
          setup(markdownit) {
            markdownit.inline.ruler.before('text', 'quiz-shortcode', (parserState, silent) => {
              const start = parserState.pos;
              const src = parserState.src;
              if (src.charCodeAt(start) !== 0x5b /* [ */) return false;
              if (src.charCodeAt(start + 1) !== 0x5b) return false;
              const m = src.slice(start).match(/^\[\[quiz:\s*([a-z0-9][a-z0-9-]{0,63})\s*\]\]/);
              if (!m) return false;
              if (!silent) {
                const token = parserState.push('html_inline', '', 0);
                token.content = `<quiz-shortcode data-slug="${m[1]}"></quiz-shortcode>`;
              }
              parserState.pos = start + m[0].length;
              return true;
            });
          },
        },
      },
    };
  },
});
