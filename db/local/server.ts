/**
 * A throwaway LOCAL Postgres for trying the site without touching production: an in-process PGlite served
 * over a loopback TCP socket, with every migration applied and its data kept in `.local-db/` (git-ignored).
 *
 * Why this exists: `.env` points at the production database, which does not have the roster-redesign schema
 * (migrations 0060 to 0062) yet, so the app cannot run against it. Nothing here reads `.env` or any remote URL;
 * the server only ever binds 127.0.0.1.
 *
 * Usage (see docs/dev/LOCAL_DB.md):
 *   npm run db:local:start                  migrate through 0061 (the deploy gap) and listen on 127.0.0.1:54329
 *   npm run db:local:start -- --through 0062   the final schema instead
 *   npm run db:local:start -- --fresh       delete .local-db first (needed to change --through)
 *   npm run db:local:start -- --port 54400
 *
 * Leave it running in its own terminal. Ctrl+C stops it and flushes the data directory.
 */
import { existsSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { applyMigrations } from '../__tests__/helpers/pglite-migrations';

export const LOCAL_HOST = '127.0.0.1';
export const DEFAULT_PORT = 54329;
export const LOCAL_DB_DIR = resolve(process.cwd(), '.local-db', 'pgdata');

/** Migration tags a local database can stop at. 0061 is the schema between "migrations applied" and "contract applied". */
export const THROUGH_CHOICES = {
  '0060': '0060_rosters_scope_expand',
  '0061': '0061_rosters_scope_constrain',
  '0062': '0062_rosters_scope_contract',
} as const;
export type ThroughChoice = keyof typeof THROUGH_CHOICES;

export function localDatabaseUrl(port = DEFAULT_PORT): string {
  return `postgres://postgres:postgres@${LOCAL_HOST}:${port}/postgres`;
}

export interface ServerArgs {
  through: ThroughChoice;
  fresh: boolean;
  port: number;
}

export function parseServerArgs(argv: string[]): ServerArgs {
  const args: ServerArgs = { through: '0061', fresh: false, port: DEFAULT_PORT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fresh') args.fresh = true;
    else if (a === '--through') {
      const v = argv[++i];
      if (!(v in THROUGH_CHOICES)) throw new Error(`--through must be one of ${Object.keys(THROUGH_CHOICES).join(', ')}`);
      args.through = v as ThroughChoice;
    } else if (a === '--port') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1024 || n > 65535) throw new Error('--port must be a number between 1024 and 65535');
      args.port = n;
    } else throw new Error(`Unknown argument "${a}".`);
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseServerArgs(process.argv.slice(2));
  if (args.fresh && existsSync(LOCAL_DB_DIR)) {
    rmSync(resolve(LOCAL_DB_DIR, '..'), { recursive: true, force: true });
    console.log('Deleted .local-db');
  }
  mkdirSync(LOCAL_DB_DIR, { recursive: true });

  const db = new PGlite(LOCAL_DB_DIR);
  await db.waitReady;
  await db.exec(`create table if not exists _local_dev_meta (key text primary key, value text not null)`);
  const meta = (await db.query<{ value: string }>(`select value from _local_dev_meta where key = 'through'`)).rows[0];

  if (!meta) {
    console.log(`Applying migrations through ${args.through} ...`);
    const report = await applyMigrations(db, { through: THROUGH_CHOICES[args.through] });
    console.log(`  applied ${report.applied} statements, skipped ${report.skipped.length} (extensions / Supabase-only statements)`);
    await db.query(`insert into _local_dev_meta (key, value) values ('through', $1)`, [args.through]);
  } else if (meta.value !== args.through) {
    throw new Error(
      `This local database was built through ${meta.value}. Start with --fresh to rebuild it through ${args.through}.`,
    );
  } else {
    console.log(`Reusing the local database (migrations through ${meta.value}).`);
  }

  const server = new PGLiteSocketServer({ db, port: args.port, host: LOCAL_HOST, maxConnections: 10 });
  await server.start();
  console.log(`\nLocal Postgres is listening on ${LOCAL_HOST}:${args.port} (loopback only).`);
  console.log(`DATABASE_URL=${localDatabaseUrl(args.port)}\n`);
  console.log('Next: npm run db:local:seed   then   npm run dev:local   (Ctrl+C here stops the database)');

  const stop = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (process.argv[1] && /db[\\/]local[\\/]server\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error('Local database failed to start:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
