# Authoring Classes — Old Toby Academy

A practical guide for faculty (and the headmaster) on how to write course
content. Class bodies live in the `classes.body_md` column as Markdown and
are rendered server-side by `marked`.

You can author them two ways:

1. **Visual editor** (default) — toolbar-driven contenteditable canvas.
   Click `B` for bold, pick H2/H3 from the dropdown, click `☐` to start a
   task list, etc. You don't have to type any markdown characters. The
   editor still saves to the same `body_md` column as Markdown text.
2. **Source mode** — flip the `Source` toggle in the toolbar to drop
   into raw Markdown. Useful for inline SVG, `<details>` blocks,
   `<iframe>` embeds, complex tables, or anything the visual editor
   can't represent. The class auto-opens in source mode if the body
   already contains raw HTML or a GFM table.

This guide covers both flows and the Markdown features they support.

---

## Visual editor — quick reference

The toolbar groups buttons by type:

| Group | Buttons |
|---|---|
| **Inline** | Bold (`B`), Italic (`I`), Strikethrough (`S`), Inline code (`</>`), Link (`🔗`) |
| **Block** | H2, H3, Paragraph (`¶`), Blockquote (`❝`), Bullet list (`•─`), Numbered list (`1.`), Task list (`☐`), Code block (`{ }`), Horizontal rule (`―`) |
| **Insert** | Image (`🖼` — scrolls to the Attachments panel), Quiz (dropdown of this class's existing quizzes) |
| **Mode** | `Source` (toggle to raw markdown editing) |

Keyboard shortcuts: <kbd>Ctrl/Cmd+B</kbd> bold, <kbd>Ctrl/Cmd+I</kbd> italic.
Most other shortcuts work the same as a normal contenteditable area.

Quiz shortcodes appear as parchment-and-gold chips reading
`Quiz: <slug>`. To insert one, pick from the **Quiz** dropdown — it lists
the quizzes you've already created on the same class. To remove one,
click it and press Backspace.

## When to flip to Source mode

The visual editor handles paragraphs, headings, lists, blockquotes,
links, images, code blocks, task lists, and quiz shortcodes. It does
**not** handle:

- Raw HTML (inline SVG, `<details>` toggles, `<iframe>` embeds, custom
  `<div class="...">` callouts)
- GFM pipe tables (the visual editor doesn't have a table node in v1)

If a class already contains any of those, opening it auto-flips to
source mode and shows a banner explaining why. You can still toggle
back to visual mode — the editor will preserve your raw HTML as-is in
the underlying markdown — but the editor canvas won't show the embedded
HTML rendered.

For new classes that need raw HTML or tables, just toggle to Source,
write the markdown, save. You can keep going in either mode.

## TL;DR

1. `/courses` → `+ New course` (creates the container)
2. From the course page → `+ Add class`
3. Fill in **Slug**, **Title**, **Summary**, paste Markdown into **Body**, save
4. Class is created as a **draft** — verify it on the class page, then click
   `Publish` when it's ready
5. Repeat for each class. If the course is `sequential`, mark each class
   `Complete` to unlock the next one for students.

---

## Permissions

You need the `courses.author` permission. By default, **faculty** and
**headmaster** roles have it; **student** does not.

A faculty member can edit only their own courses. The headmaster can edit
any course.

---

## The two-step authoring flow

### 1. Create the course (the container)

Visit `/courses/new`. Fields:

| Field         | Notes                                                                 |
| ------------- | --------------------------------------------------------------------- |
| `Slug`        | URL-safe, lowercase, hyphens. Example: `midi-101`. Cannot be changed. |
| `Title`       | Free-form, e.g. *MIDI 101 — Reading and Writing*.                     |
| `Summary`     | One sentence for the catalogue card.                                  |
| `Description` | Markdown. Shown on the course landing page above the class list.      |
| `Order mode`  | `all` = students see every published class; `sequential` = faculty unlocks classes one at a time by marking each `Complete`. |

After saving, you land on `/courses/<slug>` — the course page is now your hub.

### 2. Add classes

From the course page, click `+ Add class`. Fields:

| Field         | Notes                                                                            |
| ------------- | -------------------------------------------------------------------------------- |
| `Slug`        | URL-safe, unique within this course. Example: `lesson-01-ports`.                 |
| `Title`       | The full lesson title.                                                           |
| `Summary`     | One sentence — shown on the course page next to this class.                      |
| `Order index` | Lower numbers come first. The form pre-fills the next available number.          |
| `Body`        | The Markdown for the class. This is the main thing you write.                    |

Save it as a draft. Students cannot see drafts. When you're happy, hit
`Publish` from the class edit page.

---

## Markdown supported

The renderer is `marked` with **GitHub-flavoured Markdown** turned on and
`breaks: false` (a single newline is a space, not a `<br>`). Standard
features below all work.

### Headings

```markdown
## Top-level section heading
### Sub-section
```

`#` (h1) is reserved for the class title at the page top — start your body
content at `##`.

### Paragraphs and emphasis

```markdown
A normal paragraph. *italic*, **bold**, ~~strikethrough~~, and `inline code`.

Soft line breaks inside a paragraph are joined into a space.

Blank lines separate paragraphs.
```

### Lists

```markdown
- Unordered item
- Another
  - Nested item

1. Ordered item
2. Another
```

### Links and images

```markdown
[Link text](https://example.com)

![Alt text](https://your-supabase-public-url/...)
```

Upload images and files from the **Attachments** panel on the class edit
page (see [Attachments](#attachments) below). The `Insert` button on each
attachment drops the right markdown reference at your cursor position in
the body. For one-off images that already live elsewhere on the web, paste
the URL directly.

Images render inline at full body width (max-width 100%). They scale on
mobile.

### Blockquotes

```markdown
> Practice slowly enough that you don't have to undo mistakes.
```

Renders with a gold left rule and italic text — useful for callouts and
quotes.

### Code blocks

````markdown
```abc
X:1
T:Hobbit Lullaby
M:3/4
L:1/4
K:G
| G2 B | A2 G | E2 D | G3 |
```
````

Three-backtick fences render as a dark code block with a gold left rule.
The language tag (`abc`, `bash`, `text`, etc.) is preserved as a class on
the `<code>` element but no syntax highlighter runs in v1 — pick whatever
language is most accurate; it's still readable.

Inline code uses single backticks: `` `like this` ``.

### Tables

```markdown
| Note | Beats | Symbol |
| ---- | ----- | ------ |
| Whole | 4    | 𝅝     |
| Half  | 2    | 𝅗𝅥    |
| Quarter | 1  | 𝅘𝅥    |
```

Tables get the academy table style: small caps headers, bottom-rule rows.

### Horizontal rule

```markdown
---
```

### Raw HTML

Authors are trusted, so raw HTML is **not sanitized** in v1. You can drop
in inline SVG, custom `<div class="...">` callouts, `<details>` toggles,
`<iframe>` embeds — anything. With great power, etc.

### Interactive task lists

Use GFM task list syntax to give students checkboxes they can tick off:

```markdown
- [ ] Practice the C major scale ascending
- [ ] Practice the C major scale descending
- [ ] Identify the leading tone in C major
```

Each unchecked item renders as a real, clickable checkbox. State is
persistent per student — the system writes to the `progress_marks` table
on every toggle, and the boxes are pre-filled from the same table on page
load. Checked items get strike-through and a muted ink colour.

**The position-key caveat:** each task is keyed by its position in the
class (`task-1`, `task-2`...). If you reorder or insert tasks after
students have started ticking them, completion state stays attached to
position numbers, not task text. For living content, prefer **adding**
new tasks at the bottom.

If you write `- [x] something` (already checked in markdown), the box
renders ticked but only as a default — once a student toggles it, the
saved state takes over.

---

## Attachments

Each class has its own **Attachments** panel on the edit page, below the
form. Two upload widgets:

- **Upload image** — pick an image file (PNG/JPG/GIF/SVG…), optionally
  add a caption (used as alt text), click `Upload image`. The image
  uploads to the `class-files` Supabase Storage bucket and shows up in
  the attachments grid below. Click `Insert` on the new row and the
  cursor in the body textarea picks up `![caption](public-url)`.
- **Upload file** — same flow for non-image files (PDF, MIDI, ABC, MP3,
  whatever). The `Insert` button drops `[file_name](public-url)` at the
  cursor.

A few useful behaviours:

- **10 MB cap** per file. Same limit as the Library.
- **Files that aren't referenced inline** appear automatically as a
  "Files" download list at the bottom of the rendered class page. So if
  you upload a backing-track MP3 and don't paste it into the body, it
  shows up as a download for students.
- **Delete** removes both the row and the storage object, but does not
  rewrite the body — if you'd previously inserted a markdown link, you'll
  see a broken image / dead link until you remove it from the body.
- **Permissions**: only the class author and the headmaster can upload or
  delete attachments for a class. Students can view (the bucket is
  public-read).

You can still hand-edit `public/assets/` and reference `/assets/<filename>`
for site-wide reusable assets (the way the Library does), but for class-
specific content prefer the attachments panel — it keeps each class's
files together and survives a course rename.

## Quizzes

A class can have one or more inline quizzes. Each quiz holds one or more
single-correct multiple-choice questions. Students see immediate feedback
(✓/✗ + your explanation) and can retry; the latest answer is persisted
to the `progress_marks` table.

### Authoring

The class edit page has a **Quizzes** section below Attachments.

1. Click `+ New quiz`. Fill in:
   - **Title** — shown above the questions on the rendered class page
   - **Slug** — URL-safe id used in the body shortcode (e.g. `relative-minors`)
   - **Intro** (optional, markdown) — a paragraph above the questions
   - **Order index** — controls quiz order if you have several
2. Click `Create quiz`. The new quiz appears in the list.
3. Click `+ Add question` on the quiz. Fill in:
   - **Prompt** (markdown) — the question text. Markdown works, so you
     can include code, bold, inline math, links to the Library, etc.
   - **Options** — 2 to 6 plain-text labels. Click the radio button next
     to the correct one. Empty option rows are ignored.
   - **Explanation** (optional, markdown) — shown after the student
     submits. Use this to teach: link to a Library chapter, explain
     *why* the right answer is right.
4. Save. Repeat for more questions.
5. **Mount the quiz in the body** by pasting:
   ```
   [[quiz: your-slug]]
   ```
   anywhere in the class body. The shortcode is replaced with the
   rendered quiz at view time.

A few notes:

- **One correct option per question.** The schema enforces this with a
  partial unique index — if you try to mark two correct, the save will
  fail.
- **Editing a question wholesale-replaces the options.** That's the
  simplest UX; the only price is that any student who'd already answered
  the question against an *old* option ID will see their answer ignored
  on next view. If you only want to fix a typo in an option label, edit
  it in place — leave the radio selection alone.
- **Don't put `[[quiz: ...]]` inside a code sample.** The shortcode
  replacement runs over the rendered HTML, so it'll match inside `<code>`
  too. If you must demo the syntax in a code block, escape one bracket
  or use a different placeholder.
- **The shortcode without a matching quiz** renders an inline warning
  badge, not an error — useful while you're authoring.

### Student experience

When a student visits a class with quizzes:

- Each question renders as a list of radio options + Submit button
- On submit, the picked option is marked ✓ or ✗, the correct option is
  highlighted, and the explanation reveals
- They can change their mind and submit again — the latest answer wins
- State persists across reloads, devices, and sessions (it lives in the
  database, not localStorage)

### Permissions

Authoring (create/edit/delete quizzes and questions) requires
`courses.author` on a class you own (or headmaster). Submitting answers
just requires being signed in. The `progress.read` permission lets the
headmaster query everyone's quiz responses for future grading dashboards.

## How it renders — style cheat sheet

The class body inherits these styles (defined in
`src/pages/courses/[courseSlug]/[classSlug]/index.astro`):

- **`##`** → italic, weighted, generous top margin
- **`###`** → smaller, weighted, forest-green
- **lists** → 24px indent, slight item gap
- **inline code** → gold-tinted background, monospace
- **fenced code** → dark ink background, parchment text, gold left rule
- **blockquote** → gold left rule, italic, muted ink
- **tables** → academy small-caps headers, bottom rules between rows
- **images** → fluid, no border (the image is itself the figure)

If you want a bordered/parchment frame around an image (like the Library
chapters), wrap it in HTML:

```html
<figure class="diagram-figure">
  <img src="/assets/circleoffifths.jpg" alt="Circle of fifths" />
  <figcaption>The circle of fifths.</figcaption>
</figure>
```

`.diagram-figure` styling lives in `src/styles/global.css` and is available
everywhere.

---

## A starter template

Use this as the body of your first class — replace the prose, keep the
structure.

```markdown
## What you'll learn

A one-paragraph orientation: what this class covers, why it matters, what
the student will be able to do by the end.

## Background

Two or three paragraphs of context. Link out to Library chapters where
relevant — for example, see [Foundations](/library/foundations) or
[Scales & Modes](/library/scales-and-modes).

> A pull-quote or important warning lives in a blockquote.

## Walkthrough

Numbered steps for any procedural content:

1. First do this.
2. Then this.
3. Confirm the result by …

Code examples in triple-backtick blocks:

​```abc
X:1
T:Example
K:C
| C D E F | G A B c |
​```

## Try it yourself

A short exercise the student can attempt. Keep it concrete — "play these
four bars and identify the cadence" beats "explore cadences."

## Recap

Bullet points of what was covered:

- Point one
- Point two
- Point three

## Further reading

- [Library: Intervals](/library/intervals)
- [Library: Triads & Chords](/library/chords)
```

---

## Drafts, publishing, and `sequential` courses

- **Drafts** are invisible to students. Only the author and the headmaster
  can see them. Use this freely — paste a half-written class, come back
  later.
- **Publish** from the class edit page. The class becomes visible to
  students immediately, modulo the course's `order_mode`.
- **Sequential courses** add a second gate: even after publishing, a class
  is locked for a student until faculty marks the *previous* class
  `Complete` from its page. This lets you pace a cohort.
- **Reopen** undoes a `Complete` — useful if you publish a follow-up and
  want students to revisit.

The audit log records `class_published`, `class_unpublished`,
`class_marked_complete`, and `class_reopened` for every change.

---

## Editing existing classes

From the class page, click `Edit class`. The form is the same as `New
class`; the body is pre-filled. Save updates immediately — students see
the new version on next page load. There's no version history yet, so if
you're rewriting heavily, copy the old `body_md` into a scratch file
before you save.

---

## Quick reminders

- **Slugs are forever.** They appear in the URL and link from anywhere
  you reference the class. Pick something stable.
- **Order index is sortable, not absolute.** Use gaps (0, 10, 20…) so
  inserting a class later is cheap.
- **Class-specific images and files** go through the Attachments panel on
  the edit page. Site-wide reusable images can still live in
  `public/assets/`.
- **Cross-link to the Library.** The six chapters at `/library/*` are the
  canonical music-theory reference; lean on them.
- **Append, don't reorder, tasks.** Checkbox state is keyed by position
  in the class. New tasks at the bottom don't disturb existing student
  progress.
- **Quiz slugs are stable; option text is editable.** Quiz answers are
  keyed by question UUID, so renaming a quiz title is fine. Editing an
  option's text is fine too (the option's UUID doesn't change). What
  *does* shift state: deleting a question, or re-saving a question with
  a different number of options.
- **Test as a student.** The author and headmaster see drafts and locked
  classes; create a throwaway student account (or have someone else log
  in) to confirm what learners actually see.
