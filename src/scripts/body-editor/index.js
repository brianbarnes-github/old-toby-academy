/* Old Toby Academy — body-editor/index.js
 *
 * Visual class-body editor. Mounts a TipTap canvas onto a
 * `.body-editor` container, syncs to a hidden textarea
 * (name="body_md"), and provides a toolbar plus a source-mode
 * toggle.
 *
 * Public surface: window.bodyEditor.{ insertImage, insertQuiz,
 * getMode, setMode, focus } so the existing attachments/quiz
 * insert hooks on the edit page can drive it.
 */
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

import { QuizShortcode } from './quiz-shortcode.js';
import { preprocessMarkdown, shouldUseSourceMode } from './markdown-bridge.js';

const DEBOUNCE_MS = 200;

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildToolbar(quizzes) {
  const quizOptions = (quizzes || [])
    .map((q) => `<option value="${escapeHtml(q.slug)}">${escapeHtml(q.title || q.slug)}</option>`)
    .join('');

  return `
    <div class="be-toolbar" role="toolbar" aria-label="Class body formatting">
      <div class="be-tg" data-group="inline">
        <button type="button" class="be-btn" data-cmd="bold" title="Bold (Ctrl+B)" aria-label="Bold"><b>B</b></button>
        <button type="button" class="be-btn" data-cmd="italic" title="Italic (Ctrl+I)" aria-label="Italic"><i>I</i></button>
        <button type="button" class="be-btn" data-cmd="strike" title="Strikethrough" aria-label="Strikethrough"><s>S</s></button>
        <button type="button" class="be-btn" data-cmd="code" title="Inline code" aria-label="Inline code">&lt;/&gt;</button>
        <button type="button" class="be-btn" data-cmd="link" title="Link" aria-label="Link">🔗</button>
      </div>
      <div class="be-tg" data-group="block">
        <button type="button" class="be-btn" data-cmd="h2" title="Section heading" aria-label="H2">H2</button>
        <button type="button" class="be-btn" data-cmd="h3" title="Subsection heading" aria-label="H3">H3</button>
        <button type="button" class="be-btn" data-cmd="paragraph" title="Paragraph" aria-label="Paragraph">¶</button>
        <button type="button" class="be-btn" data-cmd="blockquote" title="Quote" aria-label="Blockquote">❝</button>
        <button type="button" class="be-btn" data-cmd="bulletList" title="Bulleted list" aria-label="Bulleted list">• ─</button>
        <button type="button" class="be-btn" data-cmd="orderedList" title="Numbered list" aria-label="Numbered list">1.</button>
        <button type="button" class="be-btn" data-cmd="taskList" title="Task list (interactive checkboxes)" aria-label="Task list">☐</button>
        <button type="button" class="be-btn" data-cmd="codeBlock" title="Code block" aria-label="Code block">{ }</button>
        <button type="button" class="be-btn" data-cmd="hr" title="Horizontal rule" aria-label="Horizontal rule">―</button>
      </div>
      <div class="be-tg" data-group="insert">
        <button type="button" class="be-btn be-insert-image" title="Insert image (uses Attachments)" aria-label="Insert image">🖼</button>
        ${quizOptions ? `
          <select class="be-quiz-select" aria-label="Insert quiz" title="Insert a quiz from this class">
            <option value="">+ Quiz…</option>
            ${quizOptions}
          </select>
        ` : ''}
      </div>
      <div class="be-tg be-spacer"></div>
      <div class="be-tg" data-group="mode">
        <button type="button" class="be-btn be-mode-toggle" title="Toggle Markdown source" aria-label="Source mode">Source</button>
      </div>
    </div>
  `;
}

function buildBanner(message) {
  return `<div class="be-banner" role="status">${escapeHtml(message)}</div>`;
}

function setMode(root, mode) {
  root.setAttribute('data-mode', mode);
  const toggle = root.querySelector('.be-mode-toggle');
  if (toggle) {
    toggle.textContent = mode === 'source' ? 'Visual' : 'Source';
    toggle.setAttribute('aria-pressed', mode === 'source' ? 'true' : 'false');
  }
}

export function mount(root) {
  if (!root || root.dataset.mounted === 'true') return;
  root.dataset.mounted = 'true';

  const textarea = root.querySelector('textarea.be-source');
  if (!textarea) return;

  let quizzes = [];
  try {
    quizzes = JSON.parse(root.getAttribute('data-quizzes') || '[]');
  } catch {
    quizzes = [];
  }

  const initialBody = textarea.value;
  const autoSource = shouldUseSourceMode(initialBody);

  // Render toolbar + canvas. Textarea is already in the DOM.
  const toolbarHtml = buildToolbar(quizzes);
  const canvas = document.createElement('div');
  canvas.className = 'be-canvas';

  const bannerHost = document.createElement('div');
  bannerHost.className = 'be-banner-host';
  if (autoSource) {
    bannerHost.innerHTML = buildBanner(
      'This class contains raw HTML or a table. Editing in source mode to avoid mangling. Click Visual to try the canvas anyway.',
    );
  }

  // Inject toolbar at the top of root, banner + canvas before the textarea.
  root.insertAdjacentHTML('afterbegin', toolbarHtml);
  textarea.before(bannerHost);
  textarea.before(canvas);

  setMode(root, autoSource ? 'source' : 'visual');

  // -------- TipTap setup --------
  const editor = new Editor({
    element: canvas,
    extensions: [
      StarterKit.configure({
        // Disable any HTML pass-through; we want predictable serialization.
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      QuizShortcode,
      Markdown.configure({
        html: true,           // allow inline HTML through (for <quiz-shortcode>)
        breaks: false,
        linkify: true,
        transformPastedText: true,
      }),
    ],
    content: preprocessMarkdown(initialBody),
    onUpdate: debounce(() => {
      // Sync editor → textarea on every change (debounced).
      textarea.value = editor.storage.markdown.getMarkdown();
    }, DEBOUNCE_MS),
  });

  // -------- Toolbar wiring --------
  function runCmd(cmd) {
    const c = editor.chain().focus();
    switch (cmd) {
      case 'bold':         c.toggleBold().run(); break;
      case 'italic':       c.toggleItalic().run(); break;
      case 'strike':       c.toggleStrike().run(); break;
      case 'code':         c.toggleCode().run(); break;
      case 'h2':           c.toggleHeading({ level: 2 }).run(); break;
      case 'h3':           c.toggleHeading({ level: 3 }).run(); break;
      case 'paragraph':    c.setParagraph().run(); break;
      case 'blockquote':   c.toggleBlockquote().run(); break;
      case 'bulletList':   c.toggleBulletList().run(); break;
      case 'orderedList':  c.toggleOrderedList().run(); break;
      case 'taskList':     c.toggleTaskList().run(); break;
      case 'codeBlock':    c.toggleCodeBlock().run(); break;
      case 'hr':           c.setHorizontalRule().run(); break;
      case 'link': {
        const url = window.prompt('URL:');
        if (url) c.extendMarkRange('link').setLink({ href: url }).run();
        else c.unsetLink().run();
        break;
      }
    }
  }

  root.querySelectorAll('.be-btn[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => runCmd(btn.dataset.cmd));
  });

  // Insert image button — tells the existing attachments panel to scroll
  // into view; if the user has an upload row already, they click "Insert"
  // there. The attachments panel's existing JS handler now dispatches via
  // window.bodyEditor.insertImage when in visual mode.
  const insertImg = root.querySelector('.be-insert-image');
  if (insertImg) {
    insertImg.addEventListener('click', () => {
      const section = document.querySelector('.attachments-section');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Quiz dropdown — insert a [[quiz: slug]] shortcode at the cursor.
  const quizSelect = root.querySelector('.be-quiz-select');
  if (quizSelect) {
    quizSelect.addEventListener('change', (e) => {
      const slug = e.target.value;
      if (!slug) return;
      editor.chain().focus().insertContent({
        type: 'quizShortcode',
        attrs: { slug },
      }).run();
      e.target.value = '';
    });
  }

  // Source-mode toggle.
  const modeToggle = root.querySelector('.be-mode-toggle');
  if (modeToggle) {
    modeToggle.addEventListener('click', () => {
      const current = root.getAttribute('data-mode');
      if (current === 'visual') {
        // visual → source: textarea already has serialized markdown.
        textarea.value = editor.storage.markdown.getMarkdown();
        setMode(root, 'source');
        textarea.focus();
      } else {
        // source → visual: re-parse the textarea content.
        const md = textarea.value;
        editor.commands.setContent(preprocessMarkdown(md));
        setMode(root, 'visual');
        editor.commands.focus();
      }
    });
  }

  // Source-mode textarea also needs to keep the form value live; since it
  // IS the form's name="body_md" field, no extra wiring needed.

  // -------- Public API for outside code --------
  window.bodyEditor = {
    insertImage(url, alt) {
      if (root.getAttribute('data-mode') === 'visual') {
        editor.chain().focus().insertContent({
          type: 'image',
          attrs: { src: url, alt: alt || '' },
        }).run();
      } else {
        // Source mode: insert at cursor in textarea.
        insertAtTextarea(textarea, `![${alt || ''}](${url})`);
      }
    },
    insertFileLink(url, label) {
      if (root.getAttribute('data-mode') === 'visual') {
        editor.chain().focus().insertContent(`[${label || url}](${url})`).run();
      } else {
        insertAtTextarea(textarea, `[${label || url}](${url})`);
      }
    },
    getMode() { return root.getAttribute('data-mode'); },
    focus() { editor.commands.focus(); },
  };

  // Make sure the textarea reflects current state on form submit, even if
  // a debounced update hasn't fired yet.
  const form = textarea.closest('form');
  if (form) {
    form.addEventListener('submit', () => {
      if (root.getAttribute('data-mode') === 'visual') {
        textarea.value = editor.storage.markdown.getMarkdown();
      }
    }, { capture: true });
  }
}

function insertAtTextarea(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const sep = before.length === 0 || before.endsWith('\n') ? '' : '\n\n';
  textarea.value = before + sep + text + '\n' + after;
  const cursor = (before + sep + text + '\n').length;
  textarea.focus();
  textarea.setSelectionRange(cursor, cursor);
}

// Auto-mount any .body-editor on the page.
function init() {
  document.querySelectorAll('.body-editor').forEach((el) => mount(el));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
