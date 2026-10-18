# Spec-018: manager_invites table

**Issue:** #224. **Branch:** `refactor/manager-invites-table`. **PR:** not opened. **Status:** Code ready, migration `0049` **not applied to production**.

## Problem

School-manager invites lived in `player_invites`, told apart by `role = 'manager'` and a null `game_id` (migration `0043`). Player lists had to filter `role = 'player'`, token validation and submission branched on `invite.role`, and `game_id` could no longer be `NOT NULL`. spec-011 had called for a separate table.

## Decisions

- **Own table.** `manager_invites` holds the same columns as the manager rows minus `game_id` and `role` (`id`, `school_id`, `token_hash` unique, names, `invited_by_user_id`, `status`, `expires_at`, `submitted_at`, `reviewed_at`, `rejection_reason`, `member_id`, `submission_draft`, `created_at`). RLS enabled, no policies, like `player_invites`; the app uses the service role.
- **Migration `0049_manager_invites_table.sql`** (hand-written, journal entry only; the snapshot chain stops at `0042`): create table, copy `role = 'manager'` rows with the same `id` and `token_hash`, abort if the copied count differs, delete the manager rows from `player_invites`, drop `player_invites_school_role_idx` and `role`, abort if any `game_id` is still null, then `SET NOT NULL`. Everything runs in drizzle's migration transaction, so any `RAISE` rolls the whole thing back.
- **Token lookup.** `validateInviteToken`, `saveOnboardingDraft` and `processOnboardingSubmission` look the hash up in `player_invites` first and fall back to `manager_invites`. A manager invite is "the hash was found in `manager_invites`"; nothing reads a role column. Hashes are unique across both tables in practice (SHA-256 of random tokens).
- **Ports.** `createManagerInvite` and `listSchoolManagerInvites` return the new `ManagerInviteRecord`; `PlayerInviteRecord` loses `role` and `gameId` is `string`. The role filters on `listSchoolInvites` and `listPendingSubmissions` are gone. Revoke targets `manager_invites`.
- Cache tags are unchanged: manager acceptance still invalidates `players`, `members`, `schools`.
- **DAL.** Onboarding wizard database access (invite lookups, draft save, the submission transaction and its member, identity, demographics and school-manager writes) lives in `app/lib/db/onboarding.ts`; `wizard-actions.ts` and `wizard/submission-pipeline.ts` only validate, hash tokens, provision Supabase auth and invalidate cache tags. The onboarding repository adapter (`adapters/db/drizzle-onboarding-repository.ts`) also holds no queries: each method delegates to `app/lib/db/onboarding-repository.ts`.

## Rollout

Old code reads manager invites from `player_invites`; new code reads `manager_invites`. Apply `0049` and deploy this code in the same window. Between the two, outstanding manager links fail validation (old code after the migration, new code before it). Take a backup first; the migration deletes rows from `player_invites`.
