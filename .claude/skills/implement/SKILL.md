---
name: implement
description: Build a scoped feature or fix from a description or a plan, isolated in its own worktree. Load when asked to implement, build, or fix something that will become its own PR — as a standalone task or as a step an orchestrator delegates.
---

# Implement

Turns a described unit of work into a working, isolated change ready for
review.

## Steps

1. **Isolate first.** Enter a dedicated worktree with `EnterWorktree` before
   making any edit, unless the working directory is already under
   `.claude/worktrees/`. This keeps the change reviewable on its own branch
   and keeps unrelated uncommitted work on `main` untouched.
2. **Load context before writing code.** If the work touches UI, load the
   `ui` skill for which primitive and styling convention to use, and check
   the `uiux` skill's case studies for a precedent on the page type being
   touched.
3. **Look for an existing primitive first.** Grep `app/components/ui/` and
   the nearest sibling feature folder for a component, server action, or
   admin panel pattern that already does something close to this task, and
   mirror it. A new admin table, form, or CRUD action almost always has a
   sibling to copy the shape from — find it before writing one from scratch.
4. **Database changes go through Drizzle.** If the change adds or modifies a
   table or column, generate the migration with `npm run db:generate`
   (drizzle-kit) rather than writing SQL by hand.
5. **Verify before calling it done.** Run `npm run lint`, `npm run test`, and
   `npm run build`. For UI changes, follow the `uiux` skill's rule to
   screenshot the rendered page at desktop width and check it visually.
6. **Hand off to review.** Once verification passes, load the `review-loop` skill
   to get an independent pass on the diff before it's considered mergeable.
