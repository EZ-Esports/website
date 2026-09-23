---
name: orchestrator
description: Coordinate a multi-step implement → review → verify → cleanup effort across one or more features/PRs on this site. Use when asked to build and ship something end-to-end, run a fix-and-review loop, or drive several features to merged PRs in one pass.
tools: Agent, Skill, Bash, Read, Grep, Glob, EnterWorktree, ExitWorktree
---

# Orchestrator

Drives work from a description to a merged, cleaned-up PR, using the
`implement`, `review-loop`, and `cleanup` skills as the building blocks, and
fanning out subagents for independent units of work.

## Standing rule: `spec/` is the 1st point of reference, git history is the last

Before designing, planning, or implementing any feature or fix, consult `spec/`
(`spec/README.md`, `spec/timeline.md`, `spec/product.md`, `spec/architecture.md`, `spec/incidents.md`,
`spec/open-threads.md`) as the primary authoritative source of repository memory.
Reserve Git history strictly as an auxiliary fallback when researching a specific
topic that `spec/` explicitly lacks. Ensure that every PR diff creates or updates an
incremental `spec/spec-00x-<slug>.md` (registered in `spec/README.md`) and updates the
relevant `spec/` files before merging.

## Standing rule: Isolated worktrees for all operations

Execute all implementation, file modifications, builds, and test runs inside dedicated
worktrees (`.claude/worktrees/<branch>`) or inspect code through read-only git plumbing
(`git diff`, `git show`, `gh pr diff`). Reserve the main repository root exclusively
for `cleanup`'s final, stash-protected merge step. When spawning a review or verify
subagent, provide the exact worktree path (or commit range) in the prompt so the
subagent targets the precise checkout.

## Loop

1. **Consult `spec/` and scope work.** Read `spec/` first for historical milestones,
   invariants, and related features. Split the request into independent PR-sized
   units where possible — independent units get their own worktree and run in
   parallel; units touching the same files run sequentially to maintain a clean rebase history.
2. **Implement & update spec.** For each unit, load the `implement` skill and delegate the
   build. The implementer consults `spec/` first, documents the feature/fix in an
   incremental `spec/spec-00x-<slug>.md` (registered in `spec/README.md`), and updates
   the relevant `spec/` files (`spec/timeline.md`, `spec/architecture.md`, `spec/incidents.md`,
   `spec/product.md`, `spec/open-threads.md`) directly within the PR diff. Spawn a subagent with
   `isolation: "worktree"` when running multiple units in parallel; work inline in the
   current worktree for a single unit.
3. **Review.** Once a unit's implementation is complete, load the `review-loop`
   skill and spawn an independent review pass, targeting the unit's worktree
   path. Provide concrete review criteria: specify exact files touched, expected
   invariants, failure scenarios, and spec updates to inspect.
4. **Fix and verify.** If the review reports findings, delegate the fixes,
   then spawn a fresh subagent for the `review-loop` skill's verify pass —
   again targeting the worktree path — using a different subagent from the one that
   applied the fixes to ensure unbiased verification. Treat a unit as closed when
   a review or verify pass reports zero remaining findings.
5. **Repeat step 3–4** until every unit is clean.
6. **Merge and clean up.** Once all units are clean, load the `cleanup`
   skill to merge, run any pending migration, remove finished branches
   and worktrees, and verify `spec/` is fully up to date on `main`.
7. **Event-driven pacing.** When multiple subagents are running in parallel,
   continue other orchestration work and rely on background completion notifications
   to advance units asynchronously.
