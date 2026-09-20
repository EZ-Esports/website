# Incidents

Failure → what actually happened → the fix. Standing operator rules that came out of these are in [`CLAUDE.md`](../CLAUDE.md). This file is the history that makes those rules non-negotiable. Do not treat a code comment, a spec status line, or a local search as proof that production is safe.

---

## 1. Production gold-seed — 30 Jul 2026

**Failure scenario.** Run `db:seed:gold` against the only database (production Supabase) using the early-July loader (`9a5778b`): delete nine tables, re-insert from gold CSVs. A comment claimed wiping `members` was safe because `leadership.member_id` was “always null.” Two production runs. No `pg_dump` beforehand; **no backup existed for the second run.**

**Actual result** (documented `688fb51`, `9219ef5`, `2aece37`, `abe83ad`):

- **UUID churn.** New ids on every row. Vercel Data Cache kept serving old ids. Standings/schedule queries succeeded and matched nothing (“No standings recorded for this season and division yet.”). Pages rendered empty; the database was fine. Redeploy did not help.
- **Cascade.** Wiping `members` deleted **70 leadership rows** (`onDelete: 'cascade'`). The **99 that survived** were unlinked. The comment was wrong; nobody checked the live table. Original `staff_completeroster.csv` (169 records, 2021–2025) was gitignored and is gone from the repo.
- **Column loss.** Re-insert from `gold_schools.csv` (slug / name / display_order) wiped **27 school logos** and other admin-edited fields the CSV does not own.

**Fix (31 Jul).** `requireFreshBackup()` (`db/backup.ts`). `assertSeedTargetAllowed()` refuses remote hosts unless `SEED_ALLOW_REMOTE=<exact-hostname>` — accident brake, **not permission**. Natural keys (`0026`). Gold upserts; CSV writes only columns it owns (`9219ef5`); `games.image_url` filled only when null. Leadership merge-not-wipe; `0027` SET NULL. People-tab ETL (`2aece37` #59). Hazards written into `CLAUDE.md` (`abe83ad`). Scoped backups later cover `db:migrate` (`b638369`); off-site still issue #89.

**Do not repeat.** Confirm with the user before any production seed/migrate, even if the env var would allow it. Do not quote comments as safety properties. After UUID churn: `revalidateTag` or an admin no-op save — not a redeploy. Ask before declaring source data unrecoverable.

---

## 2. Vercel Data Cache survives redeploys

**Failure scenario.** Treat `unstable_cache` like build output. Change row ids (wipe seed, id-regenerating migration). Redeploy and expect pages to refill.

**Actual result.** Cache is infrastructure. Stale tagged entries keep winning. Empty UI, healthy DB. July 30 was the proof; nothing in Aug–Sep added a purge tool.

**Fix.** Documented in `CLAUDE.md` (tags listed there; `people` is used in code and omitted from that list). Mutators already `revalidateTag`. Cheap unblock: save any row on the relevant admin page with unchanged values.

**Do not repeat.** Do not “just redeploy.” Do not introduce a wipe seed “because upsert is slower.”

---

## 3. PII gitignore gap

**Failure scenario.** Public repo. Student names, emails, Discord handles, hometowns, grad years live in CSVs and `pg_dump`s. A root-only `/*.csv` pattern is assumed to cover everything named `*.csv`.

**Actual result.** `3831639` (15 Jun) added `/*.csv` because archive import used root CSVs. `d5a603f` **removed** the rule the same day after local files were deleted. Nested paths were never covered. Later, two files under `sharepoint/` with contact info for **169 students** sat untracked but committable. Root-anchored gitignore does not match `sharepoint/*.csv`.

**Fix.** `688fb51` / PR #59 `2aece37`: `/sharepoint/*.csv`, bronze/silver/gold dirs, `/db/backups/`. `/*.csv` is back at HEAD. `CLAUDE.md`: `git status` before any broad `git add -A`. Never copy gitignored PII into commits or this folder. Never declare a missing CSV unrecoverable without asking the user.

---

## 4. Mutating applied migrations

**Failure scenario.** `956bcb7` (20 Jul) edited `0017_homepage_content_defaults.sql` (gallery `set_id`) **eighteen days after** `9a5778b` (2 Jul) shipped `0017`. Changing an already-applied file does not rerun on production.

**Actual result.** Local journal and live DB would diverge; gallery consolidation would not apply to databases that had already run `0017`.

**Fix.** Same day `0f08472` reverted `0017` and added `0021_consolidate_gallery_sets.sql` (then `0022` dropped `set_id`).

Same-day edits to not-yet-settled files are weaker: `0019`/`0020` rewritten hours after creation (`686f083`, `29465a7`); `0031` rewritten twice the afternoon it landed (`84a77ee`, `ac0c641`). Those look like pre-apply review, not the `0017` class. Pattern to avoid: edit a committed `.sql` after it may have run; add a new migration instead.

**Do not repeat.** If a shipped migration is wrong, write `00xx_…sql`. Never rewrite `0000`–`0034` in place.

---

## 5. Unauthenticated admin server actions — 10 Jun 2026

**Failure scenario.** Path middleware requires a session for `/admin/*`. Assume `'use server'` actions are covered.

**Actual result.** All 42 admin actions lacked `requireUser()`. Server-action dispatch bypasses the matcher. SVG uploads were a stored-XSS vector on a public bucket (also unsupported by `next/image`). Sponsor `javascript:` hrefs.

**Fix.** `dd934ef` same day: auth inside every action; SVG blocked; `safeUrl()` on sponsor links. Subsequent RBAC (`ad77369`, `1d5a916`) layered permission flags on top of that authn. HEAD gate is `requireStaff()` / `requirePermission()`. Later Markdown hardening (`926b978` #134) strips unsafe URL schemes (`javascript:`, `data:`, `vbscript:`, `file:`) via `isSafeMarkdownUrl()`.

**Do not repeat.** New server actions auth at the action. Middleware is UX, not a security boundary.

---

## 6. Storage deletes silently no-op — 15 Jun 2026

**Failure scenario.** Delete gallery/sponsor objects with the anon Supabase client. RLS + private bucket → success-shaped nothing.

**Fix.** `3cce264`: service-role client for storage mutations, still gated by server-side auth.

---

## 7. Stale design docs quoted as schema

**Failure scenario.** Cite `docs/dev/DATABASE.md` (Feb) as the live model while June Drizzle has different tables.

**Fix.** Doc deleted `2efca7b`. Live contract is `app/lib/db/schema.ts` + `db/migrations/`. `specs/leadership-architecture.md` and `specs/db-backup-automation.md` still say “Ready for Implementation” in the header after the work shipped (`f14c7f4`, `b638369`) — read git, not the status chip.

---

## 8. `/rules` add–remove–readd

**Failure scenario.** Product/legal page churn without a stable URL.

**Result.** `5fb8608` added `/rules` (17 Aug); `a2b6cf1` removed it the same day and retargeted apply consent. For ~four weeks the checkbox had no live rules link. Parallel-branch drafts (`615b340`, `feat/issue-105`) before HEAD. `/terms` (`5a18f66` #104) is **not** on this branch.

**Fix.** `6732658` (#132, 12 Sep) published League Rulebook & Code of Conduct. Consent copy must still match the live `/rules` URL.

---

## 9. Form UX dropped then restored (then partially dropped again)

**Failure scenario.** `3845ad7` (13 Aug, #71) replaced the school form with a 4-layer Google Form contact structure and **dropped** surrounding UX: “After You Apply” timeline, “Need Assistance?” card, header chips, intro, benefits.

**Result.** Parity on officer fields; worse onboarding chrome.

**Fix.** Same day `32e034b` restored that chrome while keeping the 4-layer structure.

**Follow-on.** `1e0e8d1` (#80, 19 Aug) added remaining Google Form questions (barriers, advisor, inclusive participation) and **removed** the Notice banner plus staff Discord contact mentions — a second, intentional drop of support chrome in favor of in-form instructions.

---

## 10. Smaller scars

- **`930299c`:** 389 matches imported `scheduled`/null — do not invent W–L from incomplete archives.
- **`6df7d59`:** one production `message` row unparseable; recovered via v1 parser after a live check, not declared lost. `details` is a versioned union because a single fixed shape strands redesigns.
- **`9353bf5`:** CSV export prefixes `=`/`+`/`-`/`@` (CWE-1236).
- **`2aece37`:** bronze refresh failed silently after ledger MAIN → Engineering; find the tab by columns, not name. People tab at PR #59 had three unusable rows (missing role/year) — refill the sheet, then ETL.
- **`c35fc61`:** RAC SeasonSelect slugify broke filtering; reverted.
- **`CLAUDE.md` vs gold:** header still says both seeds wipe. Gold does not, post-`9219ef5`. Hazard file is operator contract; `db/seed-gold.ts` is the mechanism.
