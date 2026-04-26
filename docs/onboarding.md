# Student Onboarding Flow

End-to-end description of how a new member joins the Old Toby Academy, as it works today.

## 1. Headmaster mints a token

**Where:** `/admin/tokens` (headmaster-only — middleware-gated).

**Inputs (form):**
- **Role** — `student` or `faculty`
- **Expires after (days)** — number; `0` = never expires
- **Recipient note** *(optional)* — free-text, e.g. "Pippin from Discord"

**On submit:** the form posts to `/api/generate-token`, which calls the `generate_invite_token(p_role, p_expires_days, p_notes)` SECURITY DEFINER SQL function. Returns a 32-character hex token derived from `gen_random_uuid()`. A row is inserted into `invite_tokens` with `status = active`.

**The headmaster sees:**
- A gold banner with the raw token + a one-click signup URL of the form `https://<site>/signup?token=<token>`
- The new row appearing in the tokens table with status, expiry, recipient note, and creation date

## 2. Token shared out-of-band

The headmaster copies the link and sends it through whatever channel they use — Discord DM, in-game mail, parchment scroll. There is no in-app delivery; that decision was deliberate (keeps the system simple and avoids storing contact info).

## 3. Recipient redeems at `/signup`

**Form fields:**
- **Invite token** — prefilled from `?token=…` query param
- **Character name** — required, must be unique (case-insensitive)
- **Password** — required, ≥6 characters
- **Server** — optional

**Note:** there is no email field and no email confirmation step. The academy never collects or shows real email addresses for members.

**On submit (`/api/redeem-token`):**
1. `is_token_valid()` — token exists, not used, not expired
2. `is_character_name_available()` — name not taken (case-insensitive)
3. `supabase.auth.signUp({ email: <synthetic>, password })` — synthetic email of `<slug>@academy.invalid` (RFC 6761 reserved TLD; bounces harmlessly if anything ever tries to deliver to it)
4. `redeem_token(p_token, p_character, p_server)` — atomically marks token used and updates the new user's `profiles` row with role + character_name + server. Inside the same SQL function, a row is inserted into `entries` with `event_type = 'token_redeemed'` and details `{token, role, character_name, server}`.
5. Redirect to `/welcome`.

**Failure modes** (each surfaces as an error message on the signup page):
- Token invalid / expired
- Character name already taken
- Password too short
- Auth signUp error from Supabase

## 4. Three-step welcome wizard at `/welcome`

The page reads `Astro.locals.profile` and decides which step to render based on which timestamps are set.

### Step 1 — Rules of Conduct *(hard gate)*

Five rules listed:
1. Stay on topic
2. Constructive criticism
3. Respectful communication
4. Appropriate language
5. Engage positively

Member must tick the "I have read the Rules of Conduct and agree to abide by them" checkbox and click **I agree — proceed**.

**On submit (`/api/accept-rules`):**
- `profiles.rules_accepted_at = now()`
- Audit row `rules_accepted`
- Redirect to `/welcome?step=2`

This step is **enforced by middleware**: until `rules_accepted_at` is set, any logged-in user hitting any non-onboarding route is redirected back to `/welcome`. They can sign out from anywhere, but cannot browse the curriculum.

### Step 2 — Profile *(soft, skippable)*

Optional fields:
- **Favoured instrument** — text, e.g. "Lute of Ages"
- **Why are you joining?** — textarea
- **Your experience so far** — textarea

Two buttons: **Save & continue** (posts the form) or **Skip for now** (link to `?step=3`).

**On submit (`/api/complete-profile`):**
- Updates whichever of `instrument` / `why_joining` / `experience` are present and non-empty
- Audit row `profile_updated` with `details.fields_changed = [...]` (only fires if something was saved)
- Redirect to `/welcome?step=3`

### Step 3 — Welcome splash

Parchment-styled greeting: *"Welcome to the Hall, {character_name}."* with a single **Begin Reading →** button.

**On submit (`/api/finish-onboarding`):**
- `profiles.onboarding_completed_at = now()`
- Audit row `onboarding_completed`
- Redirect to `/courses`

## 5. Middleware enforcement (post-onboarding)

After step 1 completes (`rules_accepted_at` set), the wizard is no longer forced — the member can roam the curriculum, faculty page, alumni hall freely. Revisiting `/welcome` shows whichever step is next based on profile state, but is never re-forced. Headmaster paths (`/admin/*`) require `role = 'headmaster'` and return 403 to non-headmasters.

## 6. Audit log at `/admin/log`

Headmaster-only browser of the `entries` table. Shows the four event types as they fire during the flow above, plus filtering chips:

| Event type | Fires when | Details payload |
|---|---|---|
| `token_redeemed` | end of `redeem_token()` SQL fn | `{token, role, character_name, server}` |
| `rules_accepted` | POST `/api/accept-rules` succeeds | `{}` |
| `profile_updated` | POST `/api/complete-profile` saves any field | `{fields_changed: [...]}` |
| `onboarding_completed` | POST `/api/finish-onboarding` succeeds | `{}` |

Each row shows: timestamp, member name (color-coded by role), event type, details. Filterable by event type via query param.

## Existing accounts

The Phase 4 migration backfilled `rules_accepted_at` and `onboarding_completed_at` to `now()` for every profile that already existed. The headmaster (and any pre-Phase-4 test accounts) skip the wizard entirely on next sign-in.

## Files involved

- `supabase/phase4.sql` — schema migration (profiles columns, entries table, RLS, function updates)
- `src/middleware.ts` — onboarding gate
- `src/pages/welcome.astro` — three-step wizard
- `src/pages/api/accept-rules.ts`
- `src/pages/api/complete-profile.ts`
- `src/pages/api/finish-onboarding.ts`
- `src/pages/api/redeem-token.ts` — redirect target changed to `/welcome`
- `src/pages/admin/tokens.astro` — recipient note field
- `src/pages/admin/log.astro` — audit log viewer
