# Product (as of `11ed110`)

EZ Esports is the public site and staff CMS for a NYC high-school esports league. Mission, audience, and “what we are not” live in [`soul.md`](../soul.md) (`c0180bc`) — do not paraphrase that file into design copy. This file is the surface map and how it grew.

`SITE_CONFIG.name` is “NYC High School Esports League”; `company` is “EZ Esports” (`app/lib/constants.ts`). Hosted on Vercel. `CANONICAL_APP_URL` (`app/lib/constants.ts`) is `https://ezesports.org`, which `metadataBase`, the sitemap and robots follow (earlier it was `ez-esports.vercel.app`, `1f82559`). Whether DNS and Vercel serve that domain and redirect the old host is not verifiable from code; see [open-threads.md](open-threads.md). There is no staging app and no staging database.

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
| `/apply/staff` | Staff application (`d6518cc`). Nine divisions (Software Engineering, Systems Engineering, Data Science, Marketing, Operations, Development, Productions Crew (label now "Productions Crew: Observer, shoutcaster, and/or graphics producer", spec-008), Legal, Game Regulations), where Game Regulations Division asks a required open-answer follow-up ("Which game director position are you interested in?", 500-character cap). The why-join answer shows its character limit (1,500); the Game Regulations answer (500) and Other links (1,000) are capped without a notice. Required PDF resume (private `staff-resumes` bucket), optional LinkedIn (linkedin.com hosts only) and "Other links", required unpaid-volunteer acknowledgement, recruiting intro with the mission statement, an "Unpaid volunteer" tag, and no future-pay wording ([spec-007](spec-007-staff-application-resume.md)). Optional "Referred by" name (50 chars) at the bottom of Role & Resume ([spec-008](spec-008-staff-application-referral.md)). Admin opens resumes via a 60 s signed URL. |
| `/rules` | League Rulebook & Code of Conduct (`6732658`, PR #132). Linked from apply consent. |
| `/terms` | Terms of Service (PR #194, #191). Linked from the footer and the apply consent checkboxes. |
| `/gallery` | Public full gallery (PR #138, #100), linked from the homepage Showcase CTA. Thumbnails load `unoptimized` ([spec-014](spec-014-gallery-thumbnails.md)). |
| `/careers`, `/careers/[slug]`, `/careers/apply/general` | Public job postings and the application form, managed in `/admin/careers`. |
| `/{game}/standings`, `/{game}/schedule`, hub, team pages, `/archives`, homepage Latest Results | Scores, standings, records, champions and recent results appear only for seasons staff have published (Admin -> League Setup -> Publish results, [spec-022](spec-022-hide-season-outcomes.md)); until then pages list teams neutrally with a "Results will be published once the season is complete." notice. Archived seasons were backfilled as published. |
| `/handbook` | Student Handbook ([spec-021](spec-021-student-handbook-page.md)). Footer link only. Pamphlet-style viewer (two-page spreads on tablets/desktop, one page on phones; pinch/Ctrl+scroll zoom from Full page) over a staff-uploaded PDF (pdf.js, Open/Download buttons) or, with none uploaded, the bundled 2026-27 pages. Managed from Website Content > Page Content in the admin. |
| `/privacy` | Privacy policy + Privacy erasure intake modal/action (`a1aeca6` PR #142 / #103). Covers phone, Discord, and staff application resumes: private storage, links for authorized staff and administrators that expire shortly after creation, and deletion when an application is declined or on request (a manual runbook for now) ([spec-007](spec-007-staff-application-resume.md)). |
| `/login` | Staff login (footer “Staff Login”). Rate limited per IP and per IP+account (PR #131); uses `useActionState` and never reflects errors into the URL (PR #193). |
| `/portal`, `/portal/login` | School Manager Portal and its own login; see the portal section below. |
| `/accept-invite` | Token landing for hashed staff invites (`0849963`, PR #8). Linked from `InviteStaffForm`; not in `ROUTES`; outside marketing layout (`force-dynamic`). |
| `/{game}` | **308** to `/{game}/varsity` (`next.config.ts`, PR #46). Not a page. |
| `/{game}/varsity`, `/junior-varsity` | Bento hub (`c759fa3`, `GameHubView`). Division is a path segment (`0b6adf7`). |
| `/{game}/bracket` | Tournament-model games (TFT, osu!, TETR.IO): stage and elimination-bracket view built with `bracketry` ([spec-010](spec-010-decoupled-tournament-brackets.md), PR #211, #212). |
| `/{game}/standings`, `/schedule` | Current + archived competition. PR #184: explicit Eastern Time ("ET") labeling, America/New_York calendar month grid calculation, completed forfeit display, and draw score normalization. Combined LoL seasons (`standings_format`) render one table on both division routes (`0dde508`, `19acf7d`) with `SeasonFormatNotice`. Form-guide chips `9ce5ed9`. Season badge “Latest” `bbd58d9`. |
| `/{game}/teams`, `/{game}/teams/[school]` | Filterable rosters (`6d4ce96`); school detail (`c2e86ee`). |
| `/join/[schoolSlug]/[gameSlug]` | Player onboarding wizard. Validates single-use cryptographic token, checks email, has players connect Discord through OAuth and be auto-added to the server (verified id and username from a signed cookie, [spec-033](spec-033-discord-oauth-onboarding.md); school managers use the same Connect Discord step and it is required for them too, [spec-035](spec-035-manager-discord-oauth.md); no roles or roster-time re-check yet, issue #249), checks the Riot ID format (`Name#Tag`) with tracker preview (no Riot Sign-On yet, issue #247), saves drafts, and collects student demographic survey into encrypted vault ([spec-011](spec-011-player-onboarding-and-manager-portal.md)). Connecting Discord opens a new tab and the form tab keeps everything typed (a manager does not retype the password); if the browser blocks the new tab it falls back to the old same-tab redirect ([spec-041](spec-041-discord-oauth-second-tab.md)). Free-text fields (names, Discord username, Riot ID, country, language, notes, guardian fields) are screened for profanity and slurs in many languages: a flagged field shows a warning and an "This is actually my real information" checkbox and cannot be submitted without it; staff see the override on the roster ([spec-040](spec-040-onboarding-offensive-content-screen.md)). On a manager invite, step 1 also asks "Will you also be playing?" with an **I also play in this league** checkbox and the games played; submitting then also files a player application on the same person (one member, one Discord account), reviewed in the portal queue like any student ([spec-044](spec-044-manager-also-plays.md)). A final step 5 records the Terms of Service acknowledgment (everyone) and the parent/guardian authorization with e-signature (under 18), for both player and manager invites ([spec-029](spec-029-onboarding-consent-form.md)). |

Games in `app/lib/constants.ts`: Valorant and League of Legends (`competitionModel: 'team'`, Varsity/JV), Teamfight Tactics, osu! and TETR.IO (`'tournament'`), and Minecraft (`'team'`, no JV). TETR.IO (slug `tetris`, display name `f04641b`) became forward-facing in PR #210 with four aggregated seasons (PR #206). osu! and Minecraft still have hubs only: no seasons, excluded from `getGamesForShowcase`, placeholder banners `/images/hero-background.jpg`. Empty hubs are the same bento grid with a blank “This season” tile (`d047f99` removed the founding-season recruitment layout `c759fa3` had gated). `MigrationNotice` (`452073e`) still shows on competition pages.

---

## Staff CMS (`/admin`)

Supabase Auth is identity. Authorization is `staff_members` / roles + granular permissions (`0019`) + durable `staff_revocations` tombstones (`0020`). Invite copy shifted from “Admin” to “Staff” in PR #18. HEAD gate is `requireStaff()` / `requirePermission()` (`app/lib/auth.ts`); historically `requireUser()` (`dd934ef`).

| Area | What it edits |
|------|----------------|
| Overview (`/admin`) | Welcome header, alerts, permitted stat cards, then a compact Control-Panel-style hub: one card per permitted category listing its sections as accent links, three columns wide ([spec-012](spec-012-admin-control-panel-nav.md)). |
| League | Season/game setup. |
| Matches, standings, roster, schools | Competition data. Standings editor exists because archives are snapshotted in `season_standings`, not only computed. Matches parse kickoffs via `parseEastern` (PR #184). |
| News | Draft / publish / archive. |
| Leadership | People profiles, terms, avatars. Scoped storage folders `${section}/${entityId}/` (PR #182). |
| Gallery, sponsors, content | CMS tables; saves call `updateTag` (PR #195). Scoped storage paths (PR #182). Gallery reorder uses derived state (`draftOrder`) and advisory-locked full ID list validation (PR #183). |
| Applications | Detail modal built on structured `details` (the legacy `message` column was dropped in PR #201), status via append-only events and a status machine (PR #200), CSV export (`9353bf5`). |
| Careers | Job postings and general applications (`/admin/careers`). |
| Student Demographics | Gated by `Permissions.VIEW_STUDENT_DEMOGRAPHICS`. |
| Team | Staff invites and roles. Role assign/edit/revoke guarded by transactional lock-then-re-read pattern against TOCTOU races (PR #181). |

**Shell layout.** See [spec-001](spec-001-admin-sidebar-pinning.md) and [spec-012](spec-012-admin-control-panel-nav.md). `AdminShell.tsx` has a 16rem left sidebar pinned to the viewport (`sticky top-0 h-dvh self-start`). It shows Overview, then three collapsible categories (RAC Disclosures), all from `app/lib/admin-nav.ts` and filtered by permission:

- **People & Staffing:** Applications, Careers, Roles & Staff, Leadership Manager.
- **League Operations:** League Setup (seasons list has Active / Inactive / All tabs via `?status=` and a "View matches" link per season; [spec-025](spec-025-league-setup-tabs-and-match-filters.md)), Matches (game and season filters live in `?game=&season=`; status tabs Needs results / Upcoming / Completed / All with server counts, default Needs results or All when arriving with a season or `from=league`; Schedule match is a dialog; [spec-030](spec-030-matches-page-redesign.md)), Schools & Rosters (each school has a **View rosters** page at `/admin/schools/[schoolId]/rosters`, requires `MANAGE_ROSTERS`, where staff also add/edit/remove teams, rosters and players, exempt from the manager roster lock, and can move a player between a team's rosters with a Move button ([spec-034](spec-034-roster-move.md)); filters live in `?game=&division=&phone=`; [spec-024](spec-024-schools-roster-view.md), [spec-027](spec-027-schools-roster-editing.md)), Student Demographics, Standings Archive (last). The standalone Teams & Rosters page was removed; `/admin/roster` redirects to Schools.
- **Website Content:** News & Announcements, Gallery, Sponsors, Page Content.

The nav scrolls on its own (`overflow-y-auto`) only when it outgrows a short viewport; Public Site and Sign Out stay pinned. The top bar is sticky and shows a `Staff portal › Category › Page` breadcrumb. Page content scrolls the document. No mobile drawer exists.

**Page anatomy ([spec-013](spec-013-staff-portal-ui-overhaul.md)).** Every admin page renders `AdminPage` → `AdminPageHeader` (accent category eyebrow, one `h1`, accent rule, one-line description, primary action on the right) → `AdminSection` panels, with shared empty, loading (skeleton), notice, toast, permission-denied and error states. Long lists keep their filters in sticky section toolbars (Applications, News, Matches, Standings, Leadership). Row actions are always visible.

Server actions must authorize themselves. Middleware refreshes JWT on `/admin` and `/login` only — it does not protect `'use server'` dispatch (`dd934ef`).

---

## Apply / legal

`/apply` is intake, not enrollment — that is why the CTA is “Submit Interest.” Payload is versioned `details jsonb`: `v1` (early team-registration) and `v2` (club-officer, Google Form shape) for school interest; staff applications add `v3` and `v4` ([spec-007](spec-007-staff-application-resume.md)). The legacy `message` text column was removed (PR #169, #201); old rows are rendered from `details`. Rows are append-only; status changes are event-log inserts, not in-place overwrites (`a107a01`, `6df7d59`). Admin CSV export RFC-4180-escapes and prefixes formula-injection (`=`, `+`, `-`, `@`) — `app/lib/csv.ts`, CWE-1236.

`/rules` existed for hours on 17 Aug (`5fb8608`) and was pulled the same day (`a2b6cf1`). The page at HEAD is the 12 Sep republication. For ~four weeks the consent checkbox had no live rules link. `1e0e8d1` (#80) added remaining Google Form questions and dropped the Notice banner plus staff Discord contact mentions.

Security posture: baseline headers in `next.config.ts` (PR #129) plus a per-request nonce Content-Security-Policy built in `app/lib/supabase/middleware.ts` (`buildCsp`, PR #141). Apply POST, staff apply, uploads, staff invites, `/login` and `/portal/login` all call the in-process `rateLimit()` (`app/lib/rate-limit.ts`; resets on serverless cold start). Advisor-roster RBAC did **not** ship: there is no advisor-scoped permission model.

The other-clubs prompt in the apply form names “Super Smash Bros. Ultimate, Tetris” as examples; those titles are not in `GAMES`.

---

## Branding inconsistencies at HEAD

- **Submit Interest vs Apply to Play vs Apply Now.** Header/mobile CTA and apply heading say “Submit Interest.” Page `<title>` and nav dropdown still “Apply to Play.” `/about` hero CTA and bottom CTA still “Apply Now”; footer link label is “Apply” (not Submit Interest). `CutCTA` comment still describes Apply to Play.
- **Student-founded vs student-run vs student-led.** Homepage heading/pillar: “Student-Founded” (`3959d7e`). Body copy on the same section: “student-led” / “run by high school students.” Footer and `/privacy` still say “student-run.” `/about` scoreboard, operations card, and “Ten Student-Run Divisions” heading still say student-run.
- **TETR.IO vs Tetris.** Display name `TETR.IO`; slug `tetris`.

---

---

## School Manager Portal (`/portal`)

Dedicated portal for vetted school managers and staff administrators ([spec-011](spec-011-player-onboarding-and-manager-portal.md)).
- Multi-tenancy scoped by school, game assignments and academic year with admin override. A manager works in each game's season whose name equals their affiliation (`YYYY-YY`), whether or not it is the active season; the header shows the season with an "Inactive season - View only" chip when it is not the game's active season ([spec-026](spec-026-manager-season-by-name.md)). An inactive season (older or newer than the active one) is view only for managers: a banner explains it and every write control (Create Roster, Enroll, Emergency Sub, Delete, Remove, role, invite creation, Approve and Reject) is disabled, while rosters, the player pool, invites and Check Eligibility stay readable; the active season behaves as before (roster lock still applies) and staff admins are exempt ([spec-028](spec-028-manager-past-season-view-only.md)).
- Cryptographically secure single-use player invite token generation (`player_invites`). The invite history table offers, on pending invites only, **Copy link** (issues a replacement token, kills the old link, copies the new one; confirm dialog) and **Delete** (confirm dialog; the link stops working). Submitted, accepted and rejected invites have no actions and the server refuses them ([spec-045](spec-045-invite-copy-regenerate-and-delete.md)).
- Zero-PII Approve / Reject queue (hides minor demographic PII, protecting `student_demographics` behind `Permissions.VIEW_STUDENT_DEMOGRAPHICS`).
- Live 5-Point Eligibility Validation Gate (roster caps, single captain, 100% Riot ID entered, 100% Discord username entered and flagged in guild; Discord is verified for players and managers at onboarding via OAuth and the server join, but not re-checked at roster time; the Riot ID is self-reported because nothing checks Riot).
- Move a player between a team's rosters: every roster row has "Move to JV" / "Move to Varsity" (a picker when the team has more than two rosters), disabled for locked and view-only seasons. A roster holds at most 7 players and 2 subs: cards show the count (6/7), Enroll / Add player turns into a disabled "Roster full (7/7)", Move does not offer a full roster, and eligibility is still minimum-only. A student cannot be on two rosters of the same team (one tier per game); enrolling someone already on the sibling roster is refused with a pointer to Move ([spec-034](spec-034-roster-move.md)).
- Matches ([spec-031](spec-031-manager-matches-view.md)): a read-only section lists the school's matches (home or away) for the manager's season, Upcoming and Past tabs, times in Eastern Time (ET), opponent, division, game and status. Scores and forfeits stay hidden until staff publish the season; staff admins see everything. Reschedule requests ([spec-032](spec-032-match-reschedule-requests.md)): on an Upcoming match a manager proposes 2-5 new times (ET, an hour or more apart) with a reason; the opposing manager accepts one, declines, or suggests 2-5 times of their own (one counter round: the requester then picks one or declines); the requester can cancel until a time is agreed, and either school can cancel while a counter-offer waits; staff approve or decline from a queue at the top of `/admin/matches`, and only approval moves the match. A request under 72 hours before the match is flagged late (the opponent decides). Both managers see the status in the portal.
- Match results from game data ([spec-038](spec-038-match-results-from-game-data.md)): on a Valorant match with no result, the Past tab's Result cell offers Submit result. The manager pastes 2-3 match IDs or tracker.gg links (best of 3); the site fetches them from HenrikDev, checks custom game, that all five players on each side are on one school's roster (starters or subs, by Riot ID) and that the sides are the two different schools, and that the game did not start more than an hour before the match's scheduled start; submissions are limited to one per match per 30 seconds and ten per user per hour, rejects games already used elsewhere, and records the series score and Completed status. A busy or down data service saves the IDs as waiting with Check again / Discard. Matches with stored games show a Scoreboard dialog (per-game tabs, ACS, K/D/A, HS%, damage, calculated MVP). Manual entry by staff is still the fallback.
- Guided tour ([spec-015](spec-015-manager-portal-guided-tour.md)): auto-starts on a manager's first visit (full tour: pick a game, invite players, approvals, rosters), and a Tutorial button in the page header replays the full tour or one section. Skip/Esc asks for confirmation. The tour card always stays fully in the viewport (bottom sheet on phones, docked when the target is taller than the screen; [spec-016](spec-016-portal-tour-and-roster-ui-polish.md)). Each roster card's eligibility button is "Check Eligibility" (runs the 5-point check; "Checking..." while running). Finishing or skipping the first-run tour is stored per account, so switching schools never replays it.
- Staff roster view and the School Managers dialog show a "Flagged info - overridden" badge on anyone who overrode the onboarding offensive-content warning, with the entered values and matched terms and a Mark reviewed button; the roster header counts unreviewed ones ([spec-040](spec-040-onboarding-offensive-content-screen.md)). The `/rules` page has Rule 3.4 (names, usernames and submitted information).
- Destructive confirmations (remove manager, revoke invite or staff access, cancel staff invite, delete role, game, season or an empty roster) open an in-app dialog with Cancel focused first and the failure shown inside it, never a native browser box ([spec-037](spec-037-in-app-confirm-dialogs.md)).

---

## How the map grew

1. **Dec 2025** — Marketing MVP. Per-game standings/schedule/teams/roster, news, about, leadership — all hardcoded (`32b804d`).
2. **Jun 2026** — Same URLs, DB-backed, with static fallbacks. Admin CMS, school wall, gallery/sponsors/page copy, apply API, image upload, calendar schedule, invite/RBAC. Archives leave the header.
3. **Jul 2026** — Archives become a first-class product (standings snapshots, Command Deck, combined LoL tables). Token + RAC rewrite. Bento hub. Three extra games; recruitment layout added then removed. Staff apply. `soul.md` states the nonprofit frame. Bare `/{game}` becomes a 308 to varsity.
4. **Aug 2026** — Teams UX (filters, school pages). Apply form matches the canonical Google Form and stores structured JSON. Leadership becomes people + terms. Gallery rewritten four times in ~two weeks, landing on the marquee. CTA language moves to interest-capture; SEO/nav labels lag.
5. **Sep 2026** — Legal and security catch up to a site that already collected applications: `/rules`, `/terms`, footer IP disclaimers, headers and a nonce CSP, login rate limiting, markdown XSS hardening, youtube-nocookie.
6. **Sep–Oct 2026** — Tournament-model games get brackets (spec-010); Player Onboarding & School Manager Portal (`/portal`, `/join/[schoolSlug]/[gameSlug]`, `spec-011`). Replaces external Google Forms with authenticated single-use invite workflows, Discord/Riot identity capture (self-reported; real verification is tracked in #247 and #249), FERPA-compliant demographic isolation (`Permissions.VIEW_STUDENT_DEMOGRAPHICS`), and live roster eligibility gates. The staff portal gets the Control Panel sidebar and UI overhaul (spec-012/013), then gallery thumbnails (spec-014) and the manager tour (spec-015/016).

Roster removal (spec-042): staff (Schools & Rosters trash icon) and school managers (portal roster card, with a confirmation that says only that it is permanent and cannot be undone, [spec-044](spec-044-short-delete-confirmations.md)) delete a player's roster spot, and the student's onboarding record too unless they are on another roster, staff, a manager, in the archive or have match history; the toast/notice says which happened.

[`docs/QUICKSTART.md`](../docs/QUICKSTART.md) covers local setup and where things live; this file is the route and surface map.

