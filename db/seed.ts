/**
 * @deprecated RETIRED (DB-3, DB-10)
 *
 * `db/seed.ts` has been retired.
 *
 * It previously performed a destructive delete-and-reinsert of core tables with new UUIDs,
 * which wiped news_posts and caused stale-cache empty-page failures (Vercel Data Cache).
 *
 * Use the non-destructive upsert seeds instead:
 *   - npm run db:seed:gold        (upserts games, schools, seasons, teams, rosters, members, players, matches, standings)
 *   - npm run db:seed:leadership  (merges staff & leadership records)
 */
import { assertSeedTargetAllowed } from './seed-target';

export function main(): void {
  assertSeedTargetAllowed();
  console.error(
    'Error: `db/seed.ts` is retired to prevent UUID churn and data destruction (DB-3, DB-10).\n' +
      'It previously deleted core tables and regenerated UUIDs, causing stale-cache empty-page failures.\n\n' +
      'Use the canonical scripts instead:\n' +
      '  npm run db:seed:gold        - Upserts archive data preserving existing row IDs\n' +
      '  npm run db:seed:leadership  - Merges leadership records without destructive wipes\n'
  );
  process.exit(1);
}

if (process.argv[1] && (process.argv[1].endsWith('seed.ts') || process.argv[1].includes('seed.ts'))) {
  main();
}
