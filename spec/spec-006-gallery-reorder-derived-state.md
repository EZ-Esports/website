# spec-006: Gallery Reorder Derived State & Full-List Advisory Locking

- **Status:** Shipped
- **PR:** #183 (#154)
- **Date:** 2026-09-25
- **Scope:** `app/components/admin/GalleryManagerClient.tsx`, `app/(admin)/admin/gallery/actions.ts`, `app/components/admin/__tests__/GalleryManagerClient.test.tsx`, `app/(admin)/admin/gallery/__tests__/actions.test.ts`

## Context & Motivation

In the staff gallery management console (`/admin/gallery`), reordering gallery image cards suffered from field desynchronization and race conditions (Audit Item ADMIN-4):
1. **Dual Source-of-Truth Bug**: `GalleryManagerClient.tsx` stored a duplicate copy of the image list in React state (`const [images, setImages] = useState(initialImages)`), attempting to synchronize it with incoming server props via a 30-line `useEffect`. When an image's caption or active status changed or the server revalidated, the duplicated state drifted, causing captions, schools, and event names to detach from the moved cards.
2. **Missing Concurrency Protection on Reordering**: The `updateGalleryImagesOrder` server action did not acquire an advisory lock, allowing concurrent reordering requests to interleave.
3. **Acceptance of Partial/Stale ID Lists**: The action did not verify that the submitted order contained the complete, exact set of active gallery images. Submitting a partial list would leave omitted images with stale or duplicate `displayOrder` values.

## Design Decisions

1. **Derived Display State (`draftOrder: string[] | null`)**:
   - Completely eradicated duplicated `images` React state and the synchronization `useEffect` in `GalleryManagerClient.tsx`.
   - Stored only uncommitted ordering overrides: `draftOrder: string[] | null` (`null` when pristine, string array of IDs when dirty).
   - Derived the rendered list via pure helper `deriveDisplayImages(initialImages, draftOrder)`:
     - Iterates through `draftOrder`, looking up images from server props `initialImages`.
     - Appends any newly created server images not in `draftOrder`.
     - Drops any deleted images no longer in `initialImages`.
   - On save success or "Discard" (`handleReset`), resets `draftOrder` to `null`, instantly snapping to authoritative server state.

2. **Full-ID Set Invariant & Advisory Lock (`updateGalleryImagesOrder`)**:
   - Acquired transaction-scoped advisory lock `pg_advisory_xact_lock(hashtext('gallery_images_display_order'))` inside the database transaction to serialize concurrent updates.
   - Fetched all active non-deleted image IDs from the database and validated the payload:
     - `orderedIds.length === currentImages.length`
     - `new Set(orderedIds).size === orderedIds.length` (no duplicates)
     - `orderedIds.every((id) => currentIdSet.has(id))` (no unknown or deleted IDs)
   - Rejects partial or stale lists fail-closed with: `"Image list is out of date or invalid. Please refresh and try again."`
   - Assigns sequential 1-based `displayOrder` (`i + 1`) to every active image in the transaction.

3. **Pure Movement & Transition Guard (`canMoveItem`)**:
   - Extracted movement logic and transition guards into pure testable helpers (`moveItem`, `canMoveItem`).
   - Disables card shifting while a save transition is in flight (`pending === true`) or when moving out of bounds.

## Invariants & Boundaries

- The client MUST NOT maintain a duplicate state of server image objects. Only uncommitted draft ID permutations may be held in component state.
- Gallery reordering MUST update the full set of non-deleted gallery images in a single atomic transaction.
- Reorder operations MUST acquire `pg_advisory_xact_lock(hashtext('gallery_images_display_order'))` to serialize competing staff edits.
- Stale or partial ID payloads MUST be rejected without modifying database records.

## Verification

- Component & derived-state test suite: `npx vitest run app/components/admin/__tests__/GalleryManagerClient.test.tsx` (13 tests covering moveItem, deriveDisplayImages, canMoveItem guard, and save-success reset).
- Action & advisory lock test suite: `npx vitest run app/(admin)/admin/gallery/__tests__/actions.test.ts` (8 tests covering permission, advisory locking, partial/duplicate ID rejection, and sequential ordering).
- Full Vitest suite: `npm test`
- TypeScript compilation: `npx tsc --noEmit`
- Linter: `npm run lint`
- Production build: `npm run build`
