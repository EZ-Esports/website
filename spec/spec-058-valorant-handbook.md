# spec-058: Public Valorant Handbook

**Spec ID:** spec-058
**Title:** Public Valorant Handbook
**Status:** Proposed
**PR / Commit:** this branch (`docs/valorant-handbook`). No page yet.
**Date:** 2026-11-03
**Scope:** Proposal only. No route, no copy, no screenshots, no migration.

## Context & Motivation

The 2026-27 Student Handbook (`/handbook`, [spec-021](spec-021-student-handbook-page.md)) tells approved Valorant club leaders that between 27 Oct and 3 Nov 2026 they will receive an email containing the Valorant Handbook: the logistics, guidelines, expectations, and code of conduct for Interschool Valorant. Spec-021 lists per-game handbooks sent by email as a non-goal of that pamphlet page.

That email is the only copy. A student who is not a club officer cannot read how to play, how a match day works, or how to observe. The page that should fix that is a public, step-by-step Valorant Handbook with a screenshot on each step, so anyone can follow it.

The source document is not in the repo and not on the site. This spec does not invent it.

## Design Decisions

Build this later, on its own, after the source document (the email, Google Doc, or PDF that went to club leaders) is in hand.

- **Route `/valorant/handbook`.** A normal marketing page, public, no login. Linked from the Valorant hub bar (Handbook, Valorant only) and from the footer. Listed in `ROUTES` and the sitemap. One `h1`.
- **Not the pamphlet viewer.** `/handbook` stays the yearly Student Handbook (PDF page-flip). This page is a different document: numbered steps, one instruction and one figure each. Do not upload the Valorant Handbook as a replacement for the Student Handbook PDF.
- **Three sections, in this order.** The visitor's job is to follow a Valorant season without already being on staff.
  1. **Observe a match.** How a student watches from the public client: custom game, the two observer slots, and how everyone else watches when those slots are full. Competitive and Unrated matches cannot be spectated from inside the client.
  2. **Match-day rules.** Only rules the source document actually states (map veto, pauses, roster lock, reporting, and anything else it includes). Each step cites that document. Where the published league rulebook at `/rules` already states the same rule, link to the section instead of rewriting it.
  3. **Read the Valorant pages.** How to open Overview, Schedule (Eastern Time), Standings, Teams & Rosters, and Archives. Screenshots are of those pages on this site.
- **Figures.** Site screenshots are captures of this site. Client figures are captures of the real Valorant client, or a labeled lobby diagram when a capture does not exist yet. Do not draw a fake client and present it as a screenshot.
- **No new table.** Static page, same shape as `/rules`. Staff can replace the source later; a CMS upload is out of scope for the first version.

## Invariants & Boundaries

- Do not publish a map pool, veto order, series length, pause limit, or roster-lock rule that is not in the source document or already in `/rules`. The league rulebook does not define a Valorant map veto. Absence is not permission to fill one in.
- Valorant only. League of Legends and the other titles keep their own handbooks off this page.
- Do not put student PII, Discord handles, or school emails in the page or its screenshots.
- This PR is the proposal. It does not add the route.

## Verification

Docs only. No tests, no browser check, no migration. When the page is built, the follow-up PR walks the three sections on desktop and a phone, and checks that every match-day rule on the page appears in the source document or in `/rules`.
