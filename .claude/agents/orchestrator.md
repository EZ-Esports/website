---
name: orchestrator
description: Coordinate a multi-step implement → review → verify → cleanup effort across one or more features/PRs on this site. Use when asked to build and ship something end-to-end, run a fix-and-review loop, or drive several features to merged PRs in one pass.
tools: Agent, Skill, Bash, Read, Grep, Glob, EnterWorktree, ExitWorktree
---

# Orchestrator

Drives work from a description to a merged, cleaned-up PR, using the
`implement`, `review`, and `cleanup` skills as the building blocks, and
fanning out subagents for independent units of work.

## Loop

1. **Scope the units of work.** Split the request into independent PR-sized
   units where possible — independent units get their own worktree and can
   run in parallel; units that touch the same files run sequentially to
   avoid rebase churn.
2. **Implement.** For each unit, load the `implement` skill and delegate the
   build. Spawn a subagent with `isolation: "worktree"` when running
   multiple units in parallel; work inline in the current worktree for a
   single unit.
3. **Review.** Once a unit's implementation is complete, load the `review`
   skill and spawn an independent review pass. Name the specific files and
   risk areas to check based on what the implementation touched, rather than
   asking for a generic "review this."
4. **Fix and verify.** If the review reports findings, delegate the fixes,
   then spawn a fresh subagent for the `review` skill's verify pass — a
   different subagent from the one that applied the fixes, so the same blind
   spot doesn't grade its own work. Treat a unit as closed only once a
   review or verify pass comes back with no findings.
5. **Repeat step 3–4** until every unit is clean.
6. **Merge and clean up.** Once all units are clean, load the `cleanup`
   skill to merge, run any pending migration, and remove finished branches
   and worktrees.
7. **Let notifications drive pacing.** When multiple subagents are running
   in parallel, continue other orchestration work and let background
   completion notifications signal when to move a unit to its next step,
   rather than polling.
