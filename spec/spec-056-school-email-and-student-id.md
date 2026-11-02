# spec-056: School email and student ID photo in onboarding

- **Spec ID:** spec-056
- **Title:** Typed `@nycstudents.net` school email plus a staff-reviewed student ID photo, for players and managers
- **Status:** Implemented on branch `worktree-school-email-student-id`, unmerged. Migration `0058` written, NOT applied anywhere. Nothing here has touched production.
- **Date:** 2026-11-02
- **DEPLOY ORDER (required):** apply migration `0058` BEFORE deploying this code, and make sure the private `student-ids` bucket exists. The code does not degrade gracefully without them: the staff roster pages select `members.school_email`, every submission writes it, and uploads need the bucket. A missing table or column fails loudly rather than being hidden.
- **Background:** issue #326 (closed). Google sign-in cannot verify a `nycstudents.net` address because NYCPS blocks it, so verification is a typed, strictly validated school email that staff compare with an uploaded student ID.
- **Builds on:** [spec-033](spec-033-discord-oauth-onboarding.md) / [spec-035](spec-035-manager-discord-oauth.md) (rejection-by-result-object, signed identity), [spec-036](spec-036-onboarding-test-data-purge.md) / [spec-042](spec-042-roster-removal-orphan-cleanup.md) (deletion flows), [spec-007](spec-007-staff-application-resume.md) (the private-bucket + signed-URL precedent this copies), [spec-051](spec-051-google-form-onboarding.md).

## What changed for the person onboarding

Step 1 (Student/Manager Information, same stepper, no new step) now has:

1. **Personal Email Address** (the old single email, relabelled). Managers still sign in to the portal with it.
2. **School Email (must end in @nycstudents.net)**, required.
3. **Photo of Your Student ID**, required. Uploaded the moment it is chosen (browser shrinks it first with the existing `compressImage`), then the wizard only remembers "uploaded".

Nobody had been onboarded yet, so there is no backfill and the columns are nullable only for archive and admin-created members.

## School email rules (`app/lib/onboarding/school-email.ts`)

Trim, lower-case, at most 254 characters, one local part with no `@`, whitespace or control characters (NUL included, so bad input is `school_email_invalid` instead of a Postgres error; the personal email gets the same length/control checks),  then exactly `@nycstudents.net` anchored to the end of the string (`x@nycstudents.net.evil.com`, `x@nycstudents.net@evil.com`, `x@evilnycstudents.net`, `x@mail.nycstudents.net` all fail). Must differ from the personal email (case-insensitive). The personal email is NOT additionally forbidden from being a nycstudents.net address: a student may reasonably use it as their personal address in older flows, and "must differ" already stops reuse.

Enforced server-side in `validateSubmissionInputs`, which throws `OnboardingRejection('school_email_invalid', message)` so the readable message survives production error masking. The wizard repeats the check for early feedback. Uniqueness: `members.school_email` with unique index `members_school_email_lower_idx` on `lower(school_email)`. The pipeline checks for another owner first and returns `school_email_already_used`; a race is decided by the index and mapped to the same code (`isSchoolEmailUniqueViolation`). All three new codes (`school_email_invalid`, `school_email_already_used`, `student_id_required`) send the wizard back to step 1.

Drafts: `schoolEmail` is saved (string, capped at 254 characters) and restored. The student ID is never in a draft; `studentIdUploaded`, `studentIdKey`, `studentIdFile` are in `NEVER_DRAFTED_KEYS`. On resume, `validateInviteToken` returns `studentIdUploaded: boolean` (a server lookup by invite), which seeds the wizard so a refresh or the same-tab Discord redirect does not lose the upload.

## Student ID storage

- **Private bucket `student-ids`** (`STUDENT_ID_BUCKET`), `public = false`, 5 MB bucket limit, `image/jpeg|png|webp`, and **no `storage.objects` policies**, so anon and authenticated roles cannot list or read it; only the service-role client in `app/lib/onboarding/student-id-storage.ts` touches it. That module has no `getPublicUrl`. The existing `admin-uploads` bucket is public and is not used.
- **Convention followed:** the repo has no bucket-creation code or `supabase/config.toml` bucket entries; `staff-resumes` (spec-007) was created by hand. Migration `0058` ends with a guarded `INSERT ... ON CONFLICT DO UPDATE` into `storage.buckets` (a no-op when the `storage` schema does not exist, e.g. PGlite or plain Postgres, and it forces an existing bucket back to private). If the migration role cannot write that schema, create the bucket in the dashboard with the same settings.
- **Upload path:** `POST /api/onboarding/student-id` (multipart: invite `token`, `file`). A route handler rather than a server action because of the body-size limit and to mirror `/api/apply/staff`. Order: per-IP rate limit (10 per 10 min), declared `Content-Length` cap, parse, invite must exist, be `pending` and unexpired, size cap on the real byte count (**4 MB**, below Vercel's 4.5 MB request limit), type from **magic bytes** (JPEG, PNG, WebP; the file name and Content-Type are never consulted), key `<random uuid>.<ext of the detected type>`, upload, then record the row. If recording fails the object is removed. HEIC/HEIF is not accepted (browsers cannot render it for staff; iOS Safari converts a picked HEIC to JPEG when the input lists JPEG/PNG/WebP).
- **Hand-off to submit, and why no token:** `student_id_uploads` rows (`invite_kind`, `invite_id`, `member_id`, `storage_key`, `content_type`, `size_bytes`) are created only by the upload route, bound to the invite resolved from the invite token. The submission carries no key, id or token for the ID: the pipeline calls `findPendingUpload(kind, invite.id)` (rejects with `student_id_required` before any write) and, inside the same transaction as the member upsert, `linkUploadToMember` sets `member_id`. Because the server derives the invite from the token and the row from the invite, the browser cannot name or swap an object, and there is no extra signing secret to configure. This replaces the "signed short-lived token" idea with the same guarantee (binding to the invite) and less surface; a unique index keeps one pending upload per invite, and a replace deletes the earlier object.
- **Why a table, not a `members` column:** `members` rows are selected in many places that end up in caches or pages. The key lives in `student_id_uploads` (RLS on, no policies, never in `unstable_cache`, never in any page or CSV), and staff views only receive a `hasStudentId` boolean. The key is a storage key, never a URL.
- **Replacing a photo never deletes its row first.** A replaced photo (a second upload for the same invite, or a newer photo for the same member) is *demoted*: its row is re-pointed at a random invite id that matches nothing, which makes it an orphan. The row stays as the only pointer to the object until `sweepOrphanStudentIds` has removed the object, so a failed Storage removal leaves a retrievable record and the next sweep retries (PGlite test: `keeps a replaced photo as a retrievable orphan record`).
- **Missing bucket:** the upload route answers 503 "Photo uploads are not available right now. Please contact EZ Esports..." and logs a server error naming the bucket and how to create it; the staff signed-URL route logs the same when signing hits a missing bucket.
- **One photo per member:** unique index on `member_id`. If the same person (matched by personal email) onboards again, `linkUploadToMember` replaces the old row and the old object is removed after commit.

## Staff visibility

- `GET /admin/schools/student-id/[memberId]` (`app/(admin)/admin/schools/student-id/[memberId]/route.ts`): allowed for `MANAGE_ROSTERS` (roster view) or `MANAGE_SCHOOLS` (the managers dialog), through `getStaffWithPermission`; malformed ids 404 before any query; looks the key up itself; 303-redirects to a signed URL valid **120 s**; `Cache-Control: private, no-store`; records a best-effort `student_id_viewed` row in `staff_audit_logs` (member id only). The signed URL is never rendered into a page, cached, or returned from a server action.
- Roster page (`SchoolRostersView`) shows "School email: ..." and a "View student ID" link (new tab) per player; the school managers dialog (`ActiveManagersTab`) shows the same per manager. `getSchoolRosterBlocks` and `listActiveSchoolManagers` add `schoolEmail` and a `hasStudentId` flag. Those reads are uncached admin reads.
- **Not exposed anywhere else:** no CSV export, public page, or API carries the student ID image or any storage key. (The only CSV in the app exports applications, not members.)
- Privacy page lists the new data and the private-storage handling.

## Lifecycle: no lingering images

`student_id_uploads.member_id` is `ON DELETE SET NULL` (not cascade), so deleting a member never destroys the only pointer to the object. `sweepOrphanStudentIds()` (`app/lib/onboarding/student-id-sweep.ts`) finds rows with no member whose invite is not a live pending one (deleted, revoked, rejected, expired), removes the **objects first**, and deletes the rows only if Storage accepted the removal, so a Storage outage is retried by the next sweep rather than leaving an unrecorded photo. It never throws. The submission pipeline sweeps after commit as well. Called after commit from: roster player removal (staff and portal, when the member was deleted), staff roster delete, pending player-invite delete, manager-invite revoke, the upload route (opportunistic, covers expired invites), and `db/purge-onboarding-test-data.ts` after `--execute` (so a purge also clears the bucket; the schema audit test lists `student_id_uploads` as intentionally ON DELETE SET NULL).

## Migration

`db/migrations/0058_school_email_student_id.sql` (journal idx 58), hand-written because the drizzle-kit snapshot chain stops at 0042 and `db:generate` refuses to run (pre-existing; `0043`-`0057` were hand-written too). Adds `members.school_email`, `members_school_email_lower_idx`, `student_id_uploads` (RLS on, no policies) with its indexes, and the private bucket insert, which is skipped when there is no `storage` schema and, when the role lacks privilege on it, only raises a NOTICE (`insufficient_privilege` is caught) so the column and table still apply; the bucket must then be created by hand. **Apply before deploying the code** (see DEPLOY ORDER above).

## Tests

`school-email.test.ts` (accept/reject matrix incl. look-alike domains, same-as-personal), `student-id.test.ts` (magic bytes, fake-extension/wrong-magic-bytes, truncated input, size cap, key shape), `app/api/onboarding/student-id/__tests__/route.test.ts` (detected type wins over extension and Content-Type, wrong magic bytes writes nothing, oversize, unknown/missing token, non-pending and expired invite, replace demotes the old photo to a sweepable orphan, rollback on DB failure, rate limit), `(admin)/admin/schools/student-id/__tests__/route.test.ts` (403 for non-staff before any lookup, either permission opens, 303 + no-store, bad id, audit failure tolerated), `student-id-sweep.test.ts` (objects before rows, keeps rows when Storage fails), `app/lib/db/__tests__/student-ids-pglite.test.ts` (migration on PGlite, case-insensitive unique index, one pending per invite, link/replace, orphan rules after member delete), pipeline cases in `milestone4-player-wizard.test.ts` (invalid domains, same email, already used, race via unique index, `student_id_required`, link and replaced-photo sweep, client-supplied keys ignored, draft sanitization), and `school-email-student-id.test.tsx` (wizard validation and upload for player and manager). Existing wizard tests updated for the new field.

## Not verified

No real Supabase Storage call, bucket creation, signed URL, migration against a real database, or browser run was done; Storage is mocked and the SQL ran on PGlite only. `storage.buckets` insert permission for the migration role is unconfirmed.

## Known limitations (follow-ups)

- **The sweep has no scheduler.** `sweepOrphanStudentIds` runs only as a side effect of the flows listed above. Photos orphaned by an expired invite stay until the next upload, removal or purge. A cron route that calls it is a follow-up.
- **Plus-addressing is not canonicalised.** `a+1@nycstudents.net` and `a@nycstudents.net` are different addresses to the unique index, so one student can register more than once with variants. Staff compare the address with the ID; canonicalisation (strip `+tag`) is a follow-up.
- **A chunked upload skips the early 413.** The declared-`Content-Length` check cannot see a body sent with chunked transfer encoding; such a body is only stopped by the platform limit and the 4 MB check after it is read.
