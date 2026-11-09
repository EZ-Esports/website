# spec-037: In-app confirm dialogs replace native `confirm()`

- **Spec ID:** spec-037
- **Title:** Every confirm-then-act control opens `ConfirmActionDialog`; native `confirm()` is banned in `app/`
- **Status:** Implemented on branch `fix/replace-native-confirm` (not merged at the time of writing). No migration, no schema change.
- **PR / Commit:** pending
- **Date:** 2026-10-27
- **Scope:** the eight native `confirm()` call sites, an extended `ConfirmActionDialog`, a new `useConfirmAction` hook, an ESLint rule and a vitest backstop. (035 is the merged managers Discord OAuth spec; 036 is reserved by the open purge-script PR #284.)

## Context & Motivation

Native `confirm()` is silently dismissed by embedded browsers and webviews (the Claude desktop preview pane returns `false` immediately). A button such as **Revoke** on a manager invite then looked dead: it did nothing and said nothing. A native box also cannot be styled, cannot carry an error, and is not announced consistently by assistive technology. `ConfirmActionDialog` (spec-013 era) and `ConfirmDeleteButton` already existed for this reason; these eight sites had been missed.

## Decisions

- **One dialog, extended.** `app/components/admin/ConfirmActionDialog.tsx` gained: `tone="danger"` (red confirm button, danger icon, **Cancel is the initially focused control** so a stray Enter cannot confirm), `error` (rendered in a `role="alert"` region inside the dialog, which stays open so the action can be retried or cancelled), `appearance="portal"` (the manager portal's dark zinc look, rose danger button, since `/portal` does not use the admin surface tokens), `restoreFocusRef` (see below), `aria-describedby` on the message, and `max-sm:min-h-11` (44px) buttons on touch widths.
- **Pending uses `aria-disabled`, not `disabled`.** A natively disabled button that holds focus drops focus to `body` in the middle of the action (the same reasoning as the move-order buttons in the Gallery manager). While pending, both buttons are `aria-disabled`, the confirm button is `aria-busy` and shows its pending label, a press is ignored, and Escape / backdrop dismissal is blocked so the result cannot be lost.
- **`useConfirmAction(run)`** (`app/components/admin/useConfirmAction.ts`) owns the state of a confirm flow: `request(target)` opens the dialog, `dialogProps` is spread onto `ConfirmActionDialog`. The action runs **only** from the dialog's confirm, so a cancelled dialog cannot reach it. A `{ success: false }` result or a throw becomes the dialog's `error` (never swallowed). A ref, not state, guards against a double press. The last target is kept after closing so the title and message stay readable during the exit animation.
- **Handlers no longer confirm.** `useSchoolManagersData` is a hook and cannot render JSX, so `handleRemoveManager` / `handleRevokeInvite` run unconditionally and take only an id. `ActiveManagersTab` and `ProvisionInviteTab`, which own the buttons, render the dialog. They keep calling the existing `onError` and keep honouring `isRemovingId` / `isRevokingId` (the row trigger stays disabled while that id is busy). The old "`{ success: false }` with no error means the user cancelled" convention is gone: a cancel never reaches the handler.
- **Focus returns to the trigger.** React Aria restores focus to the element focused when the dialog opened. That is wrong for the staff and invite rows, whose trigger is a menu item that disappears as the menu closes, so those two pass `restoreFocusRef` (the menu button) and the dialog focuses it after React Aria's own restore.
- **Messages are unchanged.** The body text of each dialog is the old `confirm()` string. Titles and button labels are new (label-in-name: the button says what it does, e.g. "Revoke invite", "Remove access", "Delete role").
- **Failures.** Previously a failed row action showed an inline row error or a toast, and the portal used `alert()`. Now the failure is shown in the dialog. Sites that already had a channel keep using it as well: the managers tabs call `onError`; the portal also writes the roster notice so the message survives a cancel; League Setup shows the error only in the dialog because its toast sits behind the backdrop (the success toast is unchanged).

## Call sites

| Site | Trigger | Dialog |
| --- | --- | --- |
| `school-managers/useSchoolManagersData.ts` `handleRemoveManager` | `ActiveManagersTab` trash button | danger, "Remove access" |
| `school-managers/useSchoolManagersData.ts` `handleRevokeInvite` | `ProvisionInviteTab` Revoke | danger, "Revoke invite" |
| `InviteRow.tsx` | row menu "Cancel Invite" | danger, "Cancel invite", `restoreFocusRef` |
| `StaffRow.tsx` | row menu "Remove Access" | danger, "Revoke access", `restoreFocusRef` |
| `TeamManagerClient.tsx` | role editor trash button | danger, "Delete role" |
| `LeagueSetupClient.tsx` `confirmDelete` | game and season trash buttons (dynamic message) | danger, "Delete" |
| `SchoolPortalClient.tsx` `handleDeleteRoster` | roster card trash button | `appearance="portal"`, danger, "Delete roster" |

## Guard against regressions

- ESLint (`eslint.config.mjs`): `no-restricted-globals` for `confirm` and `no-restricted-properties` for `window|globalThis|self.confirm`, on `app/**/*.{ts,tsx}` except tests. `alert()` and `prompt()` are deliberately not banned yet (see open threads).
- Vitest backstop `app/lib/__tests__/no-native-confirm.test.ts` scans `app/` (comments stripped), because the pre-push hook runs vitest and tsc but not eslint.

## Testing

Component tests are new for this repo: they run in jsdom (`// @vitest-environment jsdom` per file) with `@testing-library/react`, `user-event` and `jest-dom` (dev dependencies added here, `vitest.setup.ts` registers the matchers and a `getAnimations` stub for React Aria's tab indicator). Existing suites stay in the node environment. **CI runs Node 20**, so `jsdom` is pinned to `^28` (supports Node 20.19+; jsdom 30 needs Node 22.22+ and its undici 8 crashes the vitest worker on Node 20, which is what first failed PR CI). `vitest.setup.ts` also raises the per-test timeout to 30s for jsdom files only, because the full parallel suite on a 2-core runner pushed the heavy React Aria renders past the 5s default. Verified by running the full suite twice under Node 20.20. Each site is tested for: cancel (and Escape) never call the action; confirm calls it once with the right id, even on a double press; the confirm button is `aria-disabled` while pending; a failure is displayed; the old message text; focus returns to the trigger. Server actions are mocked; nothing touches a database.

## Not verified in a browser

The dialogs were exercised in jsdom only, not in a real browser or the Claude preview pane. Visual checks (the portal's dark dialog, the 44px targets at phone width, the exit animation) are still to do before merge.
