# Specification: Codebase Quality Audit (2026-09-13)

**Status**: Ready for Implementation  
**Target Path**: `specs/codebase-quality-audit.md`  
**Related Components**: whole tree at `926b978` (auth, db, admin CMS, marketing, UI primitives, game domain, apply/forms, architecture). Code is **not** changed in this PR; follow-up work is the GitHub issues in §4.

---

## 0. Spec History / Revision Note

This spec is the history artifact for an orchestrated full-tree review: find slop, bad logic, architecture drift, and code habits on `origin/main` at `926b978`, worktree `docs/codebase-quality-audit`. Eight scoped Grok 4.6 reviews ran independently (auth, db, admin, marketing, UI, game domain, forms, architecture). A synthesis pass deduplicated overlapping IDs, grouped findings into PR-sized GitHub issues, and replaced the unsorted dump `specs/_audit-raw-findings.md`.

This revision files issues only. It does **not** implement fixes, open a product PR beyond this spec, run seeds/migrations, or read `.env`.

Reviewer transcripts (for agents that need the raw pass): Auth `548fc432-4007-4e7d-969d-552c473ac201`, DB `8904db08-8d8c-4f18-a2d5-b794dbd3aacc`, Admin `696b2762-5e63-45b4-8873-d945417849ce`, Marketing `ded00e32-349f-4e50-b2e8-f40de6a82236`, UI `caa3edf7-b231-48c0-86f4-8fc8edbb8470`, Game `15036fa8-7feb-4f90-a1b5-5e1d6e83315f`, Forms `bc05bbbc-2120-472c-803c-2e5d4c513143`, Architecture `10918b5b-0fd4-46a8-9d75-7971ce008366`.

---

## 1. Overview & Objectives

The site is past "make it exist" and into "the CMS save, the public page, and the database must tell the same story." The reviews found user-visible wrong results (matches vanishing from the calendar, kickoffs four hours early, View Live 404s), security gaps (spoofable apply rate limit, login `?error=` reflector, client-trusted storage keys, member PII in the leadership picker), and cache/invalidation drift that CLAUDE.md still describes as solved.

### Key Goals

1. **Record the audit** so later agents do not re-review the same tree from scratch or "fix" conventions that are working.
2. **Ship follow-ups as PR-sized issues**, not one issue per raw finding and not two mega-epics. `queries.ts` is not its own rewrite; notes land on the division and cache issues.
3. **Prefer user-visible / data-loss / security work first** (implementation order in §7).
4. **Do not duplicate open work** (#136, #135, #127, #126, #115, #114, #112, #109, #107, #106, #104, #103, #100). Privacy-policy copy gaps link [#115](https://github.com/EZ-Esports/website/issues/115) rather than competing as a second legal master. School apply field parity stays on [#127](https://github.com/EZ-Esports/website/issues/127).

### Non-Goals

- Implementing any finding in this branch.
- Re-filing merged work (#134/#113 markdown XSS, #122 TETR.IO rebrand, #118 sponsor marquee, #111 security headers, #105 rules page, backup series #81–#89).
- Filing against habits worth keeping (§6).
- A `queries.ts` god-file rewrite epic (DB-6 is a note on [#143](https://github.com/EZ-Esports/website/issues/143) and [#144](https://github.com/EZ-Esports/website/issues/144)).

---

## 2. How Reviews Were Scoped

Each reviewer saw the same commit (`926b978`) and was told not to re-file the open/merged issues in §5. Scopes:

| Scope | Mandate |
|---|---|
| **Auth** | RBAC, invite tokens, login, rate limits, PII in staff UIs. |
| **DB** | Schema, seeds, migrate/push gates, cache tags, query filters. |
| **Admin** | CMS actions, gallery/news/matches/leadership, upload trust. |
| **Marketing** | Public pages, copy vs hub, calendar, sitemap/canonical host, empty states. |
| **UI** | Overlay/button/field primitives, motion, filters, dead exports. |
| **Game** | Seasons, standings snapshots, division identity, slugify vs `GAME_SLUGS`. |
| **Forms** | School/staff apply APIs, CSV, double-submit, application status. |
| **Architecture** | `server-only`, worktrees/hooks, tests-as-theater, split-brain reads, error contract. |

---

## 3. Dedup Method

Raw IDs were kept when they named a distinct failure. Duplicates were absorbed into one issue:

- Division leftover = DB-2 = MKT-1 = GAME-1 (plus ADMIN-4 explorer/form, MKT-12/GAME-7 snapshot `0-0`, GAME-10 tests, GAME-9 slugs).
- Cache invalidation = ADMIN-1 = ARCH-1 (plus DB-4 missing tags, MKT-2/ARCH-2 split-brain reads).
- Leadership PII picker = AUTH-2 = ADMIN-8; ADMIN-9 split (`classifyRole` → leadership, reorder lock → gallery).
- Login reflector = AUTH-4 = MKT-11 reflector only; remaining MKT-11 privacy copy → #115.
- Reduced motion = UI-6 = MKT-8 = ARCH-12 (plus MKT-14 unused Hero parallax).
- Public empty/error honesty = MKT-5 = ARCH-4.
- Production script holes = DB-3 = ARCH-9 (`seed-phase2`).

---

## 4. Filed Issues (PR-sized groups)

Eighteen issues on [EZ-Esports/website](https://github.com/EZ-Esports/website). Each body starts with the audit pointer (`docs/codebase-quality-audit` @ `926b978`).

### 4.1 User-visible / data-loss / security — `priority: high`

| Issue | Title | Labels | Raw IDs absorbed |
|---|---|---|---|
| [#143](https://github.com/EZ-Esports/website/issues/143) | fix(schedule): canonicalize division filters so A/B and cross-division matches appear | `bug`, `priority: high` | DB-2, ADMIN-4, MKT-1, GAME-1, MKT-12, GAME-7, GAME-10, GAME-9; DB-6 note |
| [#144](https://github.com/EZ-Esports/website/issues/144) | fix(cache): use Next 16 updateTag so CMS saves invalidate public pages | `bug`, `priority: high` | ADMIN-1, ARCH-1, DB-4, MKT-2, ARCH-2; DB-6 note |
| [#145](https://github.com/EZ-Esports/website/issues/145) | fix(leadership): seed people/terms, stop member-PII picker, fix same-year merge | `bug`, `priority: high` | DB-1, DB-8, DB-11, AUTH-2, ADMIN-8, ADMIN-9 (`classifyRole`) |
| [#146](https://github.com/EZ-Esports/website/issues/146) | fix(db): gate migrate/push/backfill/phase-2 against production and stop UUID-churn seed | `bug`, `priority: high` | DB-3, DB-9, ARCH-9, DB-10 |
| [#147](https://github.com/EZ-Esports/website/issues/147) | fix(marketing): stop swallowing fetch errors and fabricating About / game copy | `bug`, `priority: high` | MKT-5, ARCH-4, MKT-10, MKT-6, MKT-13 |
| [#148](https://github.com/EZ-Esports/website/issues/148) | fix(schedule): Eastern kickoff, calendar timezone, and forfeit/draw status | `bug`, `priority: high` | MKT-3, MKT-4, GAME-4, GAME-8 |
| [#149](https://github.com/EZ-Esports/website/issues/149) | fix(standings): snapshot vs computed table, one active season, standings_format | `bug`, `priority: high` | GAME-2, GAME-3, DB-7, GAME-5, GAME-6, DB-5, ADMIN-7 |
| [#150](https://github.com/EZ-Esports/website/issues/150) | fix(apply): server-validate applications, keep staff essays, lock double-submit | `bug`, `priority: high` | FORM-1, FORM-2, FORM-4, FORM-5, FORM-6, FORM-7 |
| [#151](https://github.com/EZ-Esports/website/issues/151) | fix(security): apply rate-limit must not trust X-Forwarded-For | `bug`, `priority: high` | AUTH-3 |
| [#152](https://github.com/EZ-Esports/website/issues/152) | fix(uploads): stop trusting client storage keys for admin-uploads deletes | `bug`, `priority: high` | ADMIN-3 |
| [#153](https://github.com/EZ-Esports/website/issues/153) | fix(news): View Live 404s because admin links slug and public route is id | `bug`, `priority: high` | ADMIN-5 |
| [#154](https://github.com/EZ-Esports/website/issues/154) | fix(gallery): keep card fields in sync after reorder and lock the full id list | `bug`, `priority: high` | ADMIN-2, ADMIN-9 (reorder) |

### 4.2 Hardening / a11y / hygiene — `priority: medium`

| Issue | Title | Labels | Raw IDs absorbed |
|---|---|---|---|
| [#155](https://github.com/EZ-Esports/website/issues/155) | fix(login): stop reflecting attacker-controlled `?error=` text | `bug`, `priority: medium` | AUTH-4, MKT-11 (reflector only) |
| [#156](https://github.com/EZ-Esports/website/issues/156) | fix(auth): re-read staff roles under lock before assign, edit, or revoke | `bug`, `priority: medium` | AUTH-1 |
| [#157](https://github.com/EZ-Esports/website/issues/157) | fix(a11y): overlay primitives for nav/calendar and honor reduced motion | `bug`, `priority: medium` | UI-1, UI-2, MKT-7, UI-6, MKT-8, ARCH-12, MKT-14, MKT-9 |
| [#158](https://github.com/EZ-Esports/website/issues/158) | refactor(ui): one Button, one Field, and URL-backed filters | `enhancement`, `priority: medium` | UI-3, UI-4, UI-5, UI-8, UI-7, ARCH-11 |
| [#159](https://github.com/EZ-Esports/website/issues/159) | fix(admin): mutation errors must not look like success; application status machine | `bug`, `priority: medium` | ADMIN-6, ARCH-5, UI-9, FORM-3, FORM-9 |
| [#160](https://github.com/EZ-Esports/website/issues/160) | refactor(tooling): worktree-safe hooks, tests that assert the real subject, server-only on db | `enhancement`, `priority: medium` | ARCH-8, ARCH-7, FORM-8, ARCH-6, ARCH-10, ARCH-3 |

School apply **legal/UX** (consent links, checkbox split) remains [#127](https://github.com/EZ-Esports/website/issues/127). Staff API validation, essay drop, `.join` crash, and double-submit are [#150](https://github.com/EZ-Esports/website/issues/150). Apply rate-limit spoofing is [#151](https://github.com/EZ-Esports/website/issues/151), distinct from login limiter [#112](https://github.com/EZ-Esports/website/issues/112).

---

## 5. Out of Scope / Already Filed

Do not re-open or compete with these.

### 5.1 Open issues (do not duplicate)

| Issue | Why the audit stayed off it |
|---|---|
| [#136](https://github.com/EZ-Esports/website/issues/136) | Marketing nav sibling highlight. Game subnav Teams ([#157](https://github.com/EZ-Esports/website/issues/157) / MKT-9) is a different component. |
| [#135](https://github.com/EZ-Esports/website/issues/135) | Nonce CSP. |
| [#127](https://github.com/EZ-Esports/website/issues/127) | School apply legal/UX and school field parity. |
| [#126](https://github.com/EZ-Esports/website/issues/126) | TETR.IO results (data). |
| [#115](https://github.com/EZ-Esports/website/issues/115) | Legal/privacy **master**. MKT-11 copy gaps (Discord, grad year, public full names, YouTube/Analytics) belong here — not a second privacy epic. |
| [#114](https://github.com/EZ-Esports/website/issues/114) | Advisor roster RBAC (on-hold). |
| [#112](https://github.com/EZ-Esports/website/issues/112) | Login rate limit. Apply limiter is [#151](https://github.com/EZ-Esports/website/issues/151). |
| [#109](https://github.com/EZ-Esports/website/issues/109) | Parental media (on-hold). |
| [#107](https://github.com/EZ-Esports/website/issues/107) | Consent hyperlinks. |
| [#106](https://github.com/EZ-Esports/website/issues/106) | Parents bill of rights (on-hold). |
| [#104](https://github.com/EZ-Esports/website/issues/104) | ToS (on-hold). |
| [#103](https://github.com/EZ-Esports/website/issues/103) | Privacy erasure. |
| [#100](https://github.com/EZ-Esports/website/issues/100) | View full gallery. MediaGrid reduced-motion/tab-stops are [#157](https://github.com/EZ-Esports/website/issues/157). |

### 5.2 Merged on this tree (do not re-open)

#134 / #113 markdown XSS; #122 TETR.IO rebrand; #118 sponsor marquee; #111 security headers; #105 rules page; backup series #81–#89.

UI-7 (shared markdown renderer, unlabeled admin editor, `#` → second `h1`) is leftover **after** XSS landing — filed under [#158](https://github.com/EZ-Esports/website/issues/158), not as a rehash of #134.

### 5.3 Deliberately not filed as their own issues

| Item | Why |
|---|---|
| Habits worth keeping (raw findings footer) | §6 — later agents must not "fix" them. |
| `queries.ts` rewrite (DB-6) | Note on [#143](https://github.com/EZ-Esports/website/issues/143) / [#144](https://github.com/EZ-Esports/website/issues/144): extract match-join / tagged-read helpers if those PRs already touch the functions. |
| Privacy page vs practice (rest of MKT-11) | Link [#115](https://github.com/EZ-Esports/website/issues/115). Login reflector is the only extra bug ([#155](https://github.com/EZ-Esports/website/issues/155)). |
| Apply as a 1590-line island (part of ARCH-11) | Field adoption may split pieces in [#158](https://github.com/EZ-Esports/website/issues/158); not a rewrite epic. Shared apply helpers only as needed for [#150](https://github.com/EZ-Esports/website/issues/150). |
| School apply honeypot / draft persistence / confirmation email | Already in #127's "audit other missing pieces" list. |

---

## 6. Habits Worth Keeping

Do not file "fixes" against these; extend them.

- **Admin vs marketing ESLint import fence** — keep it; extend to `app/lib/db/schema` rather than dropping it ([#160](https://github.com/EZ-Esports/website/issues/160) adds `server-only` + the schema fence).
- **`proxy.ts` + layout as the real `/admin` gate** — not authorization inside proxy.
- **Game-hub 308s in `next.config.ts`**, not `redirect()` in a streaming page.
- **`match-page.ts` has no db/next imports**; hub tests assert generated SQL.
- **Seed remote gate in `db/seed-target.ts` (fail closed).** Treat `seed-phase2` as the hole ([#146](https://github.com/EZ-Esports/website/issues/146)), not the gate as permission to hit production.
- **Game hub empty states refuse fabricated standings** — mirror that on About/news ([#147](https://github.com/EZ-Esports/website/issues/147)).

Checked clean in the auth pass (do not churn): invite tokens, revocation tombstones, page vs action RBAC pairing, membership RLS, public marketing not selecting member email/discord, Next 16 proxy conventions.

Checked clean in the db pass: gold seed upsert, seed-target fail-closed, combined-standings hub path, application append-only trigger listing `details`, `leadership.member_id` SET NULL, backup marker checks.

---

## 7. Implementation Order

High-priority user-visible and security first. Issues in a group can proceed in parallel if they do not touch the same files; otherwise serialize.

1. **[#148](https://github.com/EZ-Esports/website/issues/148) schedule TZ / forfeit DTO** and **[#143](https://github.com/EZ-Esports/website/issues/143) division canonicalization** — public calendar is wrong today. Do 148 before rewriting GAME-10 fixtures that both PRs may share; 143 owns slug/`GAME_SLUGS` and the `jv`/`A` test lies.
2. **[#144](https://github.com/EZ-Esports/website/issues/144) cache `updateTag`** — otherwise CMS "fixes" from later PRs will not show. Standings tag gaps overlap [#149](https://github.com/EZ-Esports/website/issues/149); land 144's invalidation helper first, then 149's snapshot/active-season logic.
3. **[#153](https://github.com/EZ-Esports/website/issues/153) news View Live** — small, user-visible 404; safe to ship immediately.
4. **[#147](https://github.com/EZ-Esports/website/issues/147) honest empty states / copy / canonical host** — About fabricated stats and swallowed errors.
5. **[#151](https://github.com/EZ-Esports/website/issues/151) apply rate-limit**, **[#155](https://github.com/EZ-Esports/website/issues/155) login `?error=`**, **[#152](https://github.com/EZ-Esports/website/issues/152) upload key trust**, **[#145](https://github.com/EZ-Esports/website/issues/145) leadership PII + people/terms seed** — security / PII / officers not appearing.
6. **[#150](https://github.com/EZ-Esports/website/issues/150) apply intake** (after or beside 151; do not redo #127 school field parity). **[#154](https://github.com/EZ-Esports/website/issues/154) gallery reorder**. **[#146](https://github.com/EZ-Esports/website/issues/146) production script gates** — do this before any seed/migrate work on later issues.
7. **[#149](https://github.com/EZ-Esports/website/issues/149) standings source of truth** (depends on 144 tags + 143 division identity).
8. Medium: **[#156](https://github.com/EZ-Esports/website/issues/156) role TOCTOU**, **[#159](https://github.com/EZ-Esports/website/issues/159) mutation errors / application status**, **[#157](https://github.com/EZ-Esports/website/issues/157) overlay + reduced motion**, **[#158](https://github.com/EZ-Esports/website/issues/158) Button/Field**, **[#160](https://github.com/EZ-Esports/website/issues/160) tooling**.

[#145](https://github.com/EZ-Esports/website/issues/145) leadership seed writes must not land until [#146](https://github.com/EZ-Esports/website/issues/146) gates `db/backfill-leadership.ts` / related scripts — or run them only against local Postgres with an explicit `DATABASE_URL`, never `.env` production.

---

## 8. Quality & Verification Gates (this spec PR)

- [x] Raw findings deduplicated into 12–18 GitHub issues (18 filed, #143–#160).
- [x] Each issue is one PR-sized unit with Context, Proposed Solution, Acceptance Criteria, a concrete failure scenario, and file paths.
- [x] Labels: `bug` or `enhancement` plus exactly one of `priority: high|medium|low`.
- [x] Open issues in §5.1 not duplicated; privacy copy points at #115; login reflector is its own issue.
- [x] `specs/_audit-raw-findings.md` removed so it is not committed.
- [ ] Implementers of #143–#160 run `npm run build` and `npm run test` on those PRs — not in this spec-only change.
