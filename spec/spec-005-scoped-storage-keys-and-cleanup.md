# spec-005: Scoped Storage Keys & Server-Derived Asset Cleanup

- **Status:** Shipped
- **PR:** #182 (#152)
- **Date:** 2026-09-25
- **Scope:** `app/api/upload/route.ts`, `app/lib/storage.ts`, `app/components/admin/ImageUpload.tsx`, `app/(admin)/admin/gallery/actions.ts`, `app/(admin)/admin/schools/actions.ts`, `app/(admin)/admin/sponsors/actions.ts`, `app/(admin)/admin/leadership/actions.ts`, `db/storage-clean.ts`, `app/lib/__tests__/image-upload.test.ts`, `app/lib/__tests__/storage-cleanup.test.ts`

## Context & Motivation

In the staff management console, image uploads (gallery photos, school crests, sponsor logos, and leadership headshots) previously suffered from security vulnerabilities and storage sprawl (Audit Item ADMIN-3):
1. **Client-Controlled Deletion Keys**: Server actions accepted and trusted raw storage keys sent by the client. A compromised or rogue staff account could pass arbitrary keys or path-traversal sequences (`../../`) to delete unrelated storage assets across other entities or sections.
2. **Unstructured Storage Hierarchy**: Assets were stored without strict per-entity folder prefixes, making it impossible to determine which database record owned which file.
3. **Orphaned Draft Uploads**: When an admin uploaded an image in a creation modal but abandoned the form without saving, the uploaded file remained permanently orphaned in Supabase Storage with no way to identify or clean it up.

## Design Decisions

1. **Section-Scoped RBAC & Path Sanitization (`app/api/upload/route.ts`, `app/lib/storage.ts`)**:
   - Mapped upload sections strictly to required permissions:
     - `gallery` $\rightarrow$ `Permissions.MANAGE_GALLERY`
     - `schools` $\rightarrow$ `Permissions.MANAGE_SCHOOLS`
     - `sponsors` $\rightarrow$ `Permissions.MANAGE_SPONSORS`
     - `leadership` $\rightarrow$ `Permissions.MANAGE_LEADERSHIP`
   - Sanitized all `entityId` inputs using `sanitizeEntityId()`, rejecting path traversal characters (`..`, `/`, `\`), control characters, and null bytes.
   - Enforced deterministic key formatting: `${section}/${entityId}/${timestamp}.${ext}`.

2. **Pre-Allocated Client Draft UUIDs (`ImageUpload.tsx`)**:
   - For entity creation flows where the database ID does not yet exist, `ImageUpload.tsx` generates a pre-allocated UUID (`crypto.randomUUID()`).
   - The file is uploaded directly into `${section}/${draftEntityId}/`.
   - The form passes `entityId` as a hidden input so the server action inserts the new row using that identical ID.

3. **Server-Derived Cleanup (`cleanupEntityStorage`)**:
   - All server actions (`gallery/actions.ts`, `schools/actions.ts`, `sponsors/actions.ts`, `leadership/actions.ts`) completely disregard client-provided deletion keys.
   - On entity updates or replacements, `cleanupEntityStorage(section, entityId, keepStorageKey)` lists the entity's storage folder (`${section}/${entityId}/`) via the Supabase service role client and deletes any unreferenced files.
   - On row deletion, the entire `${section}/${entityId}/` directory is purged.

4. **Companion Abandoned Storage Cleaner (`db/storage-clean.ts`)**:
   - Added automated sweep script callable via `npm run db:storage:clean`.
   - Scans all 4 section directories in Supabase Storage, compares files against referenced URLs in the database, and deletes unreferenced files older than 24 hours.
   - The 24-hour safety buffer ensures active drafts currently being edited by admins are never prematurely deleted.
   - Includes `--dry-run` flag for pre-flight audits.

## Invariants & Boundaries

- The server MUST NOT trust client-supplied storage keys for deletion.
- Every uploaded asset MUST be stored under `${section}/${entityId}/${timestamp}.${ext}`.
- Storage cleanup MUST strictly scope deletion operations to the specific entity folder.
- Background cleanup routines MUST enforce a minimum 24-hour grace period before purging unreferenced assets.

## Verification

- Unit test suite: `npx vitest run app/lib/__tests__/image-upload.test.ts` (14 tests covering permissions, MIME types, key building, and traversal rejection).
- Cleanup test suite: `npx vitest run app/lib/__tests__/storage-cleanup.test.ts` (6 tests covering entity cleanup and abandoned storage sweep).
- Full Vitest suite: `npm test` (42 test files, 608 tests passing).
- TypeScript compilation: `npx tsc --noEmit`
- Linter: `npm run lint`
- Production build: `npm run build`
