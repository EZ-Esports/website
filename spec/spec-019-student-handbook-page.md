# Spec-019: Student Handbook page

**Branch:** `worktree-student-handbook-page`. **PR:** not opened. **Status:** Code ready. No migration. Needs the existing `admin-uploads` bucket and `NEXT_PUBLIC_SUPABASE_URL` (both already live for gallery images).

## Context & Motivation

Leadership publishes a yearly Student Handbook (key links, games, the three communities, the season timeline, the #1 rule) as a Google Doc and an interactive HTML pamphlet. Students had no page on the site for it. Staff edit the doc and export a PDF, so the site needs a public page that shows that PDF, plus a way for staff to swap it without a deploy.

## Design Decisions

- **Route `/handbook`**, a normal marketing page (nav up top, Hero, `Section`). Linked from the **footer only** (`FOOTER_LINKS`, "Student Handbook"); the top nav is unchanged. Added to `ROUTES`, `HERO_ROUTES` (transparent header over the Hero) and the sitemap.
- **Two sources, one page.** The page always has a built-in text version (`app/lib/handbook-content.ts`, converted from the pamphlet's seven pages, Oct 18 2026 edition). Staff-uploaded PDF present: the PDF leads (Open PDF, Download PDF, inline `<iframe>` viewer, fallback links) and the text version collapses into a `<details>` labelled as possibly older than the PDF. No PDF (or CMS read fails): the text version is the page, with a Google Docs link. The text version is also what search engines, screen readers and phones (which often show only page one of an embedded PDF) get.
- **No schema change.** The PDF's storage key is one `page_content` row, key `handbook_pdf`, created by an upsert (`setHandbookPdfKey`), so no seed or migration is needed for it to exist. `/admin/content` filters that row out of the text-block list; `savePageContentWithHistory` refuses to edit it as free text.
- **Upload flow mirrors gallery images.** Step 1, `POST /api/handbook` (MANAGE_CONTENT, 10 per minute per IP, `%PDF-` magic-byte check, PDF-only, 4 MB cap, public `admin-uploads` bucket, key `handbook/<timestamp>.pdf`). Step 2, server action `saveHandbookPdf(storageKey)` (MANAGE_CONTENT) re-validates the key against the exact generated shape (`isHandbookStorageKey`), upserts the row, calls `updateTag('page-content')`, revalidates `/admin/content` and `/handbook`, then best-effort deletes the superseded object. A failed save leaves the old handbook live.
- **4 MB cap** because the multipart request must fit Vercel's 4.5 MB body limit (same reasoning as resumes, spec-007). A larger PDF needs a signed direct-to-storage upload; not built.
- **CSP:** `frame-src` gains `https://*.supabase.co` so the viewer can load the public bucket object. `object-src 'none'` is unchanged, so the viewer is an `<iframe>`, not `<object>`.
- **Cache:** `getCachedHandbookPdfKey` uses the existing `page-content` tag; no new tag.

## Invariants & Boundaries

- Only keys matching `^handbook/\d{10,16}\.pdf$` are ever stored or rendered; the public URL is built server-side from the project URL, bucket and key.
- The fallback text is code, not CMS: refreshing it means editing `handbook-content.ts`. Staff-facing edits are PDF only. A removal button is not built (replace only).
- The source pamphlet repeats Operations' description under Game Regulations; the page lists Game Regulations without a description rather than copying the duplicate. Confirm the intended text with leadership.
- Non-goals: page-by-page viewer, search, per-game handbooks (Valorant and LoL handbooks are sent by email), versioned PDF history.

## Verification

- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (new: `app/lib/__tests__/handbook.test.ts`, `app/api/handbook/__tests__/route.test.ts`, `app/(admin)/admin/content/__tests__/handbook-actions.test.ts`, `app/(marketing)/handbook/__tests__/page.test.tsx`; CSP test updated).
- Visual: `/handbook` with no `DATABASE_URL` renders the text version and the footer link. With a PDF uploaded, check the iframe renders (Supabase serves the object cross-origin; confirm its response headers allow framing) and that Download works.
