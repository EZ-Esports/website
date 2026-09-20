---
name: implement
description: Build a scoped feature or fix from a description or a plan, isolated in its own worktree. Load when asked to implement, build, or fix something that will become its own PR — as a standalone task or as a step an orchestrator delegates.
---

# Implement

Turns a described unit of work into a working, isolated change ready for
review.

## Steps

1. **Isolate first.** Enter a dedicated worktree or workspace before making any edit, unless the working directory is already under `.gemini/worktrees/`. This ensures the change remains isolated on its own branch while preserving the cleanliness of the main repository root.
2. **Consult `spec/` first.** Before writing code, read `spec/` (`spec/timeline.md`, `spec/product.md`, `spec/architecture.md`, `spec/incidents.md`, `spec/open-threads.md`) as the primary authoritative source for repository context, architectural standards, and past incident learnings. Reserve Git history strictly as an auxiliary fallback when researching a specific topic that `spec/` explicitly lacks.
3. **Load context before writing code.** When the work touches UI, load the `ui` skill for primitive selection and styling conventions, and consult the `uiux` skill's case studies for precedents on the targeted page type.
4. **Reuse existing primitives.** Grep `app/components/ui/` and the nearest sibling feature folder for existing components, server actions, or admin panel patterns that address similar requirements, and mirror their structure.
5. **Database changes go through Drizzle.** When adding or modifying a table or column, always generate the migration with `npm run db:generate` (drizzle-kit) to produce tracked schema changes.
6. **Update `spec/` as you build.** Keep `spec/` living by updating the relevant spec files in your workspace directly as part of the PR diff:
   - `spec/timeline.md`: record your PR/feature milestone and summary.
   - `spec/architecture.md`: record new tables, caching rules, or system patterns.
   - `spec/incidents.md`: record root cause and fix when resolving a bug or failure mode.
   - `spec/product.md`: update page routes, admin forms, or user flows.
   - `spec/open-threads.md`: close completed threads or record new follow-ups.
7. **Verify before calling it done.** Run `npm run lint`, `npm run test`, and `npm run build`. For UI changes, follow the `uiux` skill's rule to screenshot the rendered page at desktop width and inspect it visually.
8. **Hand off to review.** Once verification passes, load the `review-loop` skill to obtain an independent pass on the diff before considering it mergeable.
