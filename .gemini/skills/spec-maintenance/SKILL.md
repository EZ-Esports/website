---
name: spec-maintenance
description: Maintain and consult the project specification in `spec/` as the primary living memory and first point of reference for all historical context, architecture decisions, product capabilities, and incident learnings. Update the spec whenever features, fixes, or migrations land, treating git history as the last point of reference.
---

# Spec Maintenance (Agent Memory)

The `spec/` directory is the authoritative living memory for agents working in this repository. It records chronological milestones, current product architecture, operational incidents, and open threads.

## Standing Rules

1. **`spec/` is the 1st point of reference.**
   Before scoping, planning, or implementing any feature, bug fix, or refactor, always consult `spec/`:
   - `spec/timeline.md` — Chronological milestones (Dec 2025–present) with dates, commit SHAs, and PR numbers.
   - `spec/product.md` — Active surface areas, public routes, CMS admin panels, games, and forms.
   - `spec/architecture.md` — Evolution of data access, auth, caching, and frontend conventions.
   - `spec/incidents.md` — Cautionary history of production incidents, root causes, and standing rules.
   - `spec/open-threads.md` — Unfinished work, pending PRs, and planned follow-ups.

2. **Git history is the LAST point of reference.**
   Do NOT excavate `git log`, `git blame`, or multi-month commit histories from scratch. Git history is costly, noisy, and prone to misinterpreting transient states. Only inspect raw git commits if `spec/` explicitly lacks a specific SHA or detail.

3. **Keep `spec/` living — update it on every landed change.**
   Whenever an issue is resolved, a feature is completed, or a PR is merged, update `spec/` before considering the task closed:
   - **Timeline (`spec/timeline.md`)**: Add a dated entry under the relevant month/era with the PR number, branch, commit SHA, and a concise summary of the shipped change.
   - **Product (`spec/product.md`)**: Update if public pages, admin features, or game workflows changed.
   - **Architecture (`spec/architecture.md`)**: Record any new architectural patterns, schema changes, library upgrades, or data invariants.
   - **Incidents (`spec/incidents.md`)**: If a bug fix resolves a data corruption, security flaw, or cache issue, log the failure scenario, root cause, and preventative guard.
   - **Open Threads (`spec/open-threads.md`)**: Mark completed threads as done, remove resolved items, or add newly discovered follow-up work.

---

## Workflow for Agents

### When Starting a Task
1. Read the relevant files in `spec/` to understand existing invariants and prior decisions.
2. Cross-reference `CLAUDE.md` for operational hazards (production DB, Vercel cache, PII).
3. Frame the proposed solution to align with established architecture in `spec/architecture.md`.

### When Finishing a Task / Merging a PR
1. Edit `spec/timeline.md` to append the new milestone with PR number and summary.
2. Edit `spec/product.md` / `spec/architecture.md` / `spec/incidents.md` if the change altered capabilities or fixed an incident.
3. Check `spec/open-threads.md` to remove resolved items.
4. Commit spec updates alongside the feature or as part of the post-merge cleanup step.
