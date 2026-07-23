---
name: cleanup
description: Clean up branches and worktrees after a PR has merged, or when asked to tidy up local/remote git state. Load after a merge completes, or when asked to clean up branches or worktrees.
---

# Cleanup

Removes finished work from local and remote git state without disturbing
anything still in progress.

## Steps

1. Confirm the target branch is actually merged into `main`: `git branch
   --merged main` should list it. Treat branches missing from that list as
   still in progress and leave them alone.
2. If there's unrelated uncommitted work sitting on `main` (check with `git
   status` before touching anything), protect it first: `git stash push -u`,
   do the rest of this cleanup, then `git stash pop` at the end to restore
   it.
3. Pull `main` up to date, and if the merged branch included a database
   migration, run `npm run db:migrate` now that `main` has it.
4. Delete the local branch, and delete the matching remote branch.
5. Remove the worktree: use `ExitWorktree` for a worktree this session
   entered, or `git worktree remove` directly for a stale worktree left by
   another session that's no longer tracked.
6. Confirm the stash was restored (if one was created in step 2) and that
   `git status` is clean before finishing.
