import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { PGlite } from '@electric-sql/pglite';

const DIR = resolve(__dirname, '..', '..', 'migrations');

export interface MigrationReport {
  applied: number;
  skipped: { file: string; statement: string; error: string }[];
}

/**
 * Applies db/migrations/*.sql, in journal order, to an in-memory PGlite. A statement PGlite
 * cannot run (extensions, policies that name the Supabase `auth` schema, roles) is skipped and
 * reported; tables, constraints, FKs and ON DELETE behaviour are applied as written.
 */
export async function applyMigrations(db: PGlite): Promise<MigrationReport> {
  const journal = JSON.parse(readFileSync(resolve(DIR, 'meta/_journal.json'), 'utf8')) as { entries: { tag: string }[] };
  // Stand-ins for what Supabase provides, so policies and grants load instead of being skipped.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
  `);
  const report: MigrationReport = { applied: 0, skipped: [] };
  for (const { tag } of journal.entries) {
    const text = readFileSync(resolve(DIR, `${tag}.sql`), 'utf8');
    for (const raw of text.split('--> statement-breakpoint')) {
      const statement = raw.trim();
      if (!statement) continue;
      try {
        await db.exec(statement);
        report.applied++;
      } catch (err) {
        report.skipped.push({ file: tag, statement: statement.slice(0, 100), error: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  return report;
}
