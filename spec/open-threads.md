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

- **osu! and Minecraft have no seasons.** Slugs shipped `cdb552b` / PR #45. Homepage showcase excludes them until live seasons exist. Banners are still `/images/hero-background.jpg`. Hubs show `MigrationNotice` (`452073e`) and generic empty bento (`d047f99`) — that empty state is a product decision, not a missing recruitment page. Do not build standings/schedule as if archives exist. (TETR.IO, slug `tetris`, now has four seasons: PR #206, #210.) The pipeline README still notes the incomplete 2024–25 Valorant/TFT chase.
- **Historical match scores were never complete.** June import (`930299c`) was schedule-only. Gold pipeline skips derived standings when results are incomplete. Do not treat `roster_standings` as ground truth for every season. See also issue #228 and [spec-022](spec-022-hide-season-outcomes.md) (public views now hide outcomes until staff publish a season).
- **Leadership recovery after the July 30 cascade is not “the pipeline fixed it.”** Seventy destroyed rows needed an archived `staff_completeroster.csv` (gone from the repo; `CLAUDE.md` says ask the user before declaring it lost). The People tab at PR #59 had only 3 rows, unusable (missing role/year). ETL is wired (`2aece37`); sheet refill was still required. Since PR #198, `npm run db:ingest:leadership` / `db:seed:leadership` merges into `people` + `leadership_terms` (what public `/leadership` reads) with a compatibility write to legacy `leadership`; its script header still describes the old behaviour. `npm run db:backfill:leadership` (`db/backfill-leadership.ts`) is the older one-shot hop; ongoing edits go through admin CMS. August’s `people` + `leadership_terms` backfill (`f14c7f4`, 201→112 profiles / 178 terms) is a *schema* recovery on whatever remained, not proof the wiped rows all came back. Merge still must not overwrite admin-edited bios.
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

---

## Tooling dual-maintenance

- **Skills live in two trees:** `.claude/skills/` (`36ab5fc`) and `.gemini/skills/` (`d217ef8` #54, Antigravity). Same names: `implement`, `review-loop`, `ui`, `uiux`, `create-artifact`, `cleanup`. Editing one copy does not update the other. `.agents/` is gone at HEAD (early `website-ui-standards` lived there).
- **`docs/QUICKSTART.md` is behind the product.** It still presents `constants.ts` as the data source, a public roster route, and a `[game]/page.tsx` hub. Use [product.md](product.md) + `schema.ts` for current shape; use QUICKSTART for `npm run dev` and `db:seed-owner`.
- **February schema leftovers.** No `match_details` JSONB, no `team_staff`/`org_staff` split, no unified `people` for players. `people` is leadership-only.
- **No `.github/dependabot.yml`**; alerts are manual PRs.
- **Next.js agent-rules block** in `CLAUDE.md` is regenerated by `next dev` — treating it as hand-edited source fights the generator.
- **Remove `experimental.reactDebugChannel: false`.** Added `f5e26ed` on Next ^16.2.6 for a Firefox dev refresh loop; comment says remove after stable 16.3+. Still present in `next.config` while `package.json` is `next` ^16.3.8 — verify whether it is still needed before deleting.

---

## Team role editor: permission bits the actor lacks

Still true after the PR #218 follow-ups ([spec-013](spec-013-staff-portal-ui-overhaul.md), incidents section 17): permission bits the actor lacks are disabled and are left out of the saved bitmask, so saving a role that holds one removes it (unless the escalation guard rejects first). Preserving them would need a server-side merge, because `updateRole` rejects any submitted bit the actor lacks.

## Staff portal follow-ups from spec-013 (need behaviour changes)

- Inline-create pages (Schools, Sponsors, Gallery) could move "Add …" into a header button that opens a dialog, which needs close-on-success wiring in `AddEntityForm`.
- `LeagueSetupClient`, `TeamManagerClient`, `StaffRow` and `InviteRow` still use `window.confirm` for destructive actions; they could reuse the `ConfirmDeleteButton` dialog.

## Dependency drift

- `eslint-config-next` is pinned at `16.1.0` in `package.json` while `next` is `^16.3.8`. Lint passes, but the two should be aligned in a separate dependency pass (left untouched in the Dependabot #71 security bump to keep the diff minimal).

## Gallery thumbnail rollout (spec-014)

- Migration `0046_gallery_image_thumbnails` is **applied** in production; `npm run db:backfill:gallery-thumbnails` has only been dry-run (it then saw 3 own-folder rows; the extended backfill also covers 29 legacy root-key and 3 local-static live rows). Run it dry first, then `--apply`, then save any gallery row in `/admin/gallery` to refresh the Data Cache. Until then existing rows show full-size files (unoptimized). Not re-verified against production since.
- Sponsor logos and leadership avatars stay unoptimized without thumbnails; revisit only if they grow.
- The other tsx db scripts that import `app/lib/db` (seed-gold, seed-leadership, backfill-leadership, seed-owner, storage-clean) likely hit the same `server-only` launch crash (incidents section 20); decide whether to add `--conditions=react-server` to them (only the gallery thumbnail backfill has it today).

## Manager portal tour (spec-015)

- Migration `0048_school_manager_tour_completed` (adds nullable `school_managers.tour_completed_at`) is **applied to production** (14 Oct 2026, right after merging #227). Remaining: run the manual checks in spec-015 against real data (first visit, completion stamped on all of a person's rows, second manager at the same school still sees it, staff admin sees no tour). Staff admins with no `school_managers` row never auto-start the tour but can still replay it from the Tutorial button (confirmed by reading `PortalTour.tsx`; deliberate).
- `drizzle-kit generate` aborts because `db/migrations/meta/0041_snapshot.json` and `0042_snapshot.json` point at the same parent snapshot; migrations 0043-0048 were hand-written. Repair the snapshot chain so future migrations can be generated.

---

## Open GitHub issues

Tracked on GitHub; listed here so a later agent knows they exist. Check `gh issue list` for the current state.

- [#224](https://github.com/EZ-Esports/website/issues/224): move manager invites out of `player_invites`. Shipped in #252 ([spec-018](spec-018-manager-invites-table.md)); migration `0049` was applied to production on 18 Oct 2026 after a full backup. Resolved.
- [#228](https://github.com/EZ-Esports/website/issues/228): hide incomplete season outcomes on public views. Implemented in [spec-022](spec-022-hide-season-outcomes.md) (PR #261); migration `0051` is applied to production. Staff must press "Publish results" for each active season once its data is complete. Retiring a season (explicitly or by activating a new one) publishes it in the same write. Open: tournament brackets and tournament rows in Latest Results are not gated.
- [#229](https://github.com/EZ-Esports/website/issues/229): redesign the school manager portal UI to reduce friction (spec-016 shipped a first polish pass).
- [#230](https://github.com/EZ-Esports/website/issues/230): managers can view previous seasons outside their provisioned season. Resolved for the portal by [spec-019](spec-019-manager-portal-season-scope.md), refined by [spec-026](spec-026-manager-season-by-name.md) (season resolved by name) and [spec-028](spec-028-manager-past-season-view-only.md) (inactive seasons view-only), PR #267. Invite scoping is still open, see "Manager portal season scope" below.
- [#233](https://github.com/EZ-Esports/website/issues/233): school manager logins should not get a `staff_members` row when they reach `/admin` or `/login`. Fixed in [spec-023](spec-023-manager-no-staff-row.md) (PR #264): no row is created for managers; the staff login rejects them and `/admin` routes them to `/portal`. Open: manager staff rows created before the fix remain and are not cleaned up automatically.
- [#240](https://github.com/EZ-Esports/website/issues/240): link school names in Season standing and the Standings tab to team pages.
- [#241](https://github.com/EZ-Esports/website/issues/241): show high school alongside university on leadership cards.
- [#242](https://github.com/EZ-Esports/website/issues/242): in-site match reporting instead of Discord text channel reporting.
- [#243](https://github.com/EZ-Esports/website/issues/243): school roster locking on the manager side.
- [#244](https://github.com/EZ-Esports/website/issues/244): SEO (canonical domain, metadata, sitemap, structured data, measurement).
- [#247](https://github.com/EZ-Esports/website/issues/247): Riot Sign-On (OAuth) and consent for student onboarding. On hold until Riot approves the production key.
- [#248](https://github.com/EZ-Esports/website/issues/248): ingest Riot match data from consenting students, plus a WebSocket/realtime layer. On hold, depends on #247 and the production key.
- [#249](https://github.com/EZ-Esports/website/issues/249): Discord OAuth and guild membership check in the join wizard (spec-011 designed it; only the honor-system checkbox is built).
- [#250](https://github.com/EZ-Esports/website/issues/250): trim manager and student onboarding form questions (needs Edison's input).

## Onboarding draft and season defaults (spec-017)

- `saveOnboardingDraft` replaces the invite's whole `submission_draft` with the wizard payload, so a manager clicking "Save Draft" drops the admin-seeded `managedGames` and `isPrimaryContact` (and, before spec-017, `academicYear`). Fix by merging those keys from the existing draft on the server.
- (Resolved in spec-019: the hard-coded `'2025-2026'` default is gone; manager seasons are `YYYY-YY` and default to `DEFAULT_MANAGER_SEASON`.) Bump or derive it from today's date in a separate change.
- The graduation-year and season option lists are static and need a yearly edit in the join `types.ts`.

## Manager portal season scope (spec-019)

- **Decision needed: invite scoping.** `player_invites` has no season column, so `getSchoolInvites` / `getPendingSubmissions` are limited to games the manager currently manages, not to a season; invites of the manager's OTHER seasons for a managed game remain visible (the only remaining cross-season leak in the portal; read-only for inactive seasons, but still shown). A `created_at >= season.created_at` filter was rejected as unsound. Options: add `player_invites.season_id` (migration) or derive it.
- **#233 interplay.** Managers can still hold role-less `staff_members` rows (legacy, or granted deliberately). The portal's staff-admin check is the ADMINISTRATOR permission only, so those rows do not widen access; keep it that way. New manager logins no longer create such rows (spec-023).
- Renaming a season in League Setup silently re-maps or orphans managers whose `academic_year` matches the old or new name (spec-026 open item): there is no cross-check or warning.
- [#266](https://github.com/EZ-Esports/website/issues/266): approving a player invite with an explicit `rosterId` checks the roster's school but not that the roster's game matches the invite's game. It stays inside the manager's school, and the roster's own season and lock are enforced. Tracked separately for the player-invites PR.
- Existing seasons with free-text names (for example `Spring 2025`) stay editable but never match a manager; rename them to `YYYY-YY` in League Setup for managers to see that season.

## Season roster lock (spec-020)

- Migration `0050_season_rosters_locked` was applied to production on 18 Oct 2026 (before #256 merged). Resolved.
- The lock is per season with no actor or reason recorded, and no scheduled auto-lock.
- Invite approval is refused whenever the game's season is locked, even if it would have enrolled nobody; revisit if staff want approvals to continue during a lock.

## Student Handbook page (spec-021)

- Unverified in production: a real Supabase upload being read by pdf.js (public-bucket CORS) and the `?download=` filename behavior. On any pdf.js failure the page shows the bundled pages plus an Open PDF link.
- The stored handbook is capped at 4 MB (Vercel body limit). Picks up to 50 MB are shrunk in the browser by recompressing large raster images; a PDF still over 4 MB after two passes (for example mostly vector or CMYK/indexed images, which are skipped) is refused with its size. A signed direct-to-storage upload would lift the cap. Compression was exercised in the dev server on the real file but no upload was made. No "remove PDF" button, only replace.
- The bundled page images and text (`public/handbook/`, `app/lib/handbook-pages.ts`) are the 2026-27 edition and go stale each season. pdf.js standard-font/CMap data is not bundled.

## Schools roster view (spec-024)

- **Staff roster editing lives in Schools & Rosters ([spec-027](spec-027-schools-roster-editing.md)).** The old gap (no staff UI to create or edit members, teams or rosters) is closed. Still absent by choice: deleting a member, unregistering a team, and editing a member's email or school from the staff UI (the actions were dropped with `RosterExplorer`).
- **Roster-only roles cannot reach the view.** The page requires `MANAGE_ROSTERS`, but it is reached from Schools, which needs `MANAGE_SCHOOLS`. A role with only `MANAGE_ROSTERS` can open the URL directly but has no nav path.

---

## Onboarding consent (spec-029)

- **Migration `0052` was applied to production on 2026-10-23**, after PR #269 merged and with a fresh pre-migration backup (`members`, `schools`). Verified read-only afterwards: `onboarding_consents` exists with 15 columns and 0 rows. Onboarding submissions were failing on the missing table in the window between the merge and the migration. No real submission has been run end to end against the deployed site yet.
- **Legal to confirm:** adults currently see only the Terms of Service acknowledgment (the supplied form is a guardian authorization). Confirm that is sufficient, and whether managers or adults need anything else.
- **No staff view or export of consent records**, no guardian confirmation email, and no re-consent for members onboarded before `0052`.
