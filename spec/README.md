# Project spec (agent memory)

This folder is **authoritative living memory for agents**, not user-facing documentation. Load it to learn what this repo is, how it grew, which milestones actually landed, and which failures became standing rules. Do not treat these files as a product spec to implement, a style guide, or onboarding for human developers.

## Golden Rules for Agents

1. **`spec/` is the 1ST point of reference.** Whenever an agent begins work (scoping, designing, debugging, or planning), read `spec/` first. It contains verified chronological context, architectural decisions, and active capabilities.
2. **Git history is strictly a targeted fallback.** Consult `spec/` for verified context, architectural rationale, and historical milestones. Consult Git history only when researching a specific, documented gap in `spec/`.
3. **Structured incremental specs (`spec-00x`):** From this point on, all new feature additions, layout redesigns, and architectural changes must follow the structured incremental ID format (`spec-00x-<slug>.md`). Record every new spec in the [Specification Index](#specification-index--concise-history) table below, and link to it from `spec/timeline.md` and relevant topical spec files (`product.md`, `architecture.md`, `incidents.md`, `open-threads.md`).

Operational hazards (production DB, Vercel cache, PII, seed gates) live in [`CLAUDE.md`](../CLAUDE.md). Mission lives in [`soul.md`](../soul.md). Implementation specs that already exist stay in [`specs/`](../specs/) — this folder does not duplicate them.

## Repository Memory Files

| File | What it is |
|------|------------|
| [timeline.md](timeline.md) | Chronological milestones (Dec 2025–Sep 2026) with dates and SHAs/PRs. Inflection points called out. |
| [product.md](product.md) | What the site is at HEAD: public surfaces, staff CMS, games, apply, legal. How that map grew. |
| [architecture.md](architecture.md) | How data, auth, cache, and frontend evolved. Why the current shape exists. |
| [incidents.md](incidents.md) | Cautionary history: failure → result → fix. Tied to `CLAUDE.md` standing rules. |
| [open-threads.md](open-threads.md) | Unfinished business as of `926b978`. Do not assume these are done. |

## Incremental Specifications (`spec-00x`)

From September 2026 onwards, all new technical and feature specifications are tracked with incremental, zero-padded IDs (`spec-001`, `spec-002`, etc.) in files named `spec/spec-00x-<slug>.md`.

### Spec Structure Requirements
Every `spec-00x` document must follow this structure:
- **Header:** Spec ID, Title, Status (Proposed / In Progress / Shipped), PR/Commit, Date, and Scope.
- **Context & Motivation:** Underlying requirements, user needs, and architectural context.
- **Design Decisions:** Concrete layout, data flow, component hierarchy, or schema choices.
- **Invariants & Boundaries:** Permanent system rules, edge-case constraints, and non-goals.
- **Verification:** Concrete verification commands and visual inspection steps.

### Specification Index & Concise History

| ID | Title | PR / Commit | Date | Status | Summary |
|---|---|---|---|---|---|
| [`spec-001`](spec-001-admin-sidebar-pinning.md) | Admin Sidebar Viewport Pinning | PR #187 (`875bf56`) | 2026-09-23 | Shipped | Pinned staff sidebar to viewport height (`sticky top-0 h-dvh`) with static nav and persistent footer links. |
| [`spec-002`](spec-002-database-safety-gates.md) | Database Safety Gates & Seed Retirement | PR #180 (`7b564e7`) | 2026-09-24 | Shipped | Gated all DB mutation scripts against remote targets, retired destructive UUID-churning seed.ts, and blocked SharePoint PII CSV leaks. |
| [`spec-003`](spec-003-staff-role-lock-and-hierarchy.md) | Staff Role Lock-Then-Re-Read Concurrency Protection | PR #181 (`e648508`) | 2026-09-24 | Shipped | Acquired advisory lock and re-read live actor permissions and target hierarchy under tx to prevent TOCTOU privilege escalation. |
| [`spec-004`](spec-004-eastern-time-schedule-normalization.md) | Eastern Time Schedule Normalization & Status Mapping | PR #184 | 2026-09-25 | Shipped | Canonicalized league competition to America/New_York via parseEastern, anchored calendar grid timezone, and normalized forfeit/tie status. |

---

Companion docs (read those, don’t copy them here):

- [`docs/QUICKSTART.md`](../docs/QUICKSTART.md) — local run / bootstrap (`db:migrate`, `db:seed-owner`). Partially stale on routing and data sources; trust this folder + `schema.ts` over its “Key Concepts” section.
- [`docs/dev/SUPABASE.md`](../docs/dev/SUPABASE.md) — env vars and client vs service-role usage.
- [`docs/dev/COMMIT_STYLE.md`](../docs/dev/COMMIT_STYLE.md) — conventional commits.
- [`specs/leadership-architecture.md`](../specs/leadership-architecture.md) — people + terms design (shipped `f14c7f4`; header still says “Ready for Implementation”). Its `getCachedLeadership()` fallback note is not how `queries.ts` works at HEAD.
- [`specs/db-backup-automation.md`](../specs/db-backup-automation.md) — scoped local backups (shipped `b638369` / PR #90); off-site work deferred to issue #89.
- [`db/RESTORE.md`](../db/RESTORE.md) — local restore procedure.

HEAD for this write-up: `926b978` (2026-09-12), branch `docs/project-spec` based on `origin/main`.
