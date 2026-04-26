# Old Toby Academy — Roadmap of Concerns

A working list of known gaps and risks, ordered by recommended priority. Tick items off as they ship; add new ones as they surface.

Legend: 🔴 high priority · 🟡 medium · 🟢 low / future

---

## Recommended next round

In rough priority order — these are the ones with the best (impact ÷ effort) ratio right now.

- [ ] **🔴 Password reset for members.** Synthetic emails (`@academy.invalid`) mean Supabase can't send reset links. Add a "Reset password" button on `/admin/users/[id]` that lets the headmaster set a new password directly. Audit-log the event. Without this, every forgotten password is a manual SQL fix.
- [ ] **🔴 Member self-service `/account` page.** Lets a logged-in member change their own password and re-answer the step-2 experience questions. Pairs naturally with #1 — once headmaster has reset, the member can pick their own again.
- [ ] **🔴 Build out one placeholder course.** Pick one of the seven "Coming soon" courses (MIDI 101 is the natural next step) and ship real content. Moves the site from "tech demo" to "delivers the promise on the home page."

---

## Security

- [ ] **🔴 Password recovery flow.** See "Recommended next round" above. Without this, lockouts pile up.
- [ ] **🟡 Rate limiting on auth endpoints.** `/api/login` and `/api/redeem-token` accept unlimited attempts. Supabase has per-IP limits at the auth layer but the redeem-token path is custom. Add a simple table + middleware check, or rely on Netlify edge rate-limiting.
- [ ] **🟡 CSRF protection on mutating forms.** All admin forms POST as standard HTML form-encoded. SameSite cookies mitigate but don't fully prevent CSRF. Add hidden CSRF tokens to forms that change state (token revoke, role grant/revoke, role create/delete, profile updates).
- [ ] **🟡 Honeypot on `/signup`.** The legacy alumni form had one; the token redemption form does not. Bot-fillers across the open web could try to redeem tokens.
- [ ] **🟢 2FA / TOTP for headmaster.** Currently a single password protects every privileged operation in the academy. Worth considering once member count grows.

---

## Operations

- [ ] **🟡 Audit-log retention.** The `entries` table grows forever. No problem at current scale, but eventually wants a scheduled job: delete entries older than N days, or archive to a cold table. Trivial pgcron job once installed.
- [ ] **🟡 Automated tests.** Every phase has been verified by hand. A small Playwright (or vitest+supertest) suite covering: token redemption, rules acceptance, profile completion, role grant/revoke, /admin gating. Would catch most regressions before they reach the deploy preview.
- [ ] **🟡 Tracked schema migrations.** Each `phaseN.sql` file is run by hand from the SQL editor. No record of what's been applied, no rollback. Add a `schema_migrations` table + a small CLI or a Supabase CLI workflow to track + apply migrations.
- [ ] **🟢 Error tracking / monitoring.** No Sentry, no Logtail, no uptime monitor. Production errors surface only when a user complains.
- [ ] **🟢 Backups.** Supabase has automatic daily backups on free tier, but they expire after 7 days. For a real community, set up an external snapshot job.

---

## UX gaps

- [ ] **🔴 Member self-service `/account` page.** See "Recommended next round."
- [ ] **🟡 Course progress server-side.** ABC 101's exercise checkboxes are localStorage. Switch devices, lose progress. Move to a `course_progress` table so it follows the user and the headmaster can see who's where. Becomes more important as more courses ship.
- [ ] **🟡 Mobile + accessibility audit.** Visual design holds together on desktop. Admin tables almost certainly break on phones; keyboard navigation, screen readers, color contrast — none reviewed. Run Lighthouse + a manual screen-reader pass.
- [ ] **🟡 Faculty / headmaster cannot see "what would a student see" preview.** Privileged accounts only ever see the privileged view. A "preview as student" toggle would help when authoring content.
- [ ] **🟢 In-app notifications.** When a member is granted a role, they're told nothing. A simple "what's new since you last signed in" pill in the masthead.
- [ ] **🟢 Translations.** English-only. Worth thinking about once the community has international members.

---

## Data model

- [ ] **🟡 Faculty role has no privileges.** Architecture supports it; the bundle is empty. Decide what faculty can do (`courses.author`? `exercises.grade`? `alumni.moderate`?), add the abilities to the catalog, give them the slugs.
- [ ] **🟡 Tokens can only carry `student` or `faculty`.** Custom roles (e.g. `concert-conductor`) must be granted manually after redemption. Extend the token's role column to allow any role slug, and add a UI to pick it on `/admin/tokens`.
- [ ] **🟡 No "deactivate account" flow.** Removing a member is a SQL operation. Worth a soft-delete column + UI.
- [ ] **🟡 Time-bounded role grants.** "Conductor for the Spring term only" can't be expressed today. `user_roles` could grow `expires_at` and `role_revoked_at` columns + a daily expiry sweep.
- [ ] **🟢 Role hierarchies / inheritance.** "Faculty implies Student access" — currently you have to give faculty all the permissions student would need. Hierarchies would clean this up.

---

## Content / business

- [ ] **🔴 Build out one placeholder course.** See "Recommended next round."
- [ ] **🟡 Real alumni board.** Replace the five seeded HTML posts with a Supabase-backed `alumni_posts` table. RLS for who can post. Tags (BAND/REQ/HELP/IDEA), optional threading. Members write, faculty + headmaster moderate.
- [ ] **🟡 Course progress dashboard for the headmaster.** Once course progress is server-side, build a `/admin/progress` page that shows who's where in each course.
- [ ] **🟢 Concert / band tooling.** The home page promises a class band concert. Today nothing supports it — could be a `bands` table + member assignments + a setlist + a "concert mode" page.
- [ ] **🟢 Custom MIDI request queue.** Alumni page mentions custom-MIDI requests. Could become a real workflow: members request, faculty claim, deliver.

---

## How to use this list

- Pick an item, open a branch named like the existing pattern (`feature-...`, `fix-...`)
- Cross it off here when the PR merges
- Add new items at the bottom of the relevant section as you spot them
- Don't feel bound by the priority ordering — what hurts most this week is what hurts most this week
