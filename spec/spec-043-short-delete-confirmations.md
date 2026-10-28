# spec-043: Short, uniform wording for roster delete confirmations

- **Spec ID:** spec-043
- **Title:** Roster removal and roster delete dialogs only say "permanently" and "cannot be undone"
- **Status:** Implemented on branch `claude/roster-remove-confirm-79876c`. Copy only: no behaviour, schema or migration change.
- **Date:** 2026-10-28
- **Scope:** `app/lib/roster-removal-copy.ts`, `SchoolPortalClient.tsx` (empty-roster delete), `SchoolRosterEditors.tsx` (staff delete roster) and their tests.

## Context & Motivation

spec-042 gave the remove-player dialog a long paragraph (student-record deletion, six keep-reasons). The owner asked for the delete confirmations to say only that the removal is permanent and cannot be undone. Every roster removal path already confirmed (spec-037, spec-042); this changes wording only.

## Decisions

- Remove player (manager portal and staff, one shared function): `Remove {player} from {roster}? This will remove them permanently. This action cannot be undone.`
- Delete roster (staff): `Delete roster "{name}"? This will remove it permanently. This action cannot be undone.`
- Delete empty roster (portal): `Delete this roster? This will remove it permanently. This action cannot be undone.`
- Which student record was deleted or kept is still told after the fact by the server's outcome sentence (toast on staff, roster notice on the portal); the server behaviour in spec-042 is unchanged.
- Buttons, danger tone, Cancel-first focus and pending/error handling are unchanged (spec-037).
- Other delete dialogs (League Setup, schools, matches, applications, managers, careers) keep their spec-042 audit wording; they were not in scope.

## Verification

Component tests assert the new text, cancel not acting and confirm acting once; the copy unit test in `app/lib/db/__tests__/roster-removal.test.ts` covers the shared message.
