# Open threads (as of `926b978`)

Things a later agent must **not** assume are finished. Only items grounded in git at this HEAD. If you close one, update this file.

---

## Environment and backups

- **Production is the only environment.** `.env` `DATABASE_URL` is live Supabase. No staging DB, no staging Vercel project. Seed/migrate guards (`assertSeedTargetAllowed`, `requireFreshBackup`) mitigate operator error; they do not create a safe playground. Test against a local Postgres with an explicit URL (`CLAUDE.md`). Gold upserts but still **prunes** archive-keyed matches/standings — operator discipline required.
- **Off-site / encrypted / scheduled backups are not built.** PR #90 (`b638369`) shipped *local* scoped dumps before seed and migrate, plus `db/RESTORE.md` and prune. Completeness check is a byte floor plus pg_dump’s “dump complete” marker. The original off-site plan (cron, `age`, private bucket, restore drills) is deferred under **[issue #89](https://github.com/EZ-Esports/website/issues/89)** and children #81–#88. A day with no seed/migrate and a bad admin or `psql` edit has **zero** backup coverage. [`specs/db-backup-automation.md`](../specs/db-backup-automation.md) §5 is the list; its header “Ready for Implementation” refers to the local work that already landed. `RESTORE.md` asks for a scratch restore drill; not verified as executed.
- **No cache-purge tool.** After UUID churn, the documented unblock is `revalidateTag` or an admin save-with-same-values. Era 3 did not add a dashboard or script.

---

## Data that is still thin or one-shot

- **osu!, Minecraft, TETR.IO have no seasons.** Slugs shipped `cdb552b` / PR #45. Homepage showcase excludes them until live seasons exist. Display name is TETR.IO (`f04641b`); slug remains `tetris`. Banners are still `/images/hero-background.jpg`. Hubs show `MigrationNotice` (`452073e`) and generic empty bento (`d047f99`) — that empty state is a product decision, not a missing recruitment page. Do not build standings/schedule as if archives exist. Pipeline README still defers Tetris/Minecraft Challonge brackets and notes incomplete 2024–25 Valorant/TFT chase.
- **Historical match scores were never complete.** June import (`930299c`) was schedule-only. Gold pipeline skips derived standings when results are incomplete. Do not treat `roster_standings` as ground truth for every season.
- **Leadership recovery after the July 30 cascade is not “the pipeline fixed it.”** Seventy destroyed rows needed an archived `staff_completeroster.csv` (gone from the repo; `CLAUDE.md` says ask the user before declaring it lost). The People tab at PR #59 had only 3 rows, unusable (missing role/year). ETL is wired (`2aece37`); sheet refill was still required. `npm run db:seed:leadership` merges into **legacy `leadership` only** — public `/leadership` reads `people` + `leadership_terms` via `getCachedLeadership()` and never that table, so a sheet refill + seed does **not** update the public page. The hop is `db/backfill-leadership.ts` (not in `package.json`); ongoing edits go through admin CMS. August’s `people` + `leadership_terms` backfill (`f14c7f4`, 201→112 profiles / 178 terms) is a *schema* recovery on whatever remained, not proof the wiped rows all came back. Merge still must not overwrite admin-edited bios.
- **Gallery DB cleanup after set consolidation is pending.** `getCachedHomepageGallery` still defensively dedupes (`dc69fd4`). `set_id` is gone (`0022`); leftover duplicate rows were not a verified cleanup. **No public `/gallery`.** `feat/issue-100-view-full-gallery` exists locally and on origin; not merged.
- **`db:seed` (non-gold) is still a wipe** of the nine tables it owns, UUID-regenerating, more destructive than `db:seed:gold`. It still expects two gitignored **root** CSVs. Prefer gold + leadership merge unless you know you need the old importer.

---

## Product / legal gaps

- **Custom domain `ezesports.org` is not the canonical app URL.** SEO/`metadataBase`/`sitemap` default to `ez-esports.vercel.app` (`1f82559`). README and `/privacy` still name `ezesports.org`. DNS/domain wiring was deferred in June and not closed later.
- **No `/terms` on HEAD.** `5a18f66` (#104) adds Terms of Service but is **not an ancestor of `926b978`**. Apply consent on other branches (`feat/issue-105`, `feat/issue-106`) may link to `/terms`. Parental media release / NY Ed Law § 2-D (`9603475`, `8215457` on those branches) is likewise unmerged. `/rules` at HEAD is the 12 Sep page (`6732658`), not the 17 Aug draft.
- **Login rate limiting — not in the repo.** `login/actions.ts` is plain `signInWithPassword`. In-process `rateLimit()` covers `/api/apply`, staff apply, uploads, and staff invites only, and resets on serverless cold start.
- **Advisor roster RBAC — not in the repo.** Form collects advisor fields; there is no advisor-scoped permission model. Access is twelve `MANAGE_*` flags plus `ADMINISTRATOR`.
- **CSP omitted.** `0442af1` (#129) shipped X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS. **No Content-Security-Policy.** Markdown XSS is render-time (`926b978`), not a CSP `script-src` story.
- **Apply metadata mismatch.** Header CTA and apply heading: “Submit Interest” (`3afc647` #94, `f9eeabc` #95). Page `<title>` and `Navigation.tsx` dropdown: still “Apply to Play.” `/about` hero and bottom CTAs still “Apply Now”; footer link label is “Apply.”
- **Student-founded vs student-run.** Homepage heading/pillar `3959d7e`. Footer + `/privacy` still say “student-run.” Body copy on the same homepage section says “student-led.” `/about` scoreboard, operations card, and divisions heading still say student-run.
- **Apply-form copy** still names Clash Royale / Smash as leagues and “Tetris” in the other-clubs prompt.
- **Destructive admin color token.** PR #13 kept raw `red-*` for destructive actions; noted for a later token pass, not done.
- **Application `message` column retained**; pre-jsonb rows may have `details: null`; admin modal/CSV fall back to `message`.

---

## Tooling dual-maintenance

- **Skills live in two trees:** `.claude/skills/` (`36ab5fc`) and `.gemini/skills/` (`d217ef8` #54, Antigravity). Same names: `implement`, `review-loop`, `ui`, `uiux`, `create-artifact`, `cleanup`. Editing one copy does not update the other. `.agents/` is gone at HEAD (early `website-ui-standards` lived there).
- **`docs/QUICKSTART.md` is behind the product.** It still presents `constants.ts` as the data source, a public roster route, and a `[game]/page.tsx` hub. Use [product.md](product.md) + `schema.ts` for current shape; use QUICKSTART for `npm run dev` and `db:seed-owner`.
- **February schema leftovers.** No `match_details` JSONB, no `team_staff`/`org_staff` split, no unified `people` for players. `people` is leadership-only.
- **No `.github/dependabot.yml`**; alerts are manual PRs.
- **Next.js agent-rules block** in `CLAUDE.md` is regenerated by `next dev` — treating it as hand-edited source fights the generator.
- **Remove `experimental.reactDebugChannel: false`.** Added `f5e26ed` on Next ^16.2.6 for a Firefox dev refresh loop; comment says remove after stable 16.3+. Still present at HEAD while `package.json` is `next` ^16.3.5 — verify whether it is still needed before deleting.

---

## `CLAUDE.md` drift

- Seed wording still says `db:seed` and `db:seed:gold` both delete-and-reinsert. Gold upserts since `9219ef5`. The file is still the operator law for production, cache, PII, and “ask before unrecoverable”; do not “fix” it casually in a drive-by, but do not implement a wipe because the first paragraph sounds like one.
- Cache-tag list omits `people`, which `queries.ts` uses.
