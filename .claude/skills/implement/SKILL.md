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
   `.claude/worktrees/`. This ensures the change remains isolated on its own branch
   while preserving the cleanliness of the main repository root.
2. **Consult `spec/` first.** Before writing code, read `spec/`
   (`spec/README.md`, `spec/timeline.md`, `spec/product.md`, `spec/architecture.md`,
   `spec/incidents.md`, `spec/open-threads.md`) as the primary authoritative source
   for repository context, architectural standards, and past incident learnings.
   Reserve Git history strictly as an auxiliary fallback when researching a specific
   topic that `spec/` explicitly lacks.
3. **Load context before writing code.** When the work touches UI, load the
   `ui` skill for primitive selection and styling conventions, and consult
   the `uiux` skill's case studies for precedents on the targeted page type.
4. **Reuse existing primitives.** Grep `app/components/ui/` and
   the nearest sibling feature folder for existing components, server actions, or
   admin panel patterns that address similar requirements, and mirror their structure.
5. **Database changes go through Drizzle.** When adding or modifying a
   table or column, always generate the migration with `npm run db:generate`
   (drizzle-kit) to produce tracked schema changes.
6. **Write enduring, context-focused code comments.** Comments serve future
   maintainers by documenting permanent architectural invariants, non-obvious
   domain rules, and component roles. Express comments using positive framing that
   describes what the code is and why it exists. Place transient issue notes, PR
   changelogs, and historical fix descriptions in the pull request description and
   in `spec/spec-00x` documents. Refer to the few-shot examples below.
7. **Update `spec/` as you build.** From this point forward, feature work and
   architectural changes follow the structured incremental `spec-00x` layout
   (`spec/spec-00x-<slug>.md`). Update `spec/` directly in your worktree as part of
   the PR diff:
   - `spec/README.md`: register the new spec in the Specification Index table.
   - `spec/timeline.md`: record your PR milestone and summary linked to your spec.
   - `spec/architecture.md`: record new tables, caching rules, or system patterns.
   - `spec/incidents.md`: record root cause and fix when resolving a bug or failure mode.
   - `spec/product.md`: update page routes, admin forms, or user flows.
   - `spec/open-threads.md`: close completed threads or record new follow-ups.
8. **Verify before calling it done.** Run `npm run lint`, `npm run test`, and
   `npm run build`. For UI changes, follow the `uiux` skill's rule to
   screenshot the rendered page at desktop width and inspect it visually.
9. **Hand off to review.** Once verification passes, load the `review-loop` skill
   to obtain an independent pass on the diff before considering it mergeable.

## Code Comment Guidelines & Few-Shot Prompts

Write comments that illuminate non-obvious architecture, system invariants, or business logic. Frame comments around the permanent design of the code.

### Few-shot examples

#### Example 1: Component & layout boundaries
- **Target comment style:**
  ```tsx
  {/* Left Sidebar */}
  <aside className="w-64 bg-[#1a1a1a] border-r border-line flex flex-col shrink-0 z-20 sticky top-0 h-dvh self-start">
  ```
- **Contrast (transient issue-note style):**
  ```tsx
  {/* Left Sidebar — pinned to the viewport height so footer links never follow page length; the nav never scrolls */}
  <aside ...>
  ```

#### Example 2: Layout positioning and UX invariants
- **Target comment style:**
  ```tsx
  // Sticky positioning keeps primary actions accessible within the viewport across long forms.
  const StickyContainer = ...
  ```
- **Contrast (transient issue-note style):**
  ```tsx
  // Fixed issue where save button was pushed below fold on the team settings page.
  const StickyContainer = ...
  ```

#### Example 3: Domain rationale & data normalization
- **Target comment style:**
  ```ts
  // Canonicalize all match kickoff times to Eastern Time (America/New_York) per league scheduling standards.
  const kickoff = parseEastern(dateString);
  ```
- **Contrast (transient issue-note style):**
  ```ts
  // Switched to parseEastern because user reported timezone offset bug in PR #184.
  const kickoff = parseEastern(dateString);
  ```
