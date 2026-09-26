# spec-004: Staff Application Resume Upload, Volunteer Acknowledgement, and Recruiting Intro

- **Status:** In Progress (code on `fix/staff-apply-tidy`, not deployed; migration `0036` and the `staff-resumes` bucket are **live in production** as of 2026-09-26)
- **PR:** not opened yet
- **Date:** 2026-09-25 (follow-up round 2026-09-26)
- **Scope:** `app/(marketing)/apply/staff/StaffApplyForm.tsx`, `app/(marketing)/privacy/page.tsx`, `app/api/apply/staff/route.ts`, `app/lib/staff-application-form.ts`, `app/lib/staff-resume.ts` (new), `app/(admin)/admin/applications/staff/[id]/resume/route.ts` (new), `app/components/admin/StaffApplicationDetailModal.tsx`, `app/components/admin/StaffApplicationRow.tsx`, `app/lib/application-csv.ts`, `app/lib/db/queries.ts`, `app/lib/db/schema.ts`, `db/migrations/0036_staff_application_resume.sql`, tests under `app/lib/__tests__/` and `app/lib/db/__tests__/`.

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

2. **Admin access by short-lived signed URL.** `GET /admin/applications/staff/[id]/resume` checks `getStaffForAdminSection('/admin/applications')` (the same gate as the Applications page, i.e. `MANAGE_APPLICATIONS`), rejects a malformed id, looks up the key on a non-deleted row (`getStaffResumeStorageKey` / `buildStaffResumeKeyQuery` in `queries.ts`, whose `deleted_at IS NULL` filter is asserted on the generated SQL), and 303-redirects to a Supabase signed URL valid for **60 s** (`RESUME_SIGNED_URL_TTL_SECONDS`), with `Cache-Control: private, no-store`. The detail modal renders a plain "View resume (PDF)" link to this route. The applications query exposes only `hasResume` (`resume_storage_key IS NOT NULL`), never the key.

3. **`details` v3, then v4.** `StaffApplicationDetailsV3` added `consent.acknowledgedUnpaidVolunteer` and an optional `workSamples` text field ("Other links"), and kept `linkedin` (optional). v3 shipped to production data only if the first round was deployed, so it stays a union member. **v4** is v3 plus `gameDirector` (see 8). New submissions write v4. `parseStaffApplicationDetails(raw, role)` is the server gate: it rebuilds a fresh v4 object from known keys, requires all three consents `=== true`, validates the LinkedIn URL with `normalizeLinkedInUrl` (blank allowed; a missing scheme gets `https://`; http/https only; the host must be `linkedin.com` or end in `.linkedin.com`, so `www.` and regional hosts such as `uk.linkedin.com` pass and look-alikes such as `linkedin.com.evil.example` or `user@host` tricks fail), caps `workSamples` at 1000 characters, requires the why-join answer, and requires or clears `gameDirector` based on `role`. Admin and CSV labels for v3/v4: "LinkedIn", "Other Links", "Unpaid Volunteer Role", "Why EZ Esports", plus "Game Director Position" first on v4 rows that have one. **v1/v2 rows keep "LinkedIn / Portfolio"**, because those applicants answered a question that invited portfolio and resume links.

4. **CSV.** Staff CSV gains a "Resume" column ("Attached" or blank). No link is exported, because a signed link would expire within a minute.

5. **Migration `0036_staff_application_resume.sql`.** Generated with `drizzle-kit generate` (column add), then extended by hand:
   - `prevent_application_mutation()` is re-created from `0035` with `resume_storage_key` added to the staff immutability check and to the privacy-erasure `redacted_columns` audit list.
   - `erase_staff_application_privacy()` is re-created with `"resume_storage_key" = NULL` on redact. This only drops the pointer: the PDF must be deleted from the `staff-resumes` bucket separately. Read the key before redacting.

6. **Form UI.**
   - Step 2 is "Role & Resume": the division radios (with the Game Regulations follow-up, see 8), then a resume picker built on RAC `FileTrigger` + RAC `Button` (44px target, `aria-labelledby`/`aria-describedby` wired to the hint, the live filename/size status, and the error). Client-side type and size checks use the same `checkResumeFile` as the server. Below it: a "LinkedIn profile" `type="url"` input with an inline error (`LINKEDIN_URL_ERROR`, shared with the server), then an optional "Other links" input.
   - Step 3's label is "Why do you want to join EZ Esports? (approx. 4-7 sentences)". Both "3-6 sentences" strings are now "4-7".
   - Step 4 has a third required checkbox, `UNPAID_VOLUNTEER_ACK_TEXT`, with the same pattern as the Terms and Privacy boxes. It counts toward the progress bar.
   - 4xx error messages from the server (bad PDF, rate limit) are shown to the applicant. 5xx errors fall back to the generic message.

7. **Page intro (careers skeleton, per uiux case study 1).** The `h1` is followed by the mission statement, rendered once from `SITE_CONFIG.description` (no duplicate string). A meta chip reads "Volunteer · Part-time". Two short paragraphs cover the founding year (2021), about 300 matches a year across dozens of NYCDOE schools, hundreds of volunteers, Twitch Partner (linked from `SOCIAL_LINKS`), collaborations with Roc Nation, Gen.G, and Factor, and the 5th year in 2026–27. A three-line checkmark list covers: terms agreed before joining; part-time and remote-friendly; and who the role suits. The intro says **nothing about pay or compensation**: the only statement on pay is the required unpaid-volunteer acknowledgement in Step 4 (an earlier "paid roles may become possible" line was removed). A link to `/leadership` (which redirects to the latest year) replaces a hardcoded year. The division list is **not** repeated in the intro: Step 2's radio list (`STAFF_ROLES`) is the single source.

8. **Game Regulations Division with a director follow-up.** `STAFF_ROLES` replaces "VALORANT Division", "League of Legends Division" and "Teamfight Tactics Division" with one `GAME_REGULATIONS_ROLE` ("Game Regulations Division"), giving the seven divisions from the recruiting post. Choosing it reveals a required follow-up, "Which game director position?", with `GAME_DIRECTOR_POSITIONS` (VALORANT / League of Legends / Teamfight Tactics Director).
   - **Single choice**, because the primary-role picker it hangs off is single choice ("Primary Role of Interest"), the row stores one role, and one director seat keeps the admin row and CSV unambiguous. Applicants interested in more can say so in their written answer.
   - The `role` column still holds "Game Regulations Division", so admin status filters and the role shown in the table are unchanged. The director answer is `details.gameDirector` (v4), `''` for every other division, and dropped server-side if a stray value is sent with another division.
   - Old rows whose `role` is "VALORANT Division" etc. still render verbatim (free-text column). `isStaffRole` now rejects those values for new submissions.
   - UI: RAC `RadioGroup` + `Radio` + `Label` + `Text slot="description"` + `FieldError` (`validationBehavior="aria"`, `isRequired`, `isInvalid`), 44px rows, rendered directly after the division list in DOM order and only while Game Regulations is selected. The Game Regulations radio carries an `aria-describedby` note saying a follow-up question comes next. Client validation mirrors the server message.

9. **Privacy Policy (`app/(marketing)/privacy/page.tsx`).** "Information We Collect" now lists phone number and Discord username, and a "Staff application materials" item (uploaded resume PDF, LinkedIn/other links, role, availability, written answers). "How We Use" covers staff applications. "Data Retention" says staff applications and resumes are not deleted automatically after a set period, and that on a deletion request both the record and the resume file are removed. This matches the manual erasure flow and does **not** promise automatic deletion. "Security" says uploaded documents sit in private storage that only authorized application reviewers can open, through links that expire shortly after creation. "Last updated" is now September 2026.

## Rollout order (manual, production)

Done for the first round: the `staff-resumes` bucket (private, 5 MB, `application/pdf`) and migration `0036` are live in production (2026-09-26). The follow-up round (v4 details, Game Regulations, LinkedIn host rule, privacy copy) needs **no schema change**, since `gameDirector` lives in the `details` jsonb. Do not edit `0036` in place; any future schema change gets a new migration.

## Invariants & Boundaries

- Resumes live only in the private `staff-resumes` bucket and are read only through the permission-gated signed-URL route. Never make the bucket public, never store or render a long-lived URL, and never put resume links in CSV exports.
- `resume_storage_key` is a submission field: append-only like the others, and changeable only through authorized privacy erasure.
- Privacy erasure of a staff application must also delete `staff-resumes/<resume_storage_key>`. The SQL procedure cannot do this.
- The server re-validates everything the client checks. Client checks exist for UX only.
- New submissions for Game Regulations always carry a valid `details.gameDirector`; other divisions never do.
- The LinkedIn field only stores `linkedin.com` / `*.linkedin.com` URLs. Other links belong in "Other links".
- The staff apply page makes no pay or compensation claims beyond the unpaid-volunteer acknowledgement.
- Non-goals: resume virus scanning, resumes for school applications, and renaming "Software Engineering Division" to the post's "Software engineering & data science" (left as-is).

## Verification

- `npx tsc --noEmit`, `npm run lint`, and `npx vitest run`. New or updated tests: `app/lib/__tests__/staff-resume.test.ts`, `staff-application-form.test.ts` (v4, Game Regulations follow-up, LinkedIn host rule, legacy v1-v3 rendering), `staff-application-routes.test.ts` (route handlers with mocked queries and storage: upload failure gives 500 with no insert, sign failure gives 502, missing details gives 400, Game Regulations requirement, retired per-game roles rejected), `application-csv.test.ts`, `app/lib/db/__tests__/staff-resume-migration.test.ts`, and `app/lib/db/__tests__/staff-resume-query.test.ts` (the resume lookup's SQL includes `"deleted_at" is null`).
- Visual: view `/apply/staff` at desktop and mobile width, select Game Regulations and check the follow-up appears after the division list. View `/privacy`. Do not submit the form against production from a dev machine.
- After deploy: submit a test application with a small PDF, then open it from `/admin/applications` and confirm the resume link opens and stops working after about 60 s.
