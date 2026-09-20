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
2. **Consult `spec/` first.** Before writing code, read `spec/`
   (`spec/timeline.md`, `spec/product.md`, `spec/architecture.md`,
   `spec/incidents.md`, `spec/open-threads.md`) as the authoritative 1st point
   of reference for repo memory, architecture patterns, and past incident
   learnings. Git commit history is strictly the last point of reference if
   `spec/` has an explicit gap.
3. **Load context before writing code.** If the work touches UI, load the
   `ui` skill for which primitive and styling convention to use, and check
   the `uiux` skill's case studies for a precedent on the page type being
   touched.
4. **Look for an existing primitive first.** Grep `app/components/ui/` and
   the nearest sibling feature folder for a component, server action, or
   admin panel pattern that already does something close to this task, and
   mirror it. A new admin table, form, or CRUD action almost always has a
   sibling to copy the shape from — find it before writing one from scratch.
5. **Database changes go through Drizzle.** If the change adds or modifies a
   table or column, generate the migration with `npm run db:generate`
   (drizzle-kit) rather than writing SQL by hand.
6. **Update `spec/` as you build.** Every PR must keep `spec/` living. Update
   the relevant spec files in your worktree as part of the PR diff:
   - `spec/timeline.md`: add your PR/feature milestone and summary.
   - `spec/architecture.md`: record new tables, caching rules, or system patterns.
   - `spec/incidents.md`: record root cause and fix if resolving a bug or failure mode.
   - `spec/product.md`: update page routes, admin forms, or user flows.
   - `spec/open-threads.md`: close completed threads or add new follow-ups.
7. **Verify before calling it done.** Run `npm run lint`, `npm run test`, and
   `npm run build`. For UI changes, follow the `uiux` skill's rule to
   screenshot the rendered page at desktop width and check it visually.
8. **Hand off to review.** Once verification passes, load the `review-loop` skill
   to get an independent pass on the diff before it's considered mergeable.
