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
| [open-threads.md](open-threads.md) | Unfinished business as of `11ed110`. Do not assume these are done. |

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
| [`spec-004`](spec-004-eastern-time-schedule-normalization.md) | Eastern Time Schedule Normalization & Status Mapping | PR #184 (`4264863`) | 2026-09-25 | Shipped | Canonicalized league competition to America/New_York via parseEastern, anchored calendar grid timezone, and normalized forfeit/tie status. |
| [`spec-005`](spec-005-scoped-storage-keys-and-cleanup.md) | Scoped Storage Keys & Server-Derived Asset Cleanup | PR #182 (`2ef602f`) | 2026-09-25 | Shipped | Enforced section permissions, path traversal sanitization, deterministic key scoping `${section}/${entityId}/`, and automated abandoned storage cleanup. |
| [`spec-006`](spec-006-gallery-reorder-derived-state.md) | Gallery Reorder Derived State & Full-List Advisory Locking | PR #183 | 2026-09-25 | Shipped | Derived display order from uncommitted draft IDs and server props, enforced advisory lock and full active-ID set validation. |
| [`spec-007`](spec-007-staff-application-resume.md) | Staff Application Resume Upload, Volunteer Acknowledgement, and Recruiting Intro | PR #190 | 2026-09-26 | Shipped | Required PDF resume in the private `staff-resumes` bucket (magic-byte checked, 4 MB cap, admin-only 60 s signed URL), optional LinkedIn (linkedin.com only) and "Other links", unpaid-volunteer acknowledgement, Game Regulations Division with an open-answer director follow-up (`details` v4), Privacy Policy coverage, recruiting intro with mission statement. Migration `0036` and bucket are live. |
| [`spec-008`](spec-008-safe-ingestion-pipeline.md) | Safe Ingestion Pipeline with Pre-Mutation Diff Planning & Non-Destructive Merge | PR #193 | 2026-09-28 | Shipped | Implemented `--dry-run` inspection and diff summary tables, protected player bios via non-destructive coalesce, and introduced canonical `db:ingest:*` and `db:backfill:leadership` aliases. |
| [`spec-009`](spec-009-staff-application-referral.md) | Staff Application: Productions Crew Label and Referred-by Field | PR #208 | 2026-09-30 | Shipped | Productions Crew relabelled; optional "Referred by" name (50 chars) at the bottom of Role & Resume, stored in `details` v4. No migration. |
| [`spec-010`](spec-010-decoupled-tournament-brackets.md) | Decoupled Tournament Competition Model & Forward-Facing Brackets | PR #211 | 2026-10-01 | Shipped | Decoupled team vs tournament models, introduced /[game]/bracket canonical routes, interactive stage & bracket tree, and player IGN node visualization. |
| [`spec-011`](spec-011-player-onboarding-and-manager-portal.md) | Player Onboarding, School Manager Portal, and Hexagonal Tournament Verification | PR #216 | 2026-10-02 | Shipped | Staff-provisioned school managers, single-use per-player invite links, 4-step player onboarding wizard, honor-system Discord username (Discord OAuth/guild check designed but not built, #249), hexagonal GameIdentityPort with only the manual Riot ID adapter (RSO designed but not built, #247), demographic PII vault gated by VIEW_STUDENT_DEMOGRAPHICS, real-time tournament eligibility gates (min 6 players; the in-server check reads a self-reported flag). |
| [`spec-012`](spec-012-admin-control-panel-nav.md) | Admin Control Panel Navigation | PR #218 | 2026-10-05 | Shipped | Grouped the flat 13-link staff sidebar into three collapsible RAC Disclosure categories (People & Staffing, League Operations, Website Content) from one shared `app/lib/admin-nav.ts`, added a Category › Page breadcrumb, and turned the Overview into a Control-Panel-style hub with permission-gated section links. |
| [`spec-013`](spec-013-staff-portal-ui-overhaul.md) | Staff Portal UI Overhaul | PR #218 | 2026-10-05 | Shipped | Presentation-only restyle of every `/admin` page: shared admin tokens and primitives (`styles.ts`, `AdminUI.tsx`, `AdminTabs.tsx`), one page anatomy (eyebrow, `h1`, accent rule, right-aligned primary action, sections), calmer borderless surfaces, consistent empty/loading/notice/error states, purposeful `admin-*` motion with reduced-motion opt-out, and rules for brand-pink accents. |
| [`spec-014`](spec-014-gallery-thumbnails.md) | Gallery Thumbnails and Unoptimized Image Delivery | PR #220 | 2026-10-14 | Shipped | Stored a server-generated WebP thumbnail (sharp, 640px) beside each gallery photo; marquee, grid and admin cards load it `unoptimized` straight from Supabase, and the lightbox loads the full file the same way, so no gallery image uses Vercel image transformation. Hardened `/api/upload` (format allowlist, pixel limit). Migration `0046` is applied; the backfill script (own-folder, legacy root-key and static rows) is written and dry-run only so far. |
| [`spec-015`](spec-015-manager-portal-guided-tour.md) | School Manager Portal Guided Tour | PR #227 (issue #225) | 2026-10-14 | Shipped | One long anchored tour auto-started on a school manager's first portal visit, split into named sections so a Tutorial button can replay the full tour or one section. Quiet Skip with confirmation, per-account DB dismissal flag, stable `data-tour` anchors guarded by a test. |
| [`spec-016`](spec-016-portal-tour-and-roster-ui-polish.md) | Portal Tour Placement and Roster Card Layout | PR #232 (issue #229) | 2026-10-15 | Shipped | Tour card positioned by pure geometry (below, above, docked, mobile bottom sheet) instead of a Popover; roster card header wraps without collisions; portal-wide overflow audit; "Run Roster Gate" renamed "Check Eligibility". |
| [`spec-017`](spec-017-onboarding-graduation-year-and-manager-season.md) | Onboarding Graduation Year Options and Manager Season Affiliation | TBD | 2026-10-16 | In Review | Step 1 of the join wizard now has one shared graduation-year dropdown (Class of 2027-2030 with grade and Senior/Junior/Sophomore/Freshman labels) for students and managers, plus a manager-only Season Affiliation dropdown (2026-27 default; format later changed to `YYYY-YY` by spec-019) saved to `school_managers.academic_year`. No migration. |
| [`spec-018`](spec-018-manager-invites-table.md) | Manager Invites Table | PR #252 (issue #224) | 2026-10-17 | Shipped; migration 0049 applied 18 Oct | School-manager invites move from `player_invites` (`role = 'manager'`) into `manager_invites`; `player_invites.role` dropped and `game_id` NOT NULL again. |
| [`spec-019`](spec-019-manager-portal-season-scope.md) | Manager Portal Season Scope and `YYYY-YY` Season Names | TBD (issue #230) | 2026-10-17 | In Review | Season names and `school_managers.academic_year` share one `YYYY-YY` format (`app/lib/season-name.ts`); a manager sees and edits only each game's active season when their affiliation equals it; staff admins (ADMINISTRATOR) keep the all-season view; `createSchoolRoster` no longer falls back to old seasons. No migration. |
| [`spec-020`](spec-020-season-roster-lock.md) | Season Roster Lock | PR #256 | 2026-10-18 | Shipped | Staff can lock a season's rosters from Admin -> League Setup (`seasons.rosters_locked_at`, migration 0050, applied to production 18 Oct). While locked, school managers are refused on every roster change including emergency swaps and invite approval, enforced centrally in `manager-auth.ts`; staff admins are exempt. Portal shows a locked banner and disables controls. |
| [`spec-021`](spec-021-student-handbook-page.md) | Student Handbook Page | branch `worktree-student-handbook-page` (PR TBD) | 2026-10-18 | Code ready; no migration | Public `/handbook` (footer link): pamphlet-style viewer, two-page spreads on tablets/desktop and one page on phones (zoom 150%/200%/Full page, search, chapters, link boxes, swipe and edge-tap paging, #page-N URLs, Read as text). Renders a staff-uploaded PDF client-side with pdf.js (admin content page upload, `/api/handbook` + `saveHandbookPdf`, stored as a `page_content` row), falling back to the bundled 2026-27 pamphlet page images. CSP gains `worker-src`. |

---

Companion docs (read those, don’t copy them here):

- [`docs/QUICKSTART.md`](../docs/QUICKSTART.md) — local run / bootstrap (`db:migrate`, `db:seed-owner`). Covers setup and a current project map; for the per-route map see [product.md](product.md).
- [`docs/dev/SUPABASE.md`](../docs/dev/SUPABASE.md) — env vars and client vs service-role usage.
- [`docs/dev/COMMIT_STYLE.md`](../docs/dev/COMMIT_STYLE.md) — conventional commits.
- [`specs/leadership-architecture.md`](../specs/leadership-architecture.md) — people + terms design (shipped `f14c7f4`; header now says Shipped). Its `getCachedLeadership()` fallback note is not how `queries.ts` works at HEAD.
- [`specs/db-backup-automation.md`](../specs/db-backup-automation.md) — scoped local backups (shipped `b638369` / PR #90); off-site work (issue #89 and children) was closed not planned.
- [`db/RESTORE.md`](../db/RESTORE.md) — local restore procedure.

HEAD for this write-up: `11ed110` (2026-10-16), refreshed on `docs/refresh-stale-markdown`.
