# Codebase Quality Audits

This directory contains the dated historical records of full-tree codebase quality audits conducted across the EZ Esports repository.

## Why audits live in `docs/audits/` instead of `specs/`

- **Assessment Reports vs Implementation Specs**: `specs/` holds design specifications for active and upcoming features (e.g. `specs/leadership-architecture.md`, `specs/db-backup-automation.md`). An audit is a point-in-time assessment of code health, architecture drift, security posture, and technical debt across the entire repo.
- **Historical Continuity**: Audits occur periodically (e.g., quarterly, pre-season, after major architectural pivots). Storing them as dated files (`docs/audits/YYYY-MM-DD-codebase-quality-audit.md`) preserves an immutable record of past findings and prevents successive audits from overwriting each other.
- **Repository Living Memory**: High-level findings and architectural resolutions from these audits are summarized into `spec/timeline.md` and `spec/incidents.md`, with full detailed findings archived here.

## Audit Naming Convention

All audit reports are named using ISO date prefixes:
```
docs/audits/<YYYY-MM-DD>-codebase-quality-audit.md
```

## How to Run a New Codebase Quality Audit

To conduct an autonomous, comprehensive full-tree audit:

1. **Invoke the Codebase Quality Auditor Agent**:
   - In Claude Code:
     ```text
     /agent codebase-quality-auditor
     ```
     Or prompt: "Run a full-tree codebase quality audit using the codebase-quality-auditor agent."
   - In Antigravity / Gemini CLI:
     ```bash
     agy agent codebase-quality-auditor
     ```
     Or invoke via `invoke_subagent` specifying the `codebase-quality-auditor` agent definition.

2. **Auditor Workflow**:
   - The agent creates an isolated worktree (`docs/codebase-quality-audit-<YYYY-MM-DD>`).
   - Gathers project memory from `spec/` to understand existing invariants.
   - Evaluates the repository across the 8 core scopes (Auth, DB, Admin CMS, Marketing, UI/A11y, Game Domain, Forms, Architecture).
   - Deduplicates findings into PR-sized units (12–18 issues).
   - Produces the dated report in `docs/audits/<YYYY-MM-DD>-codebase-quality-audit.md`.
   - Optionally files corresponding GitHub issues with `priority: high|medium|low`.

## Audit Index

| Date | Target HEAD | Scope & Summary | Report Link |
|---|---|---|---|
| **2026-09-13** | `926b978` | Initial 8-domain full-tree audit. Identified 18 PR-sized follow-ups (#143–#160) covering auth races, upload security, calendar timezones, and cache invalidation. | [2026-09-13 Audit](2026-09-13-codebase-quality-audit.md) |
