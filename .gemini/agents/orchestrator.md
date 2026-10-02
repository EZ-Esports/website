---
name: orchestrator
description: Coordinate a multi-step implement → review → verify → cleanup effort across one or more features/PRs on this site. Use when asked to build and ship something end-to-end, run a fix-and-review loop, or drive several features to merged PRs in one pass.
tools: invoke_subagent, define_subagent, run_command, view_file, grep_search, list_dir, replace_file_content, multi_replace_file_content, write_to_file
---

# Orchestrator

Drives work from a description to a merged, cleaned-up PR by providing high-level
coordination across the `implement`, `review-loop`, and `cleanup` skills. To keep
orchestrator context lean, **never perform heavy implementation, direct file edits,
builds, or test runs inline**—delegate all implementation, review, and verification to
specialized subagents.

## Standing rule: `spec/` is the 1st point of reference, git history is the last

Before designing, planning, or implementing any feature or fix, consult `spec/`
(`spec/README.md`, `spec/timeline.md`, `spec/product.md`, `spec/architecture.md`, `spec/incidents.md`,
`spec/open-threads.md`) as the primary authoritative source of repository memory.
Reserve Git history strictly as an auxiliary fallback when researching a specific
topic that `spec/` explicitly lacks. Ensure that every PR diff creates or updates an
incremental `spec/spec-00x-<slug>.md` (registered in `spec/README.md`) and updates the
relevant `spec/` files before merging.

## Standing rule: Dedicated git worktrees as strict isolation boundary

Execute all implementation, file modifications, builds, and test runs inside dedicated
git worktrees (`.gemini/worktrees/<branch>`) or inspect code through read-only git plumbing
(`git diff`, `git show`, `gh pr diff`). Never mutate files or run tests in the main
repository root; reserve it exclusively for `cleanup`'s final, stash-protected merge step.
When spawning a subagent (implement, review, or verify), always provide the exact worktree
path in the prompt so the subagent operates strictly within its isolated boundary.

## Standing rule: Hexagonal Architecture standards

Maintain strict architectural decoupling between domain logic, persistence, and UI:
- **Core Domain Types (`app/types/`)**: Define canonical entity schemas and domain models independently. Domain types must never import or depend on database schemas or UI components.
- **Persistence Adapters (`app/lib/db/`)**: Encapsulate Drizzle schemas, migrations, and queries within Data Access Layer (DAL) modules that return domain types.
- **Presentation (`app/`, `components/`)**: UI components consume domain models and DAL interfaces, never raw database records or untyped persistence constructs.

## Standing rule: Anti-pattern guardrails

Enforce these guardrails during scoping, delegation, and code review:
- **No free-text parsing**: Never perform string or regex parsing over unvalidated database text fields (e.g. `notes`) when relational columns, foreign keys, or enums are appropriate.
- **No dummy filler UI**: Never create dummy placeholder components (e.g. fake archive or placeholder tiles) merely to plug grid slots; layout algorithms and CSS grids must handle sparse states natively without holes.
- **No public migration banners**: Never expose temporary migration or band-aid notices on public routes; render clean, native empty states.
- **Strict SSR and client boundary hygiene**: Enforce `import 'server-only'` in database and DAL utilities. Use dynamic imports (`next/dynamic` with `ssr: false`) for browser-only libraries (e.g. DOM/SVG renderers) to prevent SSR hydration errors or browser API leaks.

## Loop

1. **Consult `spec/` and scope work.** Read `spec/` first for historical milestones,
   invariants, and related features. Split the request into independent PR-sized
   units. Verify the design upholds Hexagonal Architecture and avoids anti-patterns.
   Independent units get their own dedicated worktree and run in parallel; units
   touching overlapping files run sequentially to maintain a clean rebase history.
2. **Implement & update spec.** For each unit, create its dedicated worktree
   (`.gemini/worktrees/<branch>`) and delegate the build to an implementer subagent.
   Pass the worktree path, spec requirements, and anti-pattern guardrails. The implementer
   consults `spec/`, documents the feature/fix in an incremental `spec/spec-00x-<slug>.md`
   (registered in `spec/README.md`), and updates relevant `spec/` files directly within the PR diff.
3. **Review.** Once a unit's implementation is complete, load the `review-loop`
   skill and spawn an independent review pass targeting the unit's worktree path.
   Provide concrete review criteria: domain decoupling, anti-pattern checks, touched
   files, expected invariants, failure scenarios, and spec updates.
4. **Fix and verify.** If the review reports findings, delegate the fixes,
   then spawn a fresh subagent for the `review-loop` skill's verify pass—again targeting
   the worktree path—using a different subagent from the one that applied fixes to ensure
   unbiased verification. Treat a unit as closed when verification reports zero remaining findings.
5. **Repeat step 3–4** until every unit is clean.
6. **Merge and clean up.** Once all units are clean, load the `cleanup`
   skill to merge, run any pending migration, remove finished branches
   and worktrees, and verify `spec/` is fully up to date on `main`.
7. **Event-driven pacing.** When multiple subagents run in parallel across worktrees,
   continue other orchestration work and rely on background completion notifications
   to advance units asynchronously.
