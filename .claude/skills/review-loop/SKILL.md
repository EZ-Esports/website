---
name: review-loop
description: Independently review a branch, worktree, or diff for correctness and quality as part of an implement/review/cleanup cycle, or verify that a previous review's fixes actually resolved the reported issues. Load when asked to review a PR/branch as part of a build-and-ship task, or to check a fix-up commit against earlier findings.
---

# Review loop

Covers two distinct passes — pick the one that matches the request.

## Read the change within isolated checkouts

A review or verify pass operates purely in read-only mode — use one of
these, in order of preference:

1. When provided an existing worktree path for this branch (e.g.
   `.claude/worktrees/<name>`), read files there directly, or run git
   commands scoped to it with `git -C <worktree-path> ...`.
2. View the change through git's read-only plumbing:
   `git diff <base>...<branch>`, `git show <branch>:<path>`, or
   `gh pr diff <number>`.

Reserve the main checkout exclusively for the `cleanup` skill's deliberate,
stash-protected merge step. Keep all code reviews and verification execution
isolated within dedicated worktrees.

When a check requires executing tests or builds, run them strictly inside
the assigned worktree. If none was provided, create one with `EnterWorktree`
before running commands.

## Review pass

Given a branch, worktree path, or diff to review:

1. Target the specific files and risk areas identified by the caller (e.g.
   "check the sync effect in `GalleryManagerClient.tsx` for stale-refresh bugs").
   Evaluate those thoroughly, then review the surrounding diff.
2. Verify auth guards, input validation, and database access patterns match
   the established sibling standards.
3. When the change touches interactive UI, verify compliance with the `ui` skill:
   appropriate RAC primitive for the interaction type, `aria-disabled` vs
   `disabled` on inert elements, `aria-live`/`role="status"` on async updates,
   and adequate tap target size.
4. Verify code comments: Confirm that code comments document permanent
   architectural invariants, domain rules, and component roles rather than
   transient issue notes or bug-fix changelogs, adhering to the few-shot examples
   in the `implement` skill.
5. Verify `spec/` was updated: Confirm the PR diff creates or updates an
   incremental specification (`spec/spec-00x-<slug>.md`), registers it in
   `spec/README.md`'s index table, and updates the relevant repo memory files
   (`spec/timeline.md`, `spec/architecture.md`, `spec/incidents.md`,
   `spec/product.md`, `spec/open-threads.md`). Ensure that changes altering
   architecture, resolving incidents, modifying product surfaces, or hitting
   milestones are accurately recorded.
6. Report findings with `ReportFindings`: provide concrete, actionable entries
   backed by an exact failure scenario (specific input/state → specific wrong result).
   When all verification criteria pass, explicitly report a clean verdict detailing
   the verified invariants.

## Verify pass

Given a review's findings plus a fix-up commit that claims to resolve them:

1. For each finding, re-read the fix and verify whether it resolves the exact
   failure scenario described.
2. Check whether the fix satisfies all edge cases and maintains existing invariants.
3. Set `verdict` to `CONFIRMED` for findings that are genuinely resolved. Record
   any remaining discrepancies as distinct findings with concrete failure scenarios.
4. Independently inspect the updated diff directly to ensure unbiased verification.
