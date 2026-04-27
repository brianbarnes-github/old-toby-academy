# Old Toby Academy — Database migrations

This folder holds every SQL change to the Supabase project. Run each new file once, in order, in **Supabase Dashboard → SQL Editor**.

## What's been applied?

After Phase 12 there's a `schema_migrations` table tracking it. As headmaster:

```sql
select filename, applied_at from public.schema_migrations order by applied_at;
```

You should see every file in this folder. If a file is on disk but not in the table, you haven't applied it yet.

## Convention for new migrations

1. Write the change as `phase{N}.sql`. Increment `N` from the last one. Always **additive + idempotent** (use `if not exists`, `on conflict do nothing`, drop-then-create for views).
2. End the file with:
   ```sql
   insert into public.schema_migrations (filename) values ('phase{N}.sql')
   on conflict (filename) do nothing;
   ```
3. Open a PR. Run the file in the SQL editor as part of the PR's deploy verification.
4. Merge the PR.

The marker INSERT records that the migration ran, so you (or future-you) can run the catch-up query above and see what's missing.

## What's in each file

| File | Phase | Adds |
|---|---|---|
| `schema.sql` | 2 | `profiles`, `invite_tokens`, RLS, `redeem_token`, `is_headmaster`, signup trigger |
| `phase3.sql` | 3 | character-name uniqueness, `is_token_valid`, `generate_invite_token`, `invite_tokens_admin` view |
| `phase4.sql` | 4 | `entries` audit log, onboarding columns on `profiles`, token notes, `redeem_token` v2 |
| `phase5.sql` | 5 | token revocation columns, `revoke_invite_token`, view update |
| `phase6.sql` | 6 | experience-profile columns + CHECKs |
| `phase7.sql` | 7A | dynamic RBAC: `roles`, `permissions`, `role_permissions`, `user_roles`, seeds, `has_permission`, sync trigger |
| `phase7b.sql` | 7B | admin RBAC fns: `admin_grant_role`, `admin_revoke_role`, `admin_create_role`, `admin_delete_role`, `admin_update_role_permissions`; `roles_admin` and `users_admin` views |
| `phase7b-fix.sql` | 7B | `current_user_permissions` fn + `my_permissions` view (hot-fix) |
| `phase8.sql` | 8 | `users.reset_password` permission |
| `phase10.sql` | 10 | `avatar_url`, `bio`; `avatars` storage bucket + policies |
| `phase11.sql` | 11 | `rate_limits` + `record_rate_limit`, `purge_old_rate_limits` |
| `phase12.sql` | 12 | `schema_migrations` (tracking) + `log_bot_block` (honeypot helper) |
| `phase14.sql` | 14 | tokens carry any role: `invite_tokens.role`, updated `redeem_token` |
| `phase15.sql` | 15 | `progress_marks` table + `progress.read` permission |
| `phase16.sql` | 16 | dynamic course system: `courses`, `classes`, `courses.author` permission, RLS |
| `phase17.sql` | 17 | `library_entries`, `library-files` storage bucket, `library.contribute` permission |
| `phase19.sql` | 19 | `class_attachments`, `class-files` storage bucket (mirrors phase17 pattern) |
| `phase20.sql` | 20 | `class_quizzes`, `class_quiz_questions`, `class_quiz_options` + RLS; in-class single-correct multiple-choice quizzes |

(Phase 9 was code-only — `/account` page — no schema change. Phase 13 added vitest + CI, no schema. Phase 18 was code-only — Library music-theory chapters as static Astro pages.)
