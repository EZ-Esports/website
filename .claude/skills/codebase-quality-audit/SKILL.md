---
name: codebase-quality-audit
description: Orchestrate or execute a comprehensive full-tree codebase quality audit across auth, db, admin, marketing, ui, game domain, forms, and architecture. Identify slop, bad logic, security gaps, and technical debt, deduplicate findings into PR-sized units, and produce actionable specs or GitHub issues using isolated worktrees and local verification.
---

# Codebase Quality Audit

Orchestrates or executes an exhaustive full-tree audit of the codebase to identify architectural drift, security vulnerabilities, bad logic, data loss risks, user-visible inconsistencies, accessibility gaps, and code hygiene issues.

## Standing Safety Invariants

1. **Isolated Worktree Execution**: Execute all audit passes, searches, and test suites inside an isolated worktree or inspect git diffs via read-only git plumbing (`git diff`, `git show`, `gh pr diff`). Keep the main repository checkout pristine and reserved for deliberate merges.
2. **Local and Static Verification**: Run all tests, inspections, and schema checks against local test databases or using static analysis and deterministic unit test fixtures. Treat `.env` credentials as strictly isolated from automated audit routines.
3. **PII Masking & Privacy Guard**: Treat all student data in `sharepoint/` and `db/backups/` as strictly confidential. Use synthetic anonymized fixtures in all reports, tests, and logs.
4. **Empirical Verification**: Ground all findings in reproducible runtime behavior or verifiable code analysis. Validate behaviors directly against live code implementations rather than relying on code comments or UI status labels.
5. **Preserve Intentional Architecture**: Recognize and protect established patterns that solve specific repo challenges (such as admin ESLint import fences, fail-closed seed gates, proxy auth gates, and append-only audit triggers) by cataloging them in the "Habits Worth Keeping" section.

---

## The 8 Scoped Audit Domains

When executing a full audit, divide the investigation into eight orthogonal domains:

### 1. Auth & Access Control
- **RBAC Enforcement**: Verify permissions on all server actions, API routes, and page loaders. Match server action checks with UI presentation gates.
- **Session & Privilege Escalation**: Verify role re-reading under transactional lock (`pg_advisory_xact_lock`) before role assignment, edits, or revocation to prevent TOCTOU races.
- **Invite Tokens & Expiry**: Ensure single-use tokens cannot be replayed, leaked in error messages, or retained post-revocation.
- **PII Leakage in Admin**: Ensure staff/admin picker interfaces only query required public/identity fields, never exposing unneeded contact details (emails, phone numbers, Discord tags).

### 2. Database & Data Integrity
- **Schema & Constraints**: Verify foreign key cascades, nullability, unique indexes, and defaults in `schema.ts`.
- **Environment Gates**: Ensure all migration, seed, and backfill scripts enforce `assertSeedTargetAllowed()` to fail-close against remote databases without explicit user bypass.
- **UUID & ID Stability**: Verify seeds do not churn row UUIDs on upsert, which orphans cached references and breaks relational links.
- **Cache Tags & Invalidation**: Verify all mutations call appropriate cache invalidation (`updateTag` in Next.js 16 or `revalidateTag`), matching tags in `queries.ts`.

### 3. Admin CMS & Mutations
- **Authoritative State vs Client Trust**: Derive storage paths and keys deterministically on the server (e.g. scoped storage `${section}/${entityId}/${timestamp}.${ext}`). Validate entity ownership independently of client parameters.
- **Mutation Honesty**: Audit server actions for explicit error propagation: verify mutations return descriptive ActionError payloads on failure and surface errors directly to the user.
- **Transactional Atomicity**: Multi-row or multi-table updates (reordering, batch assignments) must execute inside `db.transaction` with advisory locking.
- **Derived State in Forms**: Prevent dual sources of truth where local React state gets out of sync with updated server props.

### 4. Marketing & Public Surfaces
- **Timezone Canon**: The league operates in Eastern Time (`America/New_York`). All kickoff times, match displays, and calendar calculations must interpret wall time in ET and format with "ET" explicitly.
- **Honest Empty States**: When queries return no data or encounter errors, render clear and explicit empty fallback UI states with truthful user feedback.
- **Status Semantics**: Ensure match statuses (`scheduled`, `in_progress`, `completed`, `forfeit`) and scores display accurate outcomes (e.g. draws vs losses, 0-0 forfeits as completed).
- **SEO & Routing**: Verify canonical host normalization, sitemap generation, and permanent (308) vs temporary redirects.

### 5. UI & Accessibility (a11y)
- **Accessible Primitives**: Use proper primitives (React Aria Components, Radix) for modals, dropdowns, navigations, and calendars.
- **Keyboard & Screen Reader Support**: Verify tab stops, focus rings, focus traps in modals, and `aria-expanded` / `aria-controls` on interactive elements.
- **Reduced Motion**: Respect `prefers-reduced-motion` on all animations and transitions.
- **Token Consistency**: Adhere strictly to the design system (EZ pink `#f4cccc`, dark surface hierarchy, consistent typography and spacing).

### 6. Game Domain & Standings
- **Division Canon**: Unify division names (`A`, `B`, `Varsity`, `JV`) across filters, forms, and match queries to avoid orphaned records.
- **Standings Computation**: Clarify authoritative source of truth (stored snapshot vs dynamically computed table from completed matches).
- **Slug Normalization**: Enforce `GAME_SLUGS` constant rather than ad-hoc string manipulation.

### 7. Forms & Intake
- **Server Validation**: Validate all inputs server-side with robust Zod schemas alongside client HTML validation.
- **Double-Submit Protection**: Enforce unique constraints or advisory locking on applicant submissions.
- **Preserve Applicant Input**: Ensure long-form text (essays, notes) is preserved across submission flows and drafts.
- **Sanitized Exports**: Sanitize CSV generation against formula injection (`=`, `+`, `-`, `@`).

### 8. Architecture & Tooling
- **`server-only` Boundaries**: Mark server-only database utilities and secrets with `import 'server-only'` to prevent client bundle leakage.
- **Authentic Verification**: Focus regression tests on real invariants and critical failure modes, ensuring assertions verify true runtime guarantees.
- **Worktree Safety**: Ensure git hooks and local scripts function correctly within git worktrees.
- **Split-Brain Reads**: Eliminate diverging read paths where different components query conflicting representations of the same underlying data.

---

## Synthesis & Output Protocol

1. **Deduplicate Findings**: Merge overlapping findings across scopes into cohesive problem statements.
2. **Size into PR-Sized Units**: Group findings into focused, independent issues that can each be implemented and reviewed within a single PR (target 12–18 issues, not monolithic epics).
3. **Format Issues**: Each issue must contain:
   - **Audit Trace**: Audit ID and commit reference.
   - **Context & Problem**: Concrete description of current defect.
   - **Failure Scenario**: Specific input/state leading to wrong outcome.
   - **Target Files**: Explicit file paths and line ranges.
   - **Recommended Solution**: Senior-level architectural fix.
   - **Acceptance Criteria**: Verifiable checkboxes.
4. **Prioritize**:
   - `priority: high`: User-visible wrong results, data loss, security vulnerabilities, PII leaks, cache invalidation failures.
   - `priority: medium`: Hardening, a11y, design token unification, tooling hygiene.
5. **Save Dated Report to `docs/audits/`**:
   Save the final audit synthesis to `docs/audits/<YYYY-MM-DD>-codebase-quality-audit.md`, update the index in `docs/audits/README.md`, and record the audit milestone in `spec/timeline.md`.
