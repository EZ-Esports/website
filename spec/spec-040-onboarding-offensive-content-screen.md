# spec-040: Onboarding Offensive-Content Screen

- **Spec ID:** spec-040
- **Title:** Profanity and slur screening of onboarding fields, a per-field "this is my real information" override, and a staff review badge
- **Status:** Implemented on branch `worktree-agent-ab37714a4c6e7940c`; not pushed, no PR yet. **Migration `0055` is not applied to production.**
- **Date:** 2026-10-28
- **Context:** Issue #291 (rules and acknowledgement copy). Builds on [spec-011](spec-011-player-onboarding-and-manager-portal.md), [spec-029](spec-029-onboarding-consent-form.md), [spec-033](spec-033-discord-oauth-onboarding.md) and [spec-035](spec-035-manager-discord-oauth.md).

## What shipped

1. **Detector** (`app/lib/profanity/`): dependency-free `checkProfanity(text)` returning `{ flagged, matches: [{ term, language }] }`. Word lists are data in `terms.ts` (English, Spanish, French, German, Portuguese, Italian, Dutch, romanized Russian, Chinese pinyin, Japanese romaji, Korean romanization, Arabic and Hindi transliterations, plus a few native-script terms for Russian Cyrillic, Chinese, Japanese, Korean, Arabic, Hindi); the rules are in `detect.ts`.
2. **Screen** (`app/lib/onboarding/content-check.ts`): which fields are screened, the server and client share it.
3. **Wizard**: every screened field shows an inline warning and a checkbox, "This is actually my real information", under the field; Continue is blocked until the value changes or the box is ticked. The notice sits in an always-mounted `role="status"` polite live region and uses the shared tokens (`danger`/`danger-on-tint`, `warning`) that carry AA contrast in both the dark and `.theme-light` palettes.
4. **Server**: the submission pipeline recomputes what is flagged and rejects with `content_flagged` (and the field keys) unless each flagged field is in `contentOverrides`. Overrides are persisted to `onboarding_content_flags`.
5. **Staff**: a "Flagged info - overridden" badge on the player's row in the Schools & Rosters view and on managers in the School Managers dialog, with the fields, the values, the matched terms and a "Mark reviewed" button; a header chip on the roster page counts unreviewed ones.
6. **Rules and acknowledgement**: rules page 3.4 "Names, Usernames & Submitted Information" (`#submitted-information`); the Step 4 Code of Conduct checkbox now names the prohibition and links Rule 3.4.

## Screened fields

Legal first and last name, the verified Discord username, Riot ID, country of birth, primary language at home, the "anything else" note for staff, participant legal name (only if it was changed from first + last, so one flagged name asks once), guardian full name, guardian relationship, signature. Guardian fields are screened only for under-18s (the server uses the normalized consent, which drops an adult's leftover text). Not screened: email, password, dates, pick-lists. Managers use the same wizard and the same screen. Staff-typed invite names (`intendedFirstName` / `intendedLastName`) and portal forms are outside onboarding and not screened.

The Discord username is not a field the person types: it comes from Discord via the signed cookie. It is screened because it is shown to staff and opponents; the person can override, or choose "Use a different Discord account".

## Detection rules

- **Evasion is handled in the pattern, not by rewriting the text.** Each term letter becomes a character class of its look-alikes (`s` accepts `5 $`, `a` accepts `4 @`, `i` accepts `1 ! |`, `l` accepts `1 |`, `e` accepts `3 €`, `o` accepts `0`, `t` accepts `7 +`, `c` accepts `© ¢`, `u` accepts `v`). Interior letters of a term also accept `*` (f*ck, a**hole), never the first or last. Letters may repeat (fuuuck); a doubled letter in the term must stay doubled, and terms of three letters or fewer repeat only their last letter, so "as" and "Tiit" are clear.
- **Text normalization:** NFKD, accents stripped, ß/æ/ø/ł folded, zero-width characters removed, fullwidth letters folded, Cyrillic transliterated (a fully Cyrillic word) or mapped to look-alike Latin letters (a mixed word, "fuсk"). A run of three or more single characters split by spaces, dots, hyphens or underscores is joined (f u c k, s-h-i-t). A second view with separators removed inside each space-delimited chunk catches `fu.ck`.
- **Scunthorpe:** terms are `contains` (long, unambiguous; matched inside a word) or `word` (matched only between non-letters). "Dickson", "Cockburn", "Hancock", "Assad", "Scunthorpe", "Essex", "Penistone", "Cummings" stay clear because "dick", "cock", "ass", "cunt", "sex", "penis" and "cum" are `word`. A short `INNOCENT_WORDS` list (shiitake, snigger, pussycat, therapist, ...) is blanked before matching for the `contains` terms. Chinese pinyin is listed joined only ("shabi"), since two syllables written apart are often a real name.
- **Digits are not letters:** a hit must be at least one third letters, so "717" is not "tit".
- **Known limits:** a flag is never proof of intent (real people are named Dick or Fick) which is why there is an override; the lists are not exhaustive and the non-English lists are reasonable coverage, not a linguist's audit; context-dependent insults and non-slur harassment are not detected; native-script coverage is a handful of terms; a deliberate misspelling the patterns do not anticipate gets through; innocent words not on the allowlist can still false-positive, in which case add to `INNOCENT_WORDS` or move the term to `word` and add a test.

## Override model

- Per field, per value. The client keeps `field -> value-at-the-time`; editing the value (even to another flagged one) clears the override. The submission sends `contentOverrides: string[]` of field keys.
- The server never trusts the client's idea of what is flagged: it recomputes, honors an override only for a field that is currently flagged, ignores unknown keys, and rejects the rest. A rejection returns `{ success: false, code: 'content_flagged', error, fields }`; the wizard jumps to the earliest step holding a flagged field (`stepForRejection(code, fields)`), and a flagged Discord username does not clear the Discord connection. The check runs before any write.
- **Drafts store the overrides map** (`contentOverrides: { field: value }`), so an override survives the Discord OAuth round trip (the Discord username override in particular). On restore the map is parsed defensively (`parseSavedOverrides`: known fields, bounded strings; the server also parses it when saving a draft) and an entry counts only while the field still holds exactly that value. The submit-time `contentOverrides` list is still re-validated by the server and a draft is never trusted as an override. (Guardian fields are not restored from drafts, so their overrides are simply asked for again.)
- **Length limits, server-side:** each screened field has a maximum (`CONTENT_FIELDS[...].max`: names 100, Riot ID 60, country/language/relationship 100, participant/guardian name/signature 200, staff note 1000). A longer value is rejected before any write with `field_too_long` and the field keys (the wizard jumps to that step). The scan itself examines at most 1000 characters (`MAX_CHECK_LENGTH`) and `findFlaggedFields` truncates to the field maximum, so a huge paste cannot make it slow.
- **Performance:** runs of one repeated character are cut to three in a single pass before matching, and input is bounded, so 100k-character hostile inputs (`aaaa...`, `s$s$...`, `f f f ...`, `a-a-...-k`) finish well under a second (tests assert < 1 s).

## Data (migration 0055)

`db/migrations/0055_onboarding_content_flags.sql` (hand-written like 0043-0054; journal entry only, no snapshot, because `drizzle-kit generate` is blocked by the snapshot-chain problem in open-threads; idempotent: `CREATE TABLE IF NOT EXISTS`, `DO $$ ... duplicate_object` around the foreign keys, `CREATE ... INDEX IF NOT EXISTS`). Table `onboarding_content_flags`: `member_id` (the person who ticked the override; cascade), `school_id` (set null), `invite_kind` + `invite_id` (unique together), `flagged_fields` jsonb (`field`, `label`, `value`, `matchedTerms`, `languages` for each overridden field), `created_at`, `reviewed_at`, `reviewed_by` (reviewer's email). RLS on, no policies. One row per submission with at least one override; a submission with no override writes nothing. It is a separate table so the member, roster and manager queries never reference a new column.

The purge script needs no change: the member foreign key cascades, and `db/__tests__/purge-onboarding-test-data.test.ts` lists the table with a note. The purge backup scope does not include this table.

## Fail-safe behaviour before the migration is applied

Production may run this code before 0055 is applied. Every statement that touches the table is guarded by `isMissingContentFlagsError` (`app/lib/db/content-flags.ts`: Postgres `42P01` or `42703` whose message names `onboarding_content_flags`, also through Drizzle's `.cause` wrapper). Anything else is rethrown.

- **Write:** `insertContentFlag` runs in a savepoint (`tx.transaction`) inside the onboarding transaction, so a missing table aborts only the savepoint; the member, consent and invite writes still commit and the person is onboarded with no record, with a `console.warn` naming migration 0055.
- **Read:** `getContentFlagsByMember` is a separate query from the roster read and returns an empty map (with a warning) when the table is missing; `loadContentFlags` in `school-rosters.ts` also swallows any other error so the roster page always renders (without badges). The manager dialog fetches flags in its own try/catch.
- **Review action:** `reviewContentFlag` returns a friendly error when the table is missing.
- The server-side screen itself needs no database and works regardless of the migration.

## Staff visibility

- A person can carry more than one record (for example a player and a manager invite), so `getContentFlagsByMember` returns every record per member, newest first; each gets its own badge and "Mark reviewed", and the header count covers anyone with any unreviewed record.
- Players: `getSchoolRosterBlocks` attaches `contentFlags` to each `RosterViewPlayer`; `RosterCard` shows `ContentFlagBadge` (a `<details>` with the person's name, when, which invite kind, each field and value, the matched terms and languages, and "Mark reviewed"). Reviewed flags show a neutral chip with who and when. The roster page header shows "N players have flagged information to review".
- Managers: `ActiveManagersTab` shows the same badge (flags fetched by `getManagerContentFlags`).
- Permission: `reviewContentFlag` and `getManagerContentFlags` require MANAGE_ROSTERS or MANAGE_SCHOOLS (same as the pages that show them).
- There is no filter control (only the badge and header count) and no cross-school queue.

## Tests

`app/lib/profanity/__tests__/detect.test.ts` (flags, evasion, languages, false positives, edge cases), `app/lib/onboarding/__tests__/content-check.test.ts`, `app/lib/db/__tests__/content-flags.test.ts` (missing-table paths), `milestone4-player-wizard.test.ts` section 7 (pipeline: block, override, partial override, record contents, adult guardian text, Discord username, missing table, unrelated DB error rethrown, manager path, manager code of conduct), `join/.../__tests__/content-flag.test.tsx` (hook and form behaviour, acknowledgement copy), rules page test for 3.4. No test touches a database. **Not verified:** the migration SQL was not run against any Postgres, and the savepoint behaviour is exercised only through the query-builder stand-in, not a real server; the rendered UI was not checked in a browser.

## Follow-ups

- Apply migration 0055 (owner, with the usual scoped backup).
- Decide whether to add a roster "flagged only" filter or a cross-school review queue.
- Extend screening to staff-typed invite names and portal free text if wanted.
