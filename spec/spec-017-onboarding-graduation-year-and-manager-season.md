# spec-017 — Onboarding: graduation year options and manager season affiliation

**Date:** 16 Oct 2026

Step 1 of the `/join/[schoolSlug]/[gameSlug]` wizard ([spec-011](spec-011-player-onboarding-and-manager-portal.md)) had one dropdown, `account-graduation-year`, that meant two different things. Students picked a graduation year; managers picked an "Affiliation / Academic Year" whose value was written into `members.graduation_year`, while `school_managers.academic_year` always fell back to `'2025-2026'` because the wizard never set it. This spec separates the two.

- **Graduation year (everyone, students and managers):** one shared list, `GRADUATION_YEAR_OPTIONS` in the join `types.ts`: Class of 2027 (12th Grade / Senior), 2028 (11th / Junior), 2029 (10th / Sophomore), 2030 (9th / Freshman), ascending. Labels assume the 2026-2027 school year. The old Class of 2026 and "8th Grade" options are gone. Stored in `members.graduation_year` as before.
- **Season affiliation (managers only):** a second dropdown, `account-academic-year`, "Season Affiliation", options `MANAGER_SEASON_OPTIONS` (2026-27 to 2029-30; originally `2026-2027` to `2029-2030`, format changed by spec-019). It defaults to `DEFAULT_MANAGER_SEASON` (2026-2027, marked "Current Season"). If the admin invite already seeded `academicYear` in the invite draft and it is one of the offered seasons, that value is the default instead; stale seasons (for example the old `2025-2026` default) fall back to 2026-2027.
- **Persistence:** the wizard sends `academicYear` in `PlayerOnboardingSubmission` (managers only). `provisionManagerAccount` resolves the season as submitted value, else the invite draft's `academicYear`, else `'2026-2027'`. A submitted value must look like `YYYY-YYYY` with the second year one greater, otherwise submission fails with "A valid season (e.g. 2026-2027) is required."
- **Drafts:** a saved draft whose `graduationYear` is no longer offered (for example 2026) now loads as unset, instead of showing a blank select that still validated. Step-1 validation requires a listed graduation year, and for managers a listed season.
- **No migration.** Both columns (`members.graduation_year`, `school_managers.academic_year`) already existed and the draft is JSON.

**Not changed (at the time):** `saveOnboardingDraft`, which replaces the whole invite draft (see open-threads).

**Superseded by [spec-019](spec-019-manager-portal-season-scope.md):** manager seasons are now `YYYY-YY` (`2026-27`), not `YYYY-YYYY`.

**Tests:** two cases added to `milestone4-player-wizard.test.ts` (picked season overrides the invite-seeded one and graduation year is stored on the member; malformed season rejected).
