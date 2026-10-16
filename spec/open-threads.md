# Open threads (as of `11ed110`)

Things a later agent must **not** assume are finished. Only items grounded in git at this HEAD. If you close one, update this file.

Resolved items are deleted, not struck through: their history lives in [timeline.md](timeline.md) and [incidents.md](incidents.md). Re-verify an item against the code before relying on it; this file has gone stale before (it once claimed there was no `/terms` page).

---

## Environment and backups

- **Production is the only environment.** `.env` `DATABASE_URL` is live Supabase. No staging DB, no staging Vercel project. Seed/migrate guards (`assertSeedTargetAllowed`, `requireFreshBackup`) mitigate operator error; they do not create a safe playground. Test against a local Postgres with an explicit URL (`CLAUDE.md`). Gold upserts but still **prunes** archive-keyed matches/standings — operator discipline required.
- **Off-site / encrypted / scheduled backups are not built, and are not planned.** PR #90 (`b638369`) shipped *local* scoped dumps before seed and migrate, plus `db/RESTORE.md` and prune. Completeness check is a byte floor plus pg_dump’s “dump complete” marker. The original off-site plan (cron, `age`, private bucket, restore drills) was parent issue #89 and children #81–#88; all were closed **not planned** on 2026-09-13. A day with no seed/migrate and a bad admin or `psql` edit has **zero** backup coverage. [`specs/db-backup-automation.md`](../specs/db-backup-automation.md) §5 is the list that was dropped; its header “Ready for Implementation” refers to the local work that already landed. `RESTORE.md` asks for a scratch restore drill; not verified as executed.
- **No cache-purge tool.** After UUID churn, the documented unblock is `updateTag` or an admin save-with-same-values. No dashboard or script exists.

---

## Data that is still thin or one-shot

- **osu!, Minecraft, TETR.IO have no seasons.** Slugs shipped `cdb552b` / PR #45. Homepage showcase excludes them until live seasons exist. Display name is TETR.IO (`f04641b`); slug remains `tetris`. Banners are still `/images/hero-background.jpg`. Hubs show `MigrationNotice` (`452073e`) and generic empty bento (`d047f99`) — that empty state is a product decision, not a missing recruitment page. Do not build standings/schedule as if archives exist. Pipeline README still defers Tetris/Minecraft Challonge brackets and notes incomplete 2024–25 Valorant/TFT chase.
- **Historical match scores were never complete.** June import (`930299c`) was schedule-only. Gold pipeline skips derived standings when results are incomplete. Do not treat `roster_standings` as ground truth for every season. See also issue #228 (hide incomplete season outcomes on public views).
- **Leadership recovery after the July 30 cascade is not “the pipeline fixed it.”** Seventy destroyed rows needed an archived `staff_completeroster.csv` (gone from the repo; `CLAUDE.md` says ask the user before declaring it lost). The People tab at PR #59 had only 3 rows, unusable (missing role/year). ETL is wired (`2aece37`); sheet refill was still required. `npm run db:ingest:leadership` / `db:seed:leadership` merges into **legacy `leadership` only** — public `/leadership` reads `people` + `leadership_terms` via `getCachedLeadership()` and never that table, so a sheet refill + seed does **not** update the public page. The hop is `npm run db:backfill:leadership` (`db/backfill-leadership.ts`); ongoing edits go through admin CMS. August’s `people` + `leadership_terms` backfill (`f14c7f4`, 201→112 profiles / 178 terms) is a *schema* recovery on whatever remained, not proof the wiped rows all came back. Merge still must not overwrite admin-edited bios.
- **Gallery DB cleanup after set consolidation is unverified.** `getCachedHomepageGallery` still defensively dedupes (`dc69fd4`). `set_id` is gone (`0022`); leftover duplicate rows were not a verified cleanup. A public `/gallery` page exists on main.

---

## Staff application resume rollout (spec-007)

The resume feature itself is merged (PR #190, `9ba693b`); the private `staff-resumes` bucket and migration `0036` are live (2026-09-26). Never edit `0036` in place; schema changes need a new migration. What remains:

- **Unauthenticated resume uploads can be spammed.** Anyone can POST `/api/apply/staff` with a valid PDF, and each accepted request stores a file (up to 4 MB) plus a row. The only brake is `rateLimit()` (5 per IP per 10 min), an in-memory Map that is per serverless instance and resets on cold start, so a distributed or patient sender can fill Storage and the Applications tab. Options: Cloudflare Turnstile (or similar) verified server-side before upload; a durable shared rate limiter (e.g. Upstash, which `rate-limit.ts` already points at); and/or a cleanup job that removes objects in `staff-resumes` with no matching `resume_storage_key` plus a Storage usage alert. Not started.
- **Privacy erasure does not delete the PDF.** `erase_staff_application_privacy` removes the row (`'delete'`) or nulls `resume_storage_key` (`'redact'`), but the object in `staff-resumes` has to be removed separately, and the key must be read first. The manual runbook is in [spec-007](spec-007-staff-application-resume.md) item 9.
- **Automate deletion on decline. Needed to keep the published retention promise without manual work.** `/privacy` says an application and its resume are deleted once we decide not to move forward with it. Declining in `/admin/applications` only writes a status log, so every decline needs the manual runbook. Build:
  - a server action, gated by `MANAGE_APPLICATIONS`, that on decline (or an explicit "delete") reads `resume_storage_key`, removes the PDF from `staff-resumes`, and only then runs `erase_staff_application_privacy(id, actor, 'delete')`; and
  - a periodic sweep that deletes objects in `staff-resumes` with no matching `resume_storage_key`, to catch failures between the two steps.

  Decide whether decline deletes immediately or after a short grace period, and update the policy wording if it becomes a grace period.
- **Applications declined before this deployed.** The `/privacy` retention wording also covers applications already declined or soft-deleted in production. Nothing removes those today. List staff applications with status "rejected" or `deleted_at` set and process each one with the runbook in [spec-007](spec-007-staff-application-resume.md) item 9 (read `resume_storage_key`, delete the PDF, then erase the row). Also note that downloaded resumes, exported CSVs, and `db/backups` dumps can outlive a deletion; `/privacy` Section 9 says some information may need to be retained, and backup retention is not yet specified.
- **Deferred by the user (not started):** screen-reader refinements to the resume picker, and a copy tidy (Step 3 description and placeholder, placement of the unpaid acknowledgement, the hardcoded "5th year in 2026–27").

---

## Product / legal gaps

- **Custom domain `ezesports.org`:** `CANONICAL_APP_URL` in `app/lib/constants.ts` is now `https://ezesports.org`, and the sitemap/`metadataBase` follow it. Not verified from code: that DNS and Vercel actually serve the domain and redirect the `ez-esports.vercel.app` host to it. Tracked with the SEO work in [issue #244](https://github.com/EZ-Esports/website/issues/244).
- **Parental media release / NY Ed Law § 2-D and rules/Parents' Bill of Rights are unmerged.** `origin/feat/issue-105-league-rules` and `origin/feat/issue-106-parents-bill-of-rights` are not ancestors of `main` (`9603475`, `8215457` live on those branches). `/terms` and `/rules` exist on main; check the branches before assuming their content is what ships.
- **Advisor roster RBAC — not in the repo.** Form collects advisor fields; there is no advisor-scoped permission model. Access is twelve `MANAGE_*` flags plus `ADMINISTRATOR`.
- **Apply metadata mismatch.** Header CTA and apply heading: “Submit Interest” (`3afc647` #94, `f9eeabc` #95). Page `<title>` (`apply/page.tsx`) and the `Navigation.tsx` dropdown: still “Apply to Play.” `/about` hero and bottom CTAs still “Apply Now”; footer link label is “Apply.”
- **Student-founded vs student-run.** Homepage heading/pillar `3959d7e`. Footer, `/privacy`, `/terms` still say “student-run.” Body copy on the same homepage section says “student-led.” `/about` scoreboard, operations card, and “Ten Student-Run Divisions” heading still say student-run.
- **Destructive admin color token.** PR #13 kept raw `red-*` for destructive actions (e.g. `ImageUpload`, `InviteRow`, `ProvisionInviteTab`); noted for a later token pass, not done.
- **Application `message` column retained**; pre-jsonb rows may have `details: null`; admin modal/CSV fall back to `message`.

---

## Tooling dual-maintenance

- **Skills live in two trees:** `.claude/skills/` (`36ab5fc`) and `.gemini/skills/` (`d217ef8` #54, Antigravity). Same names: `implement`, `review-loop`, `ui`, `uiux`, `create-artifact`, `cleanup`. Editing one copy does not update the other. `.agents/` is gone at HEAD (early `website-ui-standards` lived there).
- **`docs/QUICKSTART.md` is behind the product.** It still presents `constants.ts` as the data source, a public roster route, and a `[game]/page.tsx` hub. Use [product.md](product.md) + `schema.ts` for current shape; use QUICKSTART for `npm run dev` and `db:seed-owner`.
- **February schema leftovers.** No `match_details` JSONB, no `team_staff`/`org_staff` split, no unified `people` for players. `people` is leadership-only.
- **No `.github/dependabot.yml`**; alerts are manual PRs.
- **Next.js agent-rules block** in `CLAUDE.md` is regenerated by `next dev` — treating it as hand-edited source fights the generator.
- **Remove `experimental.reactDebugChannel: false`.** Added `f5e26ed` on Next ^16.2.6 for a Firefox dev refresh loop; comment says remove after stable 16.3+. Still present in `next.config` while `package.json` is `next` ^16.3.8 — verify whether it is still needed before deleting.

---

## `CLAUDE.md` drift

- The cache-tag list omits `tournaments`, which `app/lib/db` queries use.

---

## Product spec drift (`product.md`)

- `product.md` still says there is **no public `/gallery`**, no `/terms`, and no CSP/login rate limiting, and still names `ez-esports.vercel.app` as canonical. All of those changed on main (`/gallery` and `/terms` pages exist, login is rate limited in `login/actions.ts`, the middleware sets a Content-Security-Policy, `CANONICAL_APP_URL` is `ezesports.org`). Update `product.md` when next touching those areas.

---

## Team role editor: permission bits the actor lacks

Still true after the PR #218 follow-ups ([spec-013](spec-013-staff-portal-ui-overhaul.md), incidents section 17): permission bits the actor lacks are disabled and are left out of the saved bitmask, so saving a role that holds one removes it (unless the escalation guard rejects first). Preserving them would need a server-side merge, because `updateRole` rejects any submitted bit the actor lacks.

## Staff portal follow-ups from spec-013 (need behaviour changes)

- Inline-create pages (Schools, Sponsors, Gallery) could move "Add …" into a header button that opens a dialog, which needs close-on-success wiring in `AddEntityForm`.
- `LeagueSetupClient`, `RosterExplorer`, `TeamManagerClient`, `StaffRow` and `InviteRow` still use `window.confirm` for destructive actions; they could reuse the `ConfirmDeleteButton` dialog.

## Dependency drift

- `eslint-config-next` is pinned at `16.1.0` in `package.json` while `next` is `^16.3.8`. Lint passes, but the two should be aligned in a separate dependency pass (left untouched in the Dependabot #71 security bump to keep the diff minimal).

## Gallery thumbnail rollout (spec-014)

- Migration `0046_gallery_image_thumbnails` is **applied** in production; `npm run db:backfill:gallery-thumbnails` has only been dry-run (it then saw 3 own-folder rows; the extended backfill also covers 29 legacy root-key and 3 local-static live rows). Run it dry first, then `--apply`, then save any gallery row in `/admin/gallery` to refresh the Data Cache. Until then existing rows show full-size files (unoptimized). Not re-verified against production since.
- Sponsor logos and leadership avatars stay unoptimized without thumbnails; revisit only if they grow.
- The other tsx db scripts that import `app/lib/db` (seed-gold, seed-leadership, backfill-leadership, seed-owner, storage-clean) likely hit the same `server-only` launch crash (incidents section 20); decide whether to add `--conditions=react-server` to them (only the gallery thumbnail backfill has it today).

## Manager portal tour (spec-015)

- Migration `0048_school_manager_tour_completed` (adds nullable `school_managers.tour_completed_at`) is **applied to production** (14 Oct 2026, right after merging #227). Remaining: run the manual checks in spec-015 against real data (first visit, completion stamped on all of a person's rows, second manager at the same school still sees it, staff admin sees no tour). Staff admins with no `school_managers` row never auto-start the tour but can still replay it from the Tutorial button (confirmed by reading `PortalTour.tsx`; deliberate).
- `drizzle-kit generate` aborts because `db/migrations/meta/0041_snapshot.json` and `0042_snapshot.json` point at the same parent snapshot; migrations 0043-0048 were hand-written. Repair the snapshot chain so future migrations can be generated.
