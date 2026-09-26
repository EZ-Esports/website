# spec-004: Staff Application Resume Upload, Volunteer Acknowledgement, and Recruiting Intro

- **Status:** In Progress (code on `fix/staff-apply-tidy`; migration `0036` and the `staff-resumes` bucket are **not yet applied** to production)
- **PR:** not opened yet
- **Date:** 2026-09-25
- **Scope:** `app/(marketing)/apply/staff/StaffApplyForm.tsx`, `app/api/apply/staff/route.ts`, `app/lib/staff-application-form.ts`, `app/lib/staff-resume.ts` (new), `app/(admin)/admin/applications/staff/[id]/resume/route.ts` (new), `app/components/admin/StaffApplicationDetailModal.tsx`, `app/components/admin/StaffApplicationRow.tsx`, `app/lib/application-csv.ts`, `app/lib/db/queries.ts`, `app/lib/db/schema.ts`, `db/migrations/0036_staff_application_resume.sql`, tests under `app/lib/__tests__/` and `app/lib/db/__tests__/`.

## Context & Motivation

`/apply/staff` had a single optional "LinkedIn profile or Portfolio/Resume link" text field, so reviewers often had no resume at all. The recruiting message also needed to state up front that roles are unpaid, part-time volunteering, and the page intro needed the organization's recruiting copy (from a Discord recruiting post) and the mission statement.

The form is public and unauthenticated, and a resume is PII (name, contact details, school history). It cannot go in the public `admin-uploads` bucket used for site imagery.

## Design Decisions

1. **Resume: required PDF in a private bucket.**
   - Bucket `staff-resumes` (constant `STAFF_RESUME_BUCKET` in `app/lib/staff-resume.ts`), **private**. Created by hand in the Supabase dashboard, not from code or a migration: private, 5 MB bucket file-size limit, allowed MIME type `application/pdf`.
   - The route handler caps a resume at **4 MB** (`RESUME_MAX_BYTES`), below the bucket's 5 MB, because the whole multipart request must fit under Vercel's 4.5 MB serverless request-body limit. A body whose declared `Content-Length` exceeds 4 MB + 256 KB gets a 413 before it is parsed.
   - Server validation (`validateResumeUpload`): present, `.pdf` name or `application/pdf` type, non-empty, at most 4 MB by actual byte count, and the bytes start with `%PDF-`. The magic-byte check is authoritative; type and extension are client-controlled.
   - Storage key is `<randomUUID>.pdf`: nothing about the applicant is in the key. The key goes in the new `staff_applications.resume_storage_key` column. No URL is stored.
   - Order in `POST /api/apply/staff`: rate limit (unchanged, 5 per IP per 10 min), body-size check, field validation, `details` validation, resume validation, **then** upload, then insert. A rejected request never writes to storage. If the insert fails after upload, the route removes the object.
   - The submission changed from JSON to `multipart/form-data`: the applicant fields, `details` as a JSON string, and `resume` as a file part.

2. **Admin access by short-lived signed URL.** `GET /admin/applications/staff/[id]/resume` checks `getStaffForAdminSection('/admin/applications')` (the same gate as the Applications page, i.e. `MANAGE_APPLICATIONS`), rejects a malformed id, looks up the key on a non-deleted row, and 303-redirects to a Supabase signed URL valid for **60 s** (`RESUME_SIGNED_URL_TTL_SECONDS`), with `Cache-Control: private, no-store`. The detail modal renders a plain "View resume (PDF)" link to this route. The applications query exposes only `hasResume` (`resume_storage_key IS NOT NULL`), never the key.

3. **`details` v3.** `StaffApplicationDetailsV3` adds `consent.acknowledgedUnpaidVolunteer` and an optional `workSamples` text field, and keeps `linkedin` (LinkedIn-only now; optional). `parseStaffApplicationDetails` is the server gate: it rebuilds a fresh v3 object from known keys, requires all three consents `=== true`, normalizes and validates the LinkedIn URL (`normalizeOptionalUrl`: blank allowed, bare host gets `https://`, http/https with a dotted hostname only), caps `workSamples` at 1000 characters, and requires the why-join answer. Admin and CSV labels for v3: "LinkedIn", "Work Samples", "Unpaid Volunteer Role", "Why EZ Esports". **v1/v2 rows keep "LinkedIn / Portfolio"**, because those applicants answered a question that invited portfolio and resume links.

4. **CSV.** Staff CSV gains a "Resume" column ("Attached" or blank). No link is exported, because a signed link would expire within a minute.

5. **Migration `0036_staff_application_resume.sql`.** Generated with `drizzle-kit generate` (column add), then extended by hand:
   - `prevent_application_mutation()` is re-created from `0035` with `resume_storage_key` added to the staff immutability check and to the privacy-erasure `redacted_columns` audit list.
   - `erase_staff_application_privacy()` is re-created with `"resume_storage_key" = NULL` on redact. This only drops the pointer: the PDF must be deleted from the `staff-resumes` bucket separately. Read the key before redacting.

6. **Form UI.**
   - Step 2 is "Role & Resume": a resume picker built on RAC `FileTrigger` + RAC `Button` (44px target, `aria-labelledby`/`aria-describedby` wired to the hint, the live filename/size status, and the error). Client-side type and size checks use the same `checkResumeFile` as the server. Below it: a LinkedIn `type="url"` input with an inline error, then an optional "Links to related work samples" input.
   - Step 3's label is "Why do you want to join EZ Esports? (approx. 4-7 sentences)". Both "3-6 sentences" strings are now "4-7".
   - Step 4 has a third required checkbox, `UNPAID_VOLUNTEER_ACK_TEXT`, with the same pattern as the Terms and Privacy boxes. It counts toward the progress bar.
   - 4xx error messages from the server (bad PDF, rate limit) are shown to the applicant. 5xx errors fall back to the generic message.

7. **Page intro (careers skeleton, per uiux case study 1).** The `h1` is followed by the mission statement, rendered once from `SITE_CONFIG.description` (no duplicate string). A meta chip reads "Unpaid volunteer · Part-time". Two short paragraphs cover the founding year (2021), about 300 matches a year across dozens of NYCDOE schools, hundreds of volunteers, Twitch Partner (linked from `SOCIAL_LINKS`), collaborations with Roc Nation, Gen.G, and Factor, and the 5th year in 2026–27. A three-line checkmark list covers: terms agreed before joining; unpaid, part-time, and remote-friendly, with compensation described only as a future possibility and never a promise; and who the role suits. A link to `/leadership` (which redirects to the latest year) replaces a hardcoded year. The division list is **not** repeated in the intro: Step 2's radio list (`STAFF_ROLES`) is the single source.

## Rollout order (manual, production)

Code that reads or writes `resume_storage_key` fails against a database without the column. If this deploys before `0036` is applied, every staff submission fails and `/admin/applications` errors. Order:

1. Create the `staff-resumes` bucket in the Supabase dashboard: private, 5 MB file-size limit, allowed MIME `application/pdf`.
2. Apply `db/migrations/0036_staff_application_resume.sql` to production (backup first, per `CLAUDE.md`; `db:migrate` needs `SEED_ALLOW_REMOTE` and explicit user confirmation).
3. Merge and deploy.

## Invariants & Boundaries

- Resumes live only in the private `staff-resumes` bucket and are read only through the permission-gated signed-URL route. Never make the bucket public, never store or render a long-lived URL, and never put resume links in CSV exports.
- `resume_storage_key` is a submission field: append-only like the others, and changeable only through authorized privacy erasure.
- Privacy erasure of a staff application must also delete `staff-resumes/<resume_storage_key>`. The SQL procedure cannot do this.
- The server re-validates everything the client checks. Client checks exist for UX only.
- Non-goals: resume virus scanning, resumes for school applications, and changing `STAFF_ROLES`. The recruiting post lists "Game regulations" and "Software engineering & data science", while `STAFF_ROLES` has per-game divisions and "Software Engineering Division". Reconciling the two is a product decision.

## Verification

- `npx tsc --noEmit`, `npm run lint`, and `npx vitest run`. New or updated tests: `app/lib/__tests__/staff-resume.test.ts`, `staff-application-form.test.ts`, `staff-application-routes.test.ts` (route handlers with mocked DB and storage), `application-csv.test.ts`, and `app/lib/db/__tests__/staff-resume-migration.test.ts`.
- Visual: view `/apply/staff` at desktop and mobile width. Do not submit against production until `0036` is applied and the bucket exists.
- After deploy: submit a test application with a small PDF, then open it from `/admin/applications` and confirm the resume link opens and stops working after about 60 s.
