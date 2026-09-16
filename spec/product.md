# Product (as of `926b978`)

EZ Esports is the public site and staff CMS for a NYC high-school esports league. Mission, audience, and “what we are not” live in [`soul.md`](../soul.md) (`c0180bc`) — do not paraphrase that file into design copy. This file is the surface map and how it grew.

`SITE_CONFIG.name` is “NYC High School Esports League”; `company` is “EZ Esports” (`app/lib/constants.ts`). Hosted on Vercel. Canonical metadata URL is `https://ez-esports.vercel.app` (`1f82559`). README and `/privacy` still say `ezesports.org`; that domain is not wired in code. There is no staging app and no staging database. See [open-threads.md](open-threads.md).

---

## Public surfaces

| Route | Role |
|-------|------|
| `/` | Homepage (`c0eb355` order): broadcast hero → Community in Action marquee (`MediaGrid`) → Student Organization (“Five-Borough” / “Student-Founded” live *inside* this section) → video → game showcase → League Pulse → School Wall → Our Story. `force-dynamic`, with cached gallery/content helpers and try/catch fallbacks to `homepage-data.ts`. |
| `/about` | Org story; broadcast-style pass in July (`8d84f7c`). |
| `/news`, `/news/[id]` | Published posts; markdown rendering (`Markdown.tsx`). Drafts stay in admin. |
| `/leadership`, `/leadership/[year]` | Yearly org staff from `people` + `leadership_terms`. |
| `/archives` | Per-game “Command Deck” (`f6ea83c`). Header Competition menu **Past Seasons** (`70f0a11`, reverses `ced68c1` chrome) and footer Archives. |
| `/sponsors` | Tiered sponsors + Embla marquee. |
| `/apply` | School **Submit Interest** form (Google Form parity). Header/heading `3afc647` / `f9eeabc`. Page `<title>` and `Navigation.tsx` dropdown still say “Apply to Play.” |
| `/apply/staff` | Staff application (`d6518cc`). |
| `/rules` | League Rulebook & Code of Conduct (`6732658`). Linked from apply consent. |
| `/privacy` | Privacy policy (pre-era-3). **No `/terms` on this branch.** |
| `/login` | Staff login (footer “Staff Login”). |
| `/accept-invite` | Token landing for hashed staff invites (`0849963`, PR #8). Linked from `InviteStaffForm`; not in `ROUTES`; outside marketing layout (`force-dynamic`). |
| `/{game}` | **308** to `/{game}/varsity` (`next.config.ts`, PR #46). Not a page. |
| `/{game}/varsity`, `/junior-varsity` | Bento hub (`c759fa3`, `GameHubView`). Division is a path segment (`0b6adf7`). |
| `/{game}/standings`, `/schedule` | Current + archived competition. Combined LoL seasons (`standings_format`) render one table on both division routes (`0dde508`, `19acf7d`) with `SeasonFormatNotice`. Form-guide chips `9ce5ed9`. Season badge “Latest” `bbd58d9`. |
| `/{game}/teams`, `/{game}/teams/[school]` | Filterable rosters (`6d4ce96`); school detail (`c2e86ee`). |

Games in `app/lib/constants.ts`: Valorant, League of Legends, Teamfight Tactics (full archive/seasons), plus **osu!**, **Minecraft**, **TETR.IO** (slug `tetris`, display name `f04641b`). The last three have hubs only — no seasons, excluded from `getGamesForShowcase`, banners are placeholder `/images/hero-background.jpg`. Empty hubs are the same bento grid with a blank “This season” tile (`d047f99` removed the founding-season recruitment layout `c759fa3` had gated). `MigrationNotice` (`452073e`) still shows on competition pages.

**No public `/gallery`.** Photos render via homepage `MediaGrid` plus `/admin/gallery`. `feat/issue-100-view-full-gallery` exists on origin and is **not** an ancestor of HEAD.

---

## Staff CMS (`/admin`)

Supabase Auth is identity. Authorization is `staff_members` / roles + granular permissions (`0019`) + durable `staff_revocations` tombstones (`0020`). Invite copy shifted from “Admin” to “Staff” in PR #18. HEAD gate is `requireStaff()` / `requirePermission()` (`app/lib/auth.ts`); historically `requireUser()` (`dd934ef`).

| Area | What it edits |
|------|----------------|
| Dashboard | Counts / entry. |
| League | Season/game setup. |
| Matches, standings, roster, schools | Competition data. Standings editor exists because archives are snapshotted in `season_standings`, not only computed. |
| News | Draft / publish / archive. |
| Leadership | People profiles, terms, avatars. |
| Gallery, sponsors, content | CMS tables; saves call `revalidateTag`. |
| Applications | Detail modal, status via append-only events, CSV export (`9353bf5`). |
| Team | Staff invites and roles. |

Server actions must authorize themselves. Middleware refreshes JWT on `/admin` and `/login` only — it does not protect `'use server'` dispatch (`dd934ef`).

---

## Apply / legal

`/apply` is intake, not enrollment — that is why the CTA is “Submit Interest.” Payload is versioned `details jsonb`: `v1` (early team-registration) and `v2` (club-officer, Google Form shape). Legacy `message` text remains as fallback. Rows are append-only; status changes are event-log inserts, not in-place overwrites (`a107a01`, `6df7d59`). Admin CSV export RFC-4180-escapes and prefixes formula-injection (`=`, `+`, `-`, `@`) — `app/lib/csv.ts`, CWE-1236.

`/rules` existed for hours on 17 Aug (`5fb8608`) and was pulled the same day (`a2b6cf1`). The page at HEAD is the 12 Sep republication. For ~four weeks the consent checkbox had no live rules link. `1e0e8d1` (#80) added remaining Google Form questions and dropped the Notice banner plus staff Discord contact mentions.

Login rate limiting, advisor-roster RBAC, CSP, and `/terms` **did not ship on this branch.** Apply POST, staff apply, uploads, and staff invites *do* have an in-process `rateLimit()` (`app/lib/rate-limit.ts`); login (`signInWithPassword`) does not. `/terms` (`5a18f66` #104) is not an ancestor of `926b978`.

Apply-form copy still names Clash Royale / Smash as organized leagues and says “Tetris” in the other-clubs prompt — those titles are not in `GAMES`.

---

## Branding inconsistencies at HEAD

- **Submit Interest vs Apply to Play vs Apply Now.** Header/mobile CTA and apply heading say “Submit Interest.” Page `<title>` and nav dropdown still “Apply to Play.” `/about` hero CTA and bottom CTA still “Apply Now”; footer link label is “Apply” (not Submit Interest). `CutCTA` comment still describes Apply to Play.
- **Student-founded vs student-run vs student-led.** Homepage heading/pillar: “Student-Founded” (`3959d7e`). Body copy on the same section: “student-led” / “run by high school students.” Footer and `/privacy` still say “student-run.” `/about` scoreboard, operations card, and “Ten Student-Run Divisions” heading still say student-run.
- **TETR.IO vs Tetris.** Display name `TETR.IO`; slug `tetris`.

---

## How the map grew

1. **Dec 2025** — Marketing MVP. Per-game standings/schedule/teams/roster, news, about, leadership — all hardcoded (`32b804d`).
2. **Jun 2026** — Same URLs, DB-backed, with static fallbacks. Admin CMS, school wall, gallery/sponsors/page copy, apply API, image upload, calendar schedule, invite/RBAC. Archives leave the header.
3. **Jul 2026** — Archives become a first-class product (standings snapshots, Command Deck, combined LoL tables). Token + RAC rewrite. Bento hub. Three extra games; recruitment layout added then removed. Staff apply. `soul.md` states the nonprofit frame. Bare `/{game}` becomes a 308 to varsity.
4. **Aug 2026** — Teams UX (filters, school pages). Apply form matches the canonical Google Form and stores structured JSON. Leadership becomes people + terms. Gallery rewritten four times in ~two weeks, landing on the marquee. CTA language moves to interest-capture; SEO/nav labels lag.
5. **Sep 2026** — Legal and security catch up to a site that already collected applications: `/rules`, footer IP disclaimers, headers (no CSP), markdown XSS hardening, youtube-nocookie.

[`docs/QUICKSTART.md`](../docs/QUICKSTART.md) still describes `constants.ts` as the data source, a public `/[game]/roster` route, and a `[game]/page.tsx` hub. Use this file + `app/(marketing)` for the current map.
