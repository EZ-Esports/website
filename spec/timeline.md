# Timeline

Milestones that changed the product or the operating rules. Not a changelog. Dates + SHA/PR throughout. HEAD: `926b978` (2026-09-12).

**Inflection points:** static → DB (Jun 2026); UI rewrite (Jul 12–13); production gold-seed (Jul 30); apply-form parity (Aug 13–19); security/legal sprint (Sep 11–12).

---

## Origins — Dec 2025 – Jun 2026

### December 2025 — static marketing MVP

- **2025-12-20 `48c6e30`** — Repo initialized.
- **2025-12-21 `3f920df`** — Next.js + TypeScript + Tailwind.
- **2025-12-22–23** — Legacy assets (`b2e121a`), homepage (`2a8fa2a`). PR #4 `5e3286c`.
- **2025-12-23 PR #5 `c068937` / `32b804d`** — **Per-game hubs** (Valorant, LoL, TFT): standings, schedule, teams, roster, plus `/news`, `/about`, `/leadership/[year]`. Data in `constants.ts` / static TS. No database.
- **2025-12-24 `37246b1`** — TFT slug → `team-fight-tactics`.

### January–May 2026 — docs, then silence

- **2026-01-31 `4b682f2`** — `docs/QUICKSTART.md`.
- **2026-02-07–10** — Loading-screen experiments (`7b35160` still marked broken); removed later, not fixed (`6a59b63`).
- **2026-02-13–14 `cf27afb`, `e10ee9a`, `4280391`** — Aspirational `DATABASE.md` / `SUPABASE.md` (`people`, staff tables, JSONB matches). **No migrations.** Docs outran code ~3.5 months.
- **March–May** — Zero commits.

### June 2026 — database-backed CMS (~108 commits)

**Inflection: static → DB.** By `2efca7b` (30 Jun) this is a Vercel league hub (`ez-esports.vercel.app`) with Drizzle, admin CMS, RLS, and Discord-style roles. Bronze/silver/gold does **not** exist yet.

- **4 Jun `e4e53f7`** — Drizzle, schema (`games`…`news_posts`), migration `0000`, dummy seed. Same week: SSR auth `/admin` (`784f3d7`); CRUD + standings recalc (`53a31d0`); public pages with **static fallbacks** (`679d336`); `unstable_cache` tags (`7be90c2`); seed skip-if-games-exist (`6b48db7`) — no remote-host gate yet.
- **5 Jun `5b803f8`** — **Game → Season → Team → Roster (Varsity/JV) → Player**; matches bind roster IDs. Leadership to DB (`2b86bc4`); `schools`/`members`/`players` (`15e1a97`); nav + loading screen removed not fixed (`6a59b63`); archives dropped from header (`ced68c1`, still via footer/hubs); Next.js 16 `middleware.ts` → `proxy.ts` (`73d408b`).
- **8–10 Jun `a31423c`** — Phase 2 CMS: gallery, sponsors, applications, page content; `/api/apply`; `revalidateTag` on save. Storage uploads (`a09ed82`); school wall, soft deletes, news workflow (`26886d1`). `98edc57`: `revalidateTag` needs a profile arg. **`dd934ef`:** 42 admin actions lacked `requireUser()`; SVG blocked. PR #6 `07b95b7` staging merge; PR #7 `574b575` Dependabot.
- **15–17 Jun `930299c`** — Dummy seed → `import-archive.ts` from two gitignored root CSVs (389 schedule-only matches, 169 leadership rows). `/*.csv` added then **dropped** (`3831639`, `d5a603f`). Service-role storage deletes (`3cce264`). PR #8 `0849963`: allowlist + invite tokens.
- **23–30 Jun** — RLS `0012` (`85941f4`); calendar UI (`00343ec`); Discord-style roles (`ad77369` — **not** migrations `0018`/`0019`); canonical URL `ez-esports.vercel.app` (`1f82559` — custom domain not wired). `2efca7b` deletes stale `DATABASE.md`.

---

## Platform — July 2026 (164 commits, PRs #9–#59)

Two tracks: UX rewrite, and archive data + seed safety. `soul.md` and `CLAUDE.md` both land this month.

- **2026-07-02 `9a5778b`** — **SharePoint pipeline starts.** `season_standings`, homepage DB-wired, `db/seed-gold.ts` + bronze/silver/gold Python. Gold seed is still **delete-and-reinsert**. Apply form expanded `1953ff2` (pre-parity). PR #9 `3b36a4d`: parallax, news markdown, sponsor tiers. Migration `0017` ships here.
- **Jul 12–14 — UI rewrite + ingest + RAC.** PR #10 `cd3780e`: 2023–26 archives (LoL winner-only, TFT points, Valorant A/B); **`0018` = mvp/notes/points**, not staff auth. PRs #11–#13 (`f80c2ec`, `288855e`, `d135179`): tokens → marketing → admin; three game hubs → `[game]` + `getGameHubData()`. PR #14 `bacbd5a` / `b2ff36a`: React Aria. `c35fc61` reverts SeasonSelect slugify (broke filtering). PR #13 kept raw `red-*` for destructive actions.
- **Jul 16–22.** PR #18 `1d5a916` (`21b3128`): staff permissions **`0019`**; **`0020_fine_cannonball` = `staff_revocations` tombstones** (`686f083`, `29465a7` + `pg_advisory_xact_lock`). `956bcb7` mutates applied `0017`; **`0f08472` reverts** and adds `0021`. Gallery `0022` drops `set_id`. [`soul.md`](../soul.md) `c0180bc`. Broadcast hero + archives Command Deck (`31e3027`, `f6ea83c`). **`70f0a11`:** archives back in header Competition menu as “Past Seasons” (reverses `ced68c1` chrome; footer still has Archives). `MigrationNotice` (`452073e`). Staff apply `d6518cc` (`0023`). CTA “Apply to Play” (PR #37 `7d9c16a`; renamed in Aug). First agent skill under `.agents/` (`3e872e7`).
- **Jul 23–27.** Skills → `.claude/skills/` (`36ab5fc`, **deletes `.agents/`**). **osu!, Minecraft, Tetris** added (`cdb552b` / PR #45); showcase still Val/LoL/TFT. Bento hub `c759fa3` (recruitment layout for empty divisions). **`d047f99` drops that recruitment grid** — honest empty bento instead. Division URLs `0b6adf7`; merge PR #46 `c48567b` adds a real **308** `/{game}` → `/{game}/varsity` (in-page `redirect()` on a streaming route degrades to meta-refresh). Seasons inactive-by-default `0024` (`649ab14`). Vercel Analytics `6a303e5`. Form-guide chips `9ce5ed9`. Leadership fun-facts → school/grad year `faec15d`. `sharp` pin `ae86069` (PR #50).
- **Jul 29–31 — seed incident.** Skills mirrored to `.gemini/` (`d217ef8` / PR #54; dual tree remains, **manual sync**). Combined LoL standings `0025` (`3f67b0c`) + one-table UI (`0dde508`, `19acf7d`, PR #55). **30 Jul:** production `db:seed:gold` wipe — [incidents.md](incidents.md). **31 Jul** PR #57 `688fb51`: backup guard, remote-seed gate, natural keys `0026`, leadership merge, `0027` SET NULL. PR #58 `9219ef5`: **upsert gold**. PR #59 `2aece37`: leadership ETL + `sharepoint/` gitignore. `abe83ad`: [`CLAUDE.md`](../CLAUDE.md).

---

## Operations — Aug–Sep 2026 (79 commits)

No commits 1–10 Aug.

- **11–13 Aug.** ETL handles `300c4ab` (`0029`, #64). PR #60 `0eae1d2`: leadership school/university (`0028`). **`1a72aad`:** leadership merge identity → `(name, year)`; role is match-preference only (do not trust `leadership-merge.ts` header). PR #65 `27909e4`: 13 dep vulns. PR #66 `cce733b`: Student Organization section + Next.js agent-rules in `CLAUDE.md`. Homepage “student-founded” `3959d7e` (footer/privacy still “student-run”). Teams filters `6d4ce96` + `/[game]/teams/[school]` (`c2e86ee`). CI `f5563e7` (#70).
- **13–19 Aug — apply-form parity.** PR #71 `3845ad7`: 4-layer Google Form; `32e034b` restores dropped “After You Apply.” Gallery gens: lazy carousel `8d800bc` → Framer drag `8051868` → Embla `2f41adc` → dual-row marquee `d2cd83d`. Applications append-only (`a107a01`, PRs #76–#77); `0031` rewritten same day (`84a77ee`, `ac0c641`) — pre-apply churn, not the `0017` class. PR #78 `f14c7f4`: **`people` + `leadership_terms`** (201→112 profiles / 178 terms) — [`specs/leadership-architecture.md`](../specs/leadership-architecture.md). **`5fb8608` → `a2b6cf1` (17 Aug):** `/rules` added and **removed** same day. PR #80 `1e0e8d1`: remaining Google Form fields; drops Notice banner and Discord contact mentions. PR #90 `b638369`: scoped backups + migrate guard — [`specs/db-backup-automation.md`](../specs/db-backup-automation.md); off-site still #89. PR #91 `6df7d59`: `details jsonb` v1|v2, production-verified backfill. PR #92 `9353bf5`: admin modal + CSV export (formula-injection prefix). Header CTA → **Submit Interest** (`3afc647` #94, `f9eeabc` #95); page `<title>` and nav dropdown left as “Apply to Play.” Season badge “Latest” `bbd58d9` (#96).
- **20 Aug – 10 Sep.** Homepage: gallery after Five-Borough (`e637fa5` #101) then **above** Student Organization (`c0eb355` #102 — HEAD order: Hero → Community in Action → Student Org). Sponsors → Embla `f8ba5a9` (#118/#119); youtube-nocookie `cd8f81e` (#121); **TETR.IO** display name `f04641b` (#123, slug `tetris`); footer IP disclaimers `37ad26c` (#120). **`5a18f66` (#104) `/terms` exists in git but is not an ancestor of HEAD.**
- **11–12 Sep — security/legal.** Dependabot #59–#64 (`9d40278` #128, `0463b43` #130). HTTP headers `0442af1` (#129) — **no CSP**. **`/rules` republished** `6732658` (#132) — this is the live page, not the Aug 17 draft (`615b340` is a parallel-branch draft, not an ancestor). Markdown URL XSS + ReDoS `926b978` (#134). HEAD.
