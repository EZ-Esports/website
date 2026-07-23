---
name: review
description: Independently review a branch, worktree, or diff for correctness and quality, or verify that a previous review's fixes actually resolved the reported issues. Load when asked to review a PR/branch, or to check a fix-up commit against earlier findings.
---

# Review

Covers two distinct passes — pick the one that matches the request.

## Review pass

Given a branch, worktree path, or diff to review:

1. Work from the specific files and risk areas handed to you (an
   orchestrator or caller should name these explicitly — e.g. "check the
   sync effect in `GalleryManagerClient.tsx` for stale-refresh bugs"). Check
   those first, then read the rest of the diff for anything else.
2. Verify auth guards, input validation, and database access patterns match
   the sibling code this change was modeled on.
3. If the change touches interactive UI, check it against the `ui` skill:
   correct RAC primitive for the interaction type, `aria-disabled` vs
   `disabled` on elements that can go inert, `aria-live`/`role="status"` on
   async state changes, tap target size.
4. Report findings with `ReportFindings`, one entry per real issue, each with
   a concrete failure scenario (specific input/state → specific wrong
   result). An empty findings list is a complete, valid outcome — report
   exactly what was checked and confirm it's clean, rather than filling the
   list with cosmetic or hypothetical items to have something to show.

## Verify pass

Given a review's findings plus a fix-up commit that claims to resolve them:

1. For each finding, re-read the fix and check whether it resolves the exact
   failure scenario described — not just whether the code changed in the
   right area.
2. Check whether the fix introduces a new edge case (a common failure mode:
   a fix gates on one condition where the original bug needed two, e.g.
   matching IDs *and* a dirty flag rather than IDs alone).
3. Set `verdict` to `CONFIRMED` for findings that are genuinely fixed, and
   report anything still open as a new finding with its own failure
   scenario — don't silently mark a partial fix as done.
4. Run this pass as a fresh review rather than trusting the fixer's own
   account of what changed, since the fixer's blind spot is usually the same
   one that produced the original bug.
