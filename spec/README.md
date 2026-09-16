# Project spec (agent memory)

This folder is **historical context for agents**, not user-facing documentation. Load it to learn what this repo is, how it grew, which milestones actually landed, and which failures became standing rules. Do not treat these files as a product spec to implement, a style guide, or onboarding for human developers.

Operational hazards (production DB, Vercel cache, PII, seed gates) live in [`CLAUDE.md`](../CLAUDE.md). Mission lives in [`soul.md`](../soul.md). Implementation specs that already exist stay in [`specs/`](../specs/) — this folder does not duplicate them.

| File | What it is |
|------|------------|
| [timeline.md](timeline.md) | Chronological milestones (Dec 2025–Sep 2026) with dates and SHAs/PRs. Inflection points called out. |
| [product.md](product.md) | What the site is at HEAD: public surfaces, staff CMS, games, apply, legal. How that map grew. |
| [architecture.md](architecture.md) | How data, auth, cache, and frontend evolved. Why the current shape exists. |
| [incidents.md](incidents.md) | Cautionary history: failure → result → fix. Tied to `CLAUDE.md` standing rules. |
| [open-threads.md](open-threads.md) | Unfinished business as of `926b978`. Do not assume these are done. |

Companion docs (read those, don’t copy them here):

- [`docs/QUICKSTART.md`](../docs/QUICKSTART.md) — local run / bootstrap (`db:migrate`, `db:seed-owner`). Partially stale on routing and data sources; trust this folder + `schema.ts` over its “Key Concepts” section.
- [`docs/dev/SUPABASE.md`](../docs/dev/SUPABASE.md) — env vars and client vs service-role usage.
- [`docs/dev/COMMIT_STYLE.md`](../docs/dev/COMMIT_STYLE.md) — conventional commits.
- [`specs/leadership-architecture.md`](../specs/leadership-architecture.md) — people + terms design (shipped `f14c7f4`; header still says “Ready for Implementation”). Its `getCachedLeadership()` fallback note is not how `queries.ts` works at HEAD.
- [`specs/db-backup-automation.md`](../specs/db-backup-automation.md) — scoped local backups (shipped `b638369` / PR #90); off-site work deferred to issue #89.
- [`db/RESTORE.md`](../db/RESTORE.md) — local restore procedure.

HEAD for this write-up: `926b978` (2026-09-12), branch `docs/project-spec` based on `origin/main`.
