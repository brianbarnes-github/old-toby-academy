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

(Phase 9 was code-only — `/account` page — no schema change.)
