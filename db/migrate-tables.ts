/**
 * Pure table-name extraction for db/migrate.ts's pending-migration regex
 * pass. Split out from migrate.ts (which calls main() at module load) so this
 * logic can be imported and unit-tested — including from
 * db/__tests__/migrate.test.ts — without triggering a real database
 * connection or a real drizzle-kit migrate invocation as a side effect of the
 * import.
 */

/**
 * Trusted outright: every migration file in this repo quotes the identifier
 * immediately after CREATE/ALTER/DROP TABLE with no schema prefix on the
 * primary target (schema-qualified forms like `"public"."x"` only ever show
 * up on FK REFERENCES targets, never on the table actually being
 * created/altered/dropped) — verified against every current migration file,
 * e.g. 0032_nappy_blade.sql extracts to exactly {leadership_terms, people}.
 */
const ANCHORED_TABLE_RE =
  /\b(?:CREATE|ALTER|DROP)\s+TABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?"([A-Za-z_][A-Za-z0-9_]*)"/gi;

/**
 * Catch-all: every double-quoted identifier in the file. On its own this also
 * matches column, constraint, and index names (e.g. `person_id`,
 * `leadership_terms_year_idx`), so callers must filter it against a real set
 * of table names before trusting a match. Needed so a future DML-only
 * migration (e.g. a bare `UPDATE "members" SET ...` with no CREATE/ALTER/DROP
 * TABLE at all) still gets its table caught — the anchored pass alone would
 * miss it entirely, and missing a table is worse than a bigger dump.
 */
const QUOTED_IDENTIFIER_RE = /"([A-Za-z_][A-Za-z0-9_]*)"/g;

/**
 * Extracts table names from one migration file's SQL text.
 *
 * `realTables` scopes the catch-all pass: over-inclusion (picking up an
 * FK-referenced table that isn't itself mutated) is fine, per the same
 * "bigger dump is safe" principle the fallback-to-full-scope paths in
 * db/migrate.ts follow — but unfiltered, the catch-all pass also matches
 * column/constraint/index names, which is noise, not signal, and must be
 * filtered out.
 */
export function extractTablesFromSql(sql: string, realTables: ReadonlySet<string>): Set<string> {
  const found = new Set<string>();
  for (const m of sql.matchAll(ANCHORED_TABLE_RE)) found.add(m[1]);
  for (const m of sql.matchAll(QUOTED_IDENTIFIER_RE)) {
    if (realTables.has(m[1])) found.add(m[1]);
  }
  return found;
}
