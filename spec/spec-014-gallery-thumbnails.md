# spec-014: Gallery Thumbnails and Unoptimized Image Delivery

- **Status:** In Review
- **PR:** #220 (unoptimized restore, branch `fix/restore-unoptimized-images`) and a follow-up PR (thumbnails, branch `feat/gallery-thumbnails`)
- **Date:** 2026-10-12
- **Scope:** gallery photo storage, upload route, gallery admin actions, public marquee/grid/lightbox rendering, one additive migration (`0046`) and an unapplied backfill script.

## Context & Motivation

PR #202 (`70b8c7f`) routed every Supabase image through Vercel's `/_next/image`. On the free plan (5,000 transformations a month) each photo cost roughly 10-12 transformations across screen sizes, the quota ran out, and new transformations began failing with HTTP 402 (alt text instead of images). The first commit on this branch put `unoptimized` back, which fixed the outage but made every grid and marquee tile download the full (up to 2048px) file. Maintainer feedback on #220: keep a thumbnail next to each photo, show thumbnails in the marquee and grid, use the full-resolution picture for the large view. Decision: no gallery image goes through Vercel image transformation at all; the full file is fetched straight from Supabase, and only when a visitor opens a photo. #220 itself ships only the `unoptimized` restore; thumbnails are a separate PR so the outage fix is not blocked on a migration.

## Design Decisions

### 1. Two tiers, zero transformations

| Surface | File loaded | `unoptimized` | `/_next/image` |
|---|---|---|---|
| Homepage marquee (`MediaGrid`), `/gallery` grid (`GalleryGrid`), admin `GalleryImageCard` | thumbnail, else full image | yes | never |
| Lightbox in `MediaGrid` and `GalleryGrid` | full image | yes | never |

Browsing downloads ~25-60 KB thumbnails; opening a photo downloads the one full file, once, straight from Supabase (1-year `Cache-Control`). The lightbox mounts only while a photo is selected and renders a single image, so there is no adjacent-image preloading and nothing is `priority`. Rendering lives in `app/components/ui/GalleryImage.tsx`: `getThumbnailSrc()` is the single fallback rule (no thumbnail yields the full image, still unoptimized), and `GalleryThumbnail` / `GalleryLightboxImage` both set `unoptimized`. A source test fails if any gallery `<Image>` omits it.

### 2. Thumbnails are generated server-side with `sharp`, inside `/api/upload`

Chosen over client-side canvas because:
- **Atomic.** One request writes both objects; if the thumbnail upload fails the full-size object is removed (`removeFromStorage`) and the client gets a 500, so a photo never exists without its thumbnail by accident.
- **Trust boundary (#182).** The server derives the thumbnail key from the original's key (`deriveThumbnailKey`); the client never names a storage key. A second client-supplied blob would have needed its own key and size validation.
- **Content check for free.** Decoding with sharp rejects non-image bytes labelled `image/jpeg` before anything is written.
- One pure function (`generateThumbnail`, `app/lib/image-thumbnail.ts`) is shared with the backfill script, which has no browser.

`sharp` was already pinned in `overrides` (and is a Next optional dependency) but is now a direct dependency, with `serverExternalPackages` handling it by default. Only the `gallery` section produces thumbnails.

### 3. Thumbnail format

WebP, quality 80, longest edge 640px (fit inside, never upscaled, EXIF orientation applied). The widest grid card is about 320 CSS px, so 640 is sharp at 2x. Typical output is 25-60 KB against 300-800 KB originals. Animated sources (GIF, animated WebP) are skipped and keep the full file.

### 4. Keys and storage layout

`gallery/<id>/<ts>.<ext>` gets `gallery/<id>/<ts>_thumb.webp`, same folder, same `Cache-Control: 31536000`. Keeping it in the entity folder means the folder-scoped cleanup (`cleanupEntityStorage`, now accepting a list of keys to keep) removes the pair together on delete or replace, and `db/storage-clean.ts` treats `thumbnail_storage_key` as referenced so it is not purged as abandoned.

### 5. Schema

`gallery_images.thumbnail_url` and `thumbnail_storage_key`, both nullable text. Migration `db/migrations/0046_gallery_image_thumbnails.sql` (hand-written like `0043`-`0045`: the snapshots stop at `0042`, so `drizzle-kit generate` would re-emit later tables), `IF NOT EXISTS`, no backfill, journal entry idx 46. Existing RLS (`gallery_images_public_select`) is row-level, so the new columns need no policy.

### 6. Write path

`ImageUpload` posts `thumbnailUrl` / `thumbnailStorageKey` as hidden fields. `addGalleryImage` and `updateGalleryImage` pass them through `resolveGalleryThumbnail` (`app/lib/gallery-thumbnails.ts`): accepted only if the key equals `deriveThumbnailKey(storageKey)` inside the row's own folder and the URL equals the row's own `src` with that key swapped in (`deriveThumbnailUrl`: same origin and bucket path, so a foreign host is rejected); otherwise dropped to null. A caption-only edit keeps an existing thumbnail even if the form was opened before a backfill. Cache: both actions already call `updateTag('gallery-images')`, which covers `getCachedHomepageGallery` (now selecting `thumbnail_url`).

### 7. `next.config.ts` is untouched

`images` stays as on `main` (`remotePatterns` only). An earlier draft narrowed `deviceSizes`/`qualities`/`formats`/`minimumCacheTTL` to bound lightbox transformations; with no gallery transformations that is unnecessary and it would have changed the remaining optimized local images.

### 7a. Upload hardening

`/api/upload` inspects the bytes before writing anything (`inspectImage`, `app/lib/image-thumbnail.ts`), for every section: the decoded format must be jpeg/png/webp/gif (the declared MIME is client-controlled, so an SVG or TIFF labelled `image/png` is rejected), and sharp runs with `limitInputPixels` of 50 million so a small PNG declaring billions of pixels cannot exhaust function memory. Both cases return a clean 400.

### 7b. Migration not applied yet

The code degrades instead of erroring if `0046` has not run. `withThumbnailColumnFallback` (`app/lib/db/thumbnail-columns.ts`) runs the thumbnail-aware query and, only on Postgres `42703` naming a `thumbnail_*` column, retries without those columns: `getCachedHomepageGallery` (public marquee and `/gallery` show full-size images), the admin gallery list, and the add/update actions (saved without thumbnails). Any other error is rethrown. This is a safety net, not a plan: apply `0046` first. Caveat: `getCachedHomepageGallery` caches whatever it returned, so after applying the migration (and the backfill) save a gallery row to refresh `gallery-images`. `db/storage-clean.ts` and the backfill script still need the columns; they are operator tools run after the migration.

### 8. Backfill (`db/backfill-gallery-thumbnails.ts`, unapplied)

Dry run by default; `--apply` writes; `--bucket=admin-uploads` is required; needs `SEED_ALLOW_REMOTE=<db host>` plus `GALLERY_THUMBNAIL_BACKFILL_ALLOW=<storage host>` (accident brakes, not permission). Pure planning/guard/arg logic is in `db/gallery-thumbnails.ts` and unit tested. It only adds `_thumb.webp` objects and sets the two columns, skips rows that already have one, reuses an object left by an interrupted run, and its UPDATE only matches rows still lacking a thumbnail; a 0-row update (row changed mid-run) is reported as a conflict, not counted as written. It cannot purge the Data Cache: afterwards save any gallery row in `/admin/gallery`.

## Invariants & Boundaries

- All Supabase-hosted images are `unoptimized`, including the gallery lightbox. Do not add a `/_next/image` consumer without checking the monthly transformation budget.
- Thumbnails are never client-named: always `deriveThumbnailKey(storageKey)`, always in the row's own folder.
- A row with no thumbnail must render the full image unoptimized (fallback in `getThumbnailSrc` only).
- Out of scope, left unoptimized and without thumbnails: sponsor logos, leadership avatars (already tiny), game and hero images.
- Deploy order: merge #220 (restore `unoptimized`), apply migration `0046`, merge the thumbnails PR, then run the backfill. Reads and admin writes tolerate a missing migration (7b), but `storage-clean` and the backfill do not.
- Rows whose full image is not in their own `gallery/<id>/` folder (static `/images/gallery/*`, rows with no `storage_key`) are never given thumbnails.

## Verification

- `npx tsc --noEmit`, `npm run lint`.
- `npx vitest run app/lib/__tests__/image-thumbnail.test.ts app/lib/__tests__/gallery-thumbnails.test.ts app/lib/__tests__/media-gallery-sizes.test.tsx app/api/upload app/lib/db "app/(admin)/admin/gallery" db/__tests__/gallery-thumbnails.test.ts "app/(marketing)/gallery"`.
- Visual: open the homepage and `/gallery`; the network panel must show no `/_next/image` requests until a photo is opened, then one request for the full file straight from Supabase (never `/_next/image`).
