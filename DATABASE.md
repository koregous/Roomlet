# Database (Supabase / Postgres)

Roomlet's database is managed by hand in the **Supabase SQL Editor**. The SQL for every change lives in `db/migrations/`.

> Last verified against production: 2026-11-17 (through migration `048`). Migrations `049`-`050` were added afterwards.

## Changing the schema

1. Add a new numbered file to `db/migrations/` (next number after the highest, e.g. `049_...sql`).
2. Make it **idempotent**: `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` before `CREATE POLICY`, wrapped in `BEGIN; ... COMMIT;`.
3. Enable RLS on any new table and add explicit policies. With RLS on and no policy, access is denied by default.
4. Run it in the Supabase SQL Editor **before** deploying code that depends on it, and mention it in the PR.
5. Never edit a migration that has already been applied. Add a new one instead.

## What's in the repo

Only the numbered migrations `db/migrations/037_*.sql` to `050_*.sql` are tracked. They are the current, applied history. Older migrations (`001`-`036`), pre-redesign setup scripts, verification queries, and the old `SCHEMA_CANONICAL*.sql` files are kept locally by the maintainer and are not part of the repo.

## ⚠️ There is no verified from-scratch setup yet

The old canonical schema did not match production (production `sections` has 21 columns and `profiles` had 34 before migration `049`), so it was dropped from the repo. The numbered migrations alone start from the post-redesign state and **cannot build an empty database on their own**.

Until a verified snapshot exists:

- **Contributors:** ask a maintainer for a Supabase dev project or a schema dump.
- **Maintainers:** generate a real snapshot and commit it as `db/schema.sql`:
  ```bash
  supabase db dump --schema public -f db/schema.sql
  ```
  Then this section can become "run `db/schema.sql`".

## Current schema (production)

All 11 tables in `public` have Row Level Security enabled.

| Table | Purpose |
| --- | --- |
| `profiles` | One per user (`user_id` = auth user). Display info, theme, music, NSFW flags, premium/Stripe fields, onboarding state, `is_admin`, and the premium background slideshow (`profile_background_slides`, up to 5; slide #1 is mirrored into `profile_background_url`/`_type`) |
| `sections` | A profile's sections. Content lives in the `blocks` JSONB column. Publishing and moderation: `published`, `approval_status`, `reviewed_*`, `rejection_reason` |
| `categories` | Gallery categories |
| `tags`, `section_tags` | Tagging |
| `bookmarks` | A user's bookmarked sections |
| `section_views` | View tracking |
| `reports` | Content reports |
| `reserved_usernames` | Usernames that can't be registered |
| `item_index` | One row per image in gallery/image/carousel blocks. Powers the feed and per-image likes |
| `item_likes` | One row per (image, user) like. Counts are denormalized into `item_index.like_count` by trigger |

### Things that will bite you

- **`item_index` is write-protected on purpose.** It has only a public `SELECT` policy (approved, published, visible sections). Supabase's default grants let `anon`/`authenticated` attempt writes, but RLS rejects them. It is written **only** by `syncItemIndex` (`src/shared/lib/feed-item-extraction.ts`) using the **service-role** client. Writing with any other client is silently denied.
- **`bookmarks` is private by RLS.** Users can read only their own rows (or another user's rows if that profile has `bookmarks_public`). Never count bookmarks across users with a plain `select`; use the aggregate RPCs `get_section_bookmark_count(uuid)` / `get_section_bookmark_counts(uuid[])`.
- **Premium fields are write-protected.** `profiles_update_own` lets users edit their own row, so migration `050` blocks `is_premium`, `stripe_*`, and `subscription_*` changes from normal user requests. Set them from the service role or the SQL Editor only. `storage_used_bytes` is *not* protected (the quota RPCs run as the user).
- **`item_likes`** policies only let users read, insert, and delete their own rows, and only like items they can see. Public counts come from `item_index.like_count`.
- **`sections.blocks` is the source of truth for images.** `item_index` is derived from it. If they drift, admins can re-sync with `POST /api/admin/reindex-items` (repeat with `next_offset` until it returns `null`).

## Functions

`get_section_bookmark_count(uuid)`, `get_section_bookmark_counts(uuid[])` (aggregate-only, `SECURITY DEFINER`), `is_admin(uuid)`, `is_bookmarks_public(uuid)`, plus triggers that maintain `tags.usage_count` and `item_index.like_count`.
