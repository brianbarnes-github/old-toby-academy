# Old Toby Academy — Roadmap of Concerns

A working list of known gaps and risks, ordered by recommended priority. Tick items off as they ship; add new ones as they surface.

Legend: 🔴 high priority · 🟡 medium · 🟢 low / future

_Last updated: 2026-04-27, after Phase 21 (visual class body editor)._

---

## Recommended next round

In rough priority order — the items with the best (impact ÷ effort) ratio right now.

- [ ] **🔴 Headmaster grading dashboard at `/admin/progress`.** Phase 15's `progress_marks` table and `progress.read` permission have been waiting for a consumer since they shipped. Phases 19 and 20 added task-completion and quiz-response data to the table. A dashboard showing per-student per-class task completion + per-quiz scores closes the loop on the entire authoring → student → assessment pipeline. Reuses existing data; no new schema. The first phase that *consumes* what's been built rather than creating more.
- [ ] **🔴 "Preview as student" toggle for faculty / headmaster.** Privileged accounts always see the privileged view (drafts, locked classes, attachments panel, edit buttons). A one-click toggle in the masthead that flips into a "viewing as student" mode for the rest of the session would be invaluable when authoring. Lives in middleware: a session cookie that, when set, downgrades the role for permission checks. Audit-log the toggle so headmaster can't accidentally pretend forever.
- [ ] **🟡 Real alumni board.** `/alumni` still serves five seeded HTML posts. Replace with a Supabase-backed `alumni_posts` table mirroring the Library entries pattern: RLS, optional threading, tags (BAND / REQ / HELP / IDEA), members write, faculty + headmaster moderate.

---

## Security

- [ ] **🟢 2FA / TOTP for headmaster.** Currently a single password protects every privileged operation in the academy. Worth considering once member count grows. Supabase Auth supports MFA factors.

---

## Operations

- [ ] **🟡 Audit-log retention.** The `entries` table grows forever. No problem at current scale, but eventually wants a scheduled job: delete entries older than N days, or archive to a cold table. Trivial pgcron job once installed.
- [ ] **🟢 Error tracking / monitoring.** No Sentry, no Logtail, no uptime monitor. Production errors surface only when a user complains.
- [ ] **🟢 Backups.** Supabase has automatic daily backups on free tier, but they expire after 7 days. For a real community, set up an external snapshot job.
- [ ] **🟢 Node 18 → 20 upgrade.** Supabase JS client warns on every build. Vitest 4 also wants Node 20. Bump runtime in Netlify build settings + GitHub Actions matrix; verify nothing else breaks.

---

## UX gaps

- [ ] **🔴 "Preview as student" toggle.** See "Recommended next round."
- [ ] **🟡 Mobile + accessibility audit.** Visual design holds together on desktop. Admin tables almost certainly break on phones; the new TipTap toolbar has small touch targets; keyboard navigation, screen readers, colour contrast — none reviewed. Run Lighthouse + a manual screen-reader pass.
- [ ] **🟡 Visual editor: tables + raw HTML support.** Phase 21 ships v1 of the WYSIWYG class body editor. Tables and raw HTML (inline SVG, `<details>`, `<iframe>`) currently force source mode. Adding a Table extension and a `RawHtmlBlock` custom node would let authors stay in the visual canvas for those cases too. Defer until source mode is shown to be a real friction.
- [ ] **🟢 In-app notifications.** When a member is granted a role, they're told nothing. A simple "what's new since you last signed in" pill in the masthead.
- [ ] **🟢 Translations.** English-only. Worth thinking about once the community has international members.

---

## Data model

- [ ] **🟡 Faculty role has no privileges beyond `courses.author`.** Architecture supports more; the bundle is mostly empty. Pick 2–3 abilities (e.g. `students.message`, `library.curate`, `alumni.moderate`), add to the permissions catalog, bundle into the faculty role.
- [ ] **🟡 No "deactivate account" flow.** Removing a member is a SQL operation. Worth a soft-delete column + UI on `/admin/users/[id]`.
- [ ] **🟡 Time-bounded role grants.** "Conductor for the Spring term only" can't be expressed today. `user_roles` could grow `expires_at` and `role_revoked_at` columns + a daily expiry sweep (pgcron).
- [ ] **🟢 Role hierarchies / inheritance.** "Faculty implies Student access" — currently you have to bundle student perms into faculty too. A `role_extends` join table would clean this up.

---

## Content / community

- [ ] **🟡 Real alumni board.** See "Recommended next round."
- [ ] **🔴 Headmaster grading dashboard.** See "Recommended next round."
- [ ] **🟢 Concert / band tooling.** The home page promises a class band concert. Today nothing supports it — could be a `bands` table + member assignments + a setlist + a "concert mode" page.
- [ ] **🟢 Custom MIDI request queue.** Alumni page mentions custom-MIDI requests. Could become a real workflow: members request, faculty claim, deliver.

---

## Explicit non-goals

- **No static / pre-built courses.** All courses are instructor-authored via the dynamic system shipped in Phase 16. Engineering does not seed courses, scaffold lesson content, or write a "MIDI 101" course as a starter. Course content is faculty's domain.
- **No MDX / build-step content** for classes — markdown stays the wire and DB format. The Phase 21 visual editor is a UI layer over markdown, not a replacement for it.

---

## Recently shipped (for context)

A condensed history so this doc has a bit of memory of where we've been:

| Phase | Ships | Notes |
|---|---|---|
| 7A | Dynamic RBAC schema | `roles`, `permissions`, `role_permissions`, `user_roles`, `has_permission()` |
| 7B | RBAC admin UI | role grant/revoke, role CRUD, custom permission bundles |
| 8 | Headmaster-initiated password reset | `users.reset_password` permission, `/admin/users/[id]` Reset button |
| 9 | Member `/account` self-service | password change, re-answer step-2 questions |
| 10 | Avatars + bio | `avatars` storage bucket + RLS |
| 11 | CSRF + rate limiting | double-submit cookie, `rate_limits` table |
| 12 | Schema migrations table + signup honeypot | `schema_migrations`, `log_bot_block` |
| 13 | Vitest + GitHub Actions CI | unit tests for `lib/` |
| 14 | Tokens carry any role | `invite_tokens.role`, updated `redeem_token` |
| 15 | Server-side progress | `progress_marks` table, `progress.read` permission |
| 16 | Dynamic course system v1 | `courses`, `classes`, `courses.author` permission |
| 17 | The Library (file uploads) | `library_entries`, `library-files` bucket |
| 18 | Library music-theory chapters | six static chapter pages with SVG diagrams |
| 19 | Class attachments + interactive tasks | `class_attachments`, `class-files` bucket; GFM task lists become persistent checkboxes |
| 20 | In-class quizzes | `class_quizzes`, `class_quiz_questions`, `class_quiz_options`; `[[quiz: slug]]` shortcode |
| 21 | Visual class body editor | TipTap-based WYSIWYG with source-mode toggle, custom quiz shortcode node |

---

## How to use this list

- Pick an item, open a branch named like the existing pattern (`phase-NN-…` or `feature-…` / `fix-…`)
- Cross it off when the PR merges; move it to "Recently shipped" if it's a phase
- Add new items at the bottom of the relevant section as they surface
- Don't feel bound by the priority ordering — what hurts most this week is what hurts most this week
