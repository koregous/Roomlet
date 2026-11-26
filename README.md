# Roomlet

A customizable personal profile and collection-sharing platform. Users build profiles out of **sections** (made of blocks: text, images, galleries, carousels, quotes, audio, embeds), publish them to a public **gallery**, and follow other creators' collections through **bookmarks** and a personalized **feed**.

**Stack:** Next.js 14 (App Router) · TypeScript · Supabase (Postgres, Auth, RLS) · Tailwind CSS · Cloudflare R2 (uploads) · Vercel

## Getting started

**You'll need:** Node.js 18.17+, a [Supabase](https://supabase.com) project, and a [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket.

```bash
git clone https://github.com/koregous/Roomlet.git
cd Roomlet
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-side only, never expose to the browser.** Needed for writes that bypass RLS (e.g. the feed's `item_index` sync) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | Cloudflare R2 credentials for image/audio uploads |
| `NEXT_PUBLIC_R2_DOMAIN` | Optional. Public domain for the R2 bucket |
| `NEXT_PUBLIC_SITE_URL` | Optional. Used for metadata/OG images; leave empty locally |

### Database

The schema is managed by hand in the Supabase SQL Editor. See [`DATABASE.md`](DATABASE.md) for how to change it, what each table is for, and the RLS gotchas. In short: add a new numbered, idempotent file under `db/migrations/`, and apply it **before** deploying code that depends on it.

> There is no verified from-scratch schema yet, so a fresh database can't be built from the repo alone. Ask a maintainer for a dev project or schema dump (details in `DATABASE.md`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npx tsc --noEmit` | Type-check |

There is no automated test suite yet, so please test your change locally before opening a PR.

## Project structure

```
src/
├── app/            # Routes. Route groups: (public) (auth) (dashboard) (protected) (admin); API handlers in api/
├── features/       # Feature code: gallery/, profile/, sections/ (block editor + block renderers)
└── shared/         # Cross-feature components, hooks, stores, contexts, and lib/ (Supabase clients, validation, storage)
db/migrations/      # Numbered SQL migrations (see DATABASE.md)
```

## Things worth knowing before you change code

- **Ownership is enforced by RLS**, not just UI. Hiding a button is never access control; the API route and the database policy must also enforce it.
- **Public profile pages are ISR-cached** (`revalidate`), so they can't know who is viewing. Owner-only UI is resolved client-side after load. After a save, call `POST /api/revalidate` to refresh the cached profile.
- **`item_index`** holds one row per image from gallery/image/carousel blocks and powers the feed and per-image likes. It's synced from section blocks by `syncItemIndex` (`src/shared/lib/feed-item-extraction.ts`), which matches images by block + URL so IDs stay stable across reorders. Don't change that matching without considering likes.
- **Moderation:** published sections go through an admin approval queue, and sections/profiles can be flagged NSFW (gated behind an age confirmation). New public queries should respect `published`, `approval_status`, and NSFW filtering.
- **Uploads use Cloudflare R2.** Some Cloudinary code remains for cleaning up older assets; new upload code should use the R2 helpers in `src/shared/lib/`.
- **Supabase clients:** use the cookie-aware server client for authenticated routes, the browser client in components, and the service-role client only in trusted server code after verifying the user owns the resource.

## Contributing

Contributions are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) first. In short: fork, branch, keep the PR focused, run `npx tsc --noEmit` and `npm run build`, and mention any migration that must be applied.

For bugs and feature ideas, open an issue. For **security vulnerabilities, please don't open a public issue**; email koregous@gmail.com.

## License

Roomlet is **source-available, not open source**. You can read the code, learn from it, run it locally for personal non-commercial use, and send pull requests. You can't use it commercially or deploy your own public instance. See [`LICENSE.md`](LICENSE.md).
