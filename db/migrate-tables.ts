/**
 * Table-name extraction for db/migrate.ts's pending-migration scope check.
 * Split out so it can be unit-tested without importing db/migrate.ts, which
 * runs a real migration as a side effect of module load.
 */

/**
 * Trusted outright: the identifier right after CREATE/ALTER/DROP TABLE is
 * never schema-qualified in this repo's migrations — schema-qualified forms
 * only show up on FK REFERENCES targets.
 */
const ANCHORED_TABLE_RE =
  /\b(?:CREATE|ALTER|DROP)\s+TABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?"([A-Za-z_][A-Za-z0-9_]*)"/gi;

/**
 * Catch-all for DML-only migrations with no CREATE/ALTER/DROP TABLE at all.
 * Matches every quoted identifier, including columns/constraints/indexes, so
 * callers must filter it against real table names.
 */
const QUOTED_IDENTIFIER_RE = /"([A-Za-z_][A-Za-z0-9_]*)"/g;

/** Extracts table names from one migration file's SQL text, filtering the catch-all pass against `realTables`. */
export function extractTablesFromSql(sql: string, realTables: ReadonlySet<string>): Set<string> {
  const found = new Set<string>();
  for (const m of sql.matchAll(ANCHORED_TABLE_RE)) found.add(m[1]);
  for (const m of sql.matchAll(QUOTED_IDENTIFIER_RE)) {
    if (realTables.has(m[1])) found.add(m[1]);
  }
  return found;
}
