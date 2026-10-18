# Spec-019: Student Handbook page

**Branch:** `worktree-student-handbook-page`. **PR:** not opened. **Status:** Code ready. No migration. Needs the existing `admin-uploads` bucket and `NEXT_PUBLIC_SUPABASE_URL` (both already live for gallery images).

## Context & Motivation

Leadership publishes a yearly Student Handbook (key links, games, the three communities, the season timeline, the #1 rule) as a Google Doc and an interactive HTML pamphlet (a page-by-page viewer). Students had no page on the site for it. Staff edit the doc and export a PDF, so the site needs a public page that shows that PDF and a way for staff to swap it without a deploy.

## Design Decisions

- **Route `/handbook`**, a normal marketing page (site nav and footer unchanged, no Hero). Linked from the **footer only** (`FOOTER_LINKS`, "Student Handbook"); top nav unchanged. In `ROUTES` and the sitemap. Title is the bare "Student Handbook" (the layout template adds the site name). `export const revalidate = 60` so a DB failure (which renders the bundled pages) heals within a minute instead of freezing until a deploy.
- **Pamphlet-style viewer** (`app/components/handbook/HandbookViewer.tsx`, client): sidebar with a "Having trouble viewing? Open in Google Docs" button, chapter list, search with per-page results; toolbar with page counter, Prev/Next, zoom (Fit/125/150/200%) and a "Read as text" toggle; **one page at a time** that grows with zoom (the page scrolls, the panel does not); page-number dots; mobile "Contents & search" toggle; print styles. Styled with site tokens. The panel behind the page is **light** (`VIEWER_BACKDROP`, `bg-[#e9e6e6]`, a single constant to change) with the white page separated by shadow and ring. Pure logic is in `app/lib/handbook-viewer.ts` and tested.
- **Navigation:** left/right arrow keys; tap/click the outer 15% page-edge zones (aria-hidden, under the link boxes so links still win; no text layer to select); horizontal swipe on touch (quick, mostly sideways, single finger, ignored while pinch-zoomed or horizontally scrollable). The counter, Prev/Next, zoom and text toggle sit in a `sticky top-[88px]` bar under the site nav.
- **URL hash:** the current page is `#page-N`. Read on load (and again when a PDF's page count is known), written with `replaceState` on navigation (one history entry per page turn would bury Back), and followed on `hashchange`. Sheets use ids `handbook-page-N` so the browser does not scroll-jump to the hash. Internal link boxes route through the same navigation.
- **Phones:** viewports 767 px and narrower fit the page to the width (the zoom menu's first option reads "Fit width"); larger screens fit the whole page on screen. No `touch-action` override, so pinch-zoom works.
- **Accessibility:** "Skip to the handbook" link; a polite live region announces "Page N of M" on page change (the visible counter is not live); "Read as text" is an `aria-pressed` toggle that moves focus into the text article; animations are `motion-safe`, smooth scrolling is skipped under `prefers-reduced-motion`.
- **Read as text:** headings, paragraphs and lists rebuilt from the extracted text (`structureHandbookText`: known section headings, bullet glyphs, page numbers) with the pamphlet's link labels linkified (`linkifyText`, safe schemes only). Bundled pages use `BUNDLED_TEXT_HEADINGS`; a PDF uses its outline titles as headings. The extraction has no layout, so unbulleted runs (e.g. the Key Links list) read as one paragraph.
- **Two page sources, one viewer.**
  - **Staff PDF uploaded:** rendered in the browser with **pdf.js** (`pdfjs-dist` 6.3.289, dynamically imported by `app/lib/handbook-pdf.ts`, same-origin worker emitted by the bundler). Each page is a canvas; Link annotations become overlay boxes (http/https/mailto plus in-document jumps); `getTextContent` feeds search; the PDF outline, when present, becomes the chapter list.
  - **No PDF, DB read failure, or pdf.js failure:** the bundled pamphlet pages. The seven designed pages are JPEGs under `public/handbook/` (1224 px wide, about 1.2 MB total), with the pamphlet's link boxes, extracted text and chapter list in `app/lib/handbook-pages.ts`. When an uploaded PDF fails to load a notice explains and links to "Open the PDF directly".
  - The earlier iframe viewer was removed: the site's `frame-ancestors 'none'` / `X-Frame-Options: DENY` blocks framing PDFs, so it rendered blank.
- **Open PDF / Download PDF** buttons appear only when a PDF exists. Download adds Supabase's `?download=<filename>` so it saves instead of navigating.
- **CSP:** pdf.js fetches the PDF from Supabase under the existing `connect-src https://*.supabase.co`. Added `worker-src 'self' blob:` (explicit, because `strict-dynamic` makes the `script-src` fallback unreliable for workers). `frame-src` is unchanged. Requires the Supabase public bucket to answer cross-origin GETs (it sends permissive CORS).
- **Link safety:** link targets from the pamphlet data and from PDF annotations are untrusted; only `http(s):` and `mailto:` render (`resolveHandbookLink`). http(s) open in a new tab with `noopener noreferrer`; mailto does not open a tab.
- **No schema change.** The PDF's storage key is one `page_content` row, key `handbook_pdf`, created by an upsert (`setHandbookPdfKey`). `/admin/content` filters that row out of the text-block list and `savePageContentWithHistory` refuses to edit it as free text.
- **Upload flow mirrors gallery images.** `POST /api/handbook` (MANAGE_CONTENT, 10 per minute per IP, `%PDF-` magic bytes, PDF only, 4 MB cap, public `admin-uploads` bucket, key `handbook/<timestamp>.pdf`), then server action `saveHandbookPdf(storageKey)` (MANAGE_CONTENT) re-validates the key shape (`isHandbookStorageKey`), upserts the row, `updateTag('page-content')`, revalidates `/admin/content` and `/handbook`, and best-effort deletes the superseded object. A failed save leaves the old handbook live. 4 MB because the multipart request must fit Vercel's 4.5 MB body limit.

## Invariants & Boundaries

- Only keys matching `^handbook/\d{10,16}\.pdf$` are stored or rendered; the public URL is built server-side from project URL, bucket and key.
- The bundled pages are the 2026-27 edition as designed (images are the source of truth, including the pamphlet's wording under Game Regulations). They go stale each season; refresh by replacing `public/handbook/page-N.jpg` and `handbook-pages.ts`, or just upload a PDF.
- No "remove PDF" control (replace only). PDFs over 4 MB are not supported.
- pdf.js standard-font and CMap data are not bundled: a PDF that relies on non-embedded standard fonts may render with substitute fonts. Exports from Google Docs embed fonts.
- Non-goals: per-game handbooks (sent by email), versioned PDF history, server-side PDF rendering.

## Verification

- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (new/updated: `handbook.test.ts`, `handbook-viewer.test.ts`, `api/handbook/__tests__/route.test.ts`, `admin/content/__tests__/handbook-actions.test.ts`, `(marketing)/handbook/__tests__/page.test.tsx`, `csp.test.ts`).
- Dev server: `/handbook` renders the bundled pages (hash load, edge zones, synthetic swipes, text view, fit-width at 375 px); with a temporary local sample PDF the pdf.js path rendered canvas pages, a link overlay and per-page search; pointing at a missing file showed the failure notice and bundled pages. The temporary override and sample file were removed before commit.
- Not verified: a real upload through Supabase (CORS for pdf.js, `?download=` behavior) in production.
