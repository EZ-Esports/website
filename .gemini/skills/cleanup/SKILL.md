---
name: cleanup
description: Clean up branches and worktrees after a PR has merged, or when asked to tidy up local/remote git state. Load after a merge completes, or when asked to clean up branches or worktrees.
---

# Cleanup

Removes finished work from local and remote git state while preserving
in-progress workspaces and branches.

## Steps

1. Confirm the target branch is merged into `main`: `git branch --merged main`.
   Only delete branches that are explicitly confirmed in this merged list.
2. Protect uncommitted work on `main`: check with `git status`. If working
   tree changes exist, run `git stash push -u`, complete cleanup, and run
   `git stash pop` at the end.
3. Pull `main` up to date. If the merged branch introduced a database migration,
   run `npm run db:migrate` on `main`.
4. Delete the local branch, and delete the matching remote branch.
5. Remove the worktree: use `git worktree remove` directly for any completed worktree directories.
6. Confirm `spec/` is up to date: verify `spec/timeline.md` and related spec files on `main` reflect the merged PR and its architectural impact.
7. Confirm the stash was restored (if stashed in step 2) and that `git status` is clean before finishing.
