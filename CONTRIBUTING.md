# Contributing to Roomlet

Thanks for your interest in contributing! This guide covers how to report issues, propose changes, and get a pull request merged.

Roomlet is **source-available, not open source**. By contributing you agree to the terms in the *Contributions* section of [`LICENSE.md`](LICENSE.md), including that the maintainer may use and relicense your contribution.

## Ways to contribute

### Report a bug
Search existing issues first, then open a new one with:
- What happened vs. what you expected
- Steps to reproduce
- Screenshots if it's visual
- Browser/OS (and whether it's the live site or your local setup)

### Suggest a feature
Open an issue describing the problem and who it helps. An implementation idea is welcome but optional. **For anything larger than a small fix, please open an issue and wait for a thumbs-up before writing code**, so nobody's time is wasted.

### Report a security issue
**Don't open a public issue.** Email koregous@gmail.com with details and steps to reproduce.

## Pull requests

1. Fork the repo and create a branch from `main` (`feature/short-name` or `fix/short-name`).
2. Set up locally by following [`README.md`](README.md).
3. Make your change. Keep the PR focused: one concern per PR.
4. Before pushing, run:
   ```bash
   npx tsc --noEmit    # no type errors
   npm run build       # production build succeeds
   ```
   There is no automated test suite yet, so also click through what you changed and check the browser console for errors.
5. Open a PR that explains **what** changed and **why**. Add screenshots or a short clip for UI changes.

Our CI (`.github/workflows/ci.yml`) runs on every PR. Please make sure it's green.

### PR checklist
- [ ] Type-check and build pass locally
- [ ] Tested the change manually (and signed-out / signed-in if relevant)
- [ ] No secrets, `.env` files, or personal data committed
- [ ] Database change? Included a new migration and said so in the PR (see below)
- [ ] New markdown files aren't added (only `README`, `CONTRIBUTING`, `LICENSE`, and `DATABASE` are tracked)

## Code guidelines

- TypeScript throughout; avoid `any` unless there's a good reason.
- Match the style of the surrounding code. There's no Prettier/ESLint config committed yet, so consistency with nearby files is the rule.
- Put feature code in `src/features/<feature>/` and cross-feature code in `src/shared/`.
- Write clear, imperative commit messages (e.g. `Fix gallery blanking when nothing is recent`).

### Rules that protect users
- **Enforce permissions on the server and in the database.** Hiding a button is never access control. API routes must check the signed-in user, and tables must have RLS policies.
- **Respect moderation and NSFW rules** in any public query: only show sections that are `published` and `approved`, and honor NSFW filtering.
- **Never expose the service-role key** to the browser. Use the service-role client only in trusted server code, after verifying the user owns the resource.
- **Uploads go through the R2 helpers** in `src/shared/lib/`.

### Database changes
Schema changes are SQL migrations in `db/migrations/`. Add a new numbered, idempotent file (next number after the highest) and mention in your PR that it needs to be applied **before** the code is deployed. Never edit a migration that has already shipped. Full details are in [`DATABASE.md`](DATABASE.md).

## Questions?

Open an issue and we'll help you out.
