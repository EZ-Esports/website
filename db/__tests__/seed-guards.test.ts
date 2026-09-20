/**
 * Structural guards over database seeds, migrations, backfills, push guards, and migration 0026.
 *
 * These read source rather than executing it where appropriate. Subjects like
 * running migrations or destructive seeds cannot be fully exercised in a unit test
 * without a dedicated throwaway cluster, but asserting structural invariants on
 * the source prevents accidental regressions.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';
import { determineScope } from '../migrate';
import { ALLOW_REMOTE_ENV } from '../seed-target';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('db/seed-gold.ts takes a backup before it deletes anything', () => {
  const src = read('seed-gold.ts');

  it('imports the guard from db/backup', () => {
    expect(src).toMatch(/import \{ requireFreshBackup \} from '\.\/backup'/);
  });

  it('calls it, scoped to a table list', () => {
    expect(src).toMatch(/^\s*requireFreshBackup\(\w+\);/m);
  });

  it('calls it before the run mutates anything, so a failed backup aborts', () => {
    const body = src.slice(src.indexOf('async function main()'));
    const guard = body.search(/requireFreshBackup\(\w+\);/);
    const firstMutation = body.search(/db\s*\.\s*(insert|delete)\s*\(/);
    expect(guard).toBeGreaterThan(-1);
    expect(firstMutation).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(firstMutation);
  });

  it('calls assertSeedTargetAllowed() before taking the backup', () => {
    const interlock = src.indexOf('assertSeedTargetAllowed();');
    const backup = src.search(/requireFreshBackup\(\w+\);/);
    expect(interlock).toBeGreaterThan(-1);
    expect(backup).toBeGreaterThan(-1);
    expect(interlock).toBeLessThan(backup);
  });
});

/**
 * Audit IDs: DB-3, DB-9, ARCH-9, DB-10.
 * Every operational script capable of mutating DB state must refuse a non-loopback
 * DATABASE_URL without SEED_ALLOW_REMOTE.
 */
const GATED_SCRIPTS = [
  { file: 'seed-gold.ts', importPattern: /import \{ assertSeedTargetAllowed \} from '\.\/seed-target'/ },
  { file: 'seed-leadership.ts', importPattern: /import \{ assertSeedTargetAllowed \} from '\.\/seed-target'/ },
  { file: 'migrate.ts', importPattern: /import \{ assertSeedTargetAllowed \} from '\.\/seed-target'/ },
  { file: '../drizzle.config.ts', importPattern: /import \{ assertSeedTargetAllowed \} from '\.\/db\/seed-target'/ },
  { file: 'backfill-leadership.ts', importPattern: /import \{ assertSeedTargetAllowed \} from '\.\/seed-target'/ },
  { file: 'seed-owner.ts', importPattern: /import \{ assertSeedTargetAllowed \} from '\.\/seed-target'/ },
  { file: '../app/lib/db/seed-phase2.ts', importPattern: /import \{ assertSeedTargetAllowed \} from '\.\.\/\.\.\/\.\.\/db\/seed-target'/ },
  { file: 'seed.ts', importPattern: /import \{ assertSeedTargetAllowed \} from '\.\/seed-target'/ },
] as const;

describe.each(GATED_SCRIPTS)('$file refuses an unauthorized remote database', ({ file, importPattern }) => {
  const src = read(file);

  it('imports the interlock from seed-target', () => {
    expect(src).toMatch(importPattern);
  });

  it('calls assertSeedTargetAllowed()', () => {
    expect(src).toMatch(/assertSeedTargetAllowed\(\)/);
  });
});

describe('db/migrate.ts host gate ordering', () => {
  const src = read('migrate.ts');

  it('calls assertSeedTargetAllowed() at the very start of main() before determining scope', () => {
    const mainBody = src.slice(src.indexOf('async function main()'));
    const gate = mainBody.indexOf('assertSeedTargetAllowed();');
    const determine = mainBody.indexOf('determineScope();');
    expect(gate).toBeGreaterThan(-1);
    expect(determine).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(determine);
  });

  it('calls assertSeedTargetAllowed() before taking pre-migration backup', () => {
    const mainBody = src.slice(src.indexOf('async function main()'));
    const gate = mainBody.indexOf('assertSeedTargetAllowed();');
    const backup = mainBody.search(/requireFreshBackup\(/);
    expect(gate).toBeGreaterThan(-1);
    expect(backup).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(backup);
  });

  it('calls assertSeedTargetAllowed() inside determineScope when owning connection', () => {
    const determineBody = src.slice(src.indexOf('export async function determineScope('));
    const ownsConn = determineBody.indexOf('if (ownsConnection)');
    const gateInside = determineBody.indexOf('assertSeedTargetAllowed();', ownsConn);
    expect(ownsConn).toBeGreaterThan(-1);
    expect(gateInside).toBeGreaterThan(-1);
  });
});

describe('drizzle.config.ts push guard', () => {
  const src = read('../drizzle.config.ts');

  it('gates drizzle-kit push against remote targets', () => {
    expect(src).toMatch(/process\.argv\.(some|includes)\(.*push.*\)/);
    expect(src).toMatch(/assertSeedTargetAllowed\(\)/);
  });
});


describe('app/lib/db/seed-phase2.ts cannot silently write production CMS rows', () => {
  const src = read('../app/lib/db/seed-phase2.ts');

  it('is marked as deprecated / unsafe', () => {
    expect(src).toMatch(/@deprecated/);
  });

  it('calls assertSeedTargetAllowed() before inserting CMS rows', () => {
    const seedFunc = src.slice(src.indexOf('async function seedPhase2()'));
    const gate = seedFunc.indexOf('assertSeedTargetAllowed();');
    const insert = seedFunc.search(/db\s*\.\s*insert\(/);
    expect(gate).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(insert);
  });
});

describe('db/seed.ts retirement and UUID-churn prevention', () => {
  const src = read('seed.ts');

  it('is marked as deprecated / retired', () => {
    expect(src).toMatch(/@deprecated/);
  });

  it('does not delete news_posts', () => {
    expect(src).not.toMatch(/db\.delete\(schema\.newsPosts\)/);
  });

  const CORE_TABLES = [
    'newsPosts', 'matches', 'players', 'rosters',
    'teams', 'seasons', 'members', 'schools', 'games', 'leadership',
  ];

  it.each(CORE_TABLES)('does not delete schema.%s', (table) => {
    expect(src).not.toMatch(new RegExp(`db\\.delete\\(schema\\.${table}\\)`));
  });

  it('does not insert or churn row UUIDs', () => {
    expect(src).not.toMatch(/db\.insert\(/);
  });

  it('refuses execution and directs operators to gold and leadership seeds', () => {
    expect(src).toMatch(/db:seed:gold/);
    expect(src).toMatch(/db:seed:leadership/);
    expect(src).toMatch(/process\.exit\(1\)/);
  });
});

describe('.gitignore sharepoint nested CSVs', () => {
  const gitignore = read('../.gitignore');

  it('ignores nested CSVs under sharepoint to prevent PII leaks', () => {
    expect(gitignore).toMatch(/sharepoint\/\*\*\/\*\.csv/);
  });
});

// The constraint that destroyed the 70 rows. Both seeds wipe `members`, so
// whether leadership survives that is decided entirely here. Reverting it is a
// one-word edit, and every comment claiming leadership is safe depends on it.
describe('leadership.member_id does not cascade', () => {
  it('is SET NULL in the schema', () => {
    const src = readFileSync(
      resolve(__dirname, '..', '..', 'app', 'lib', 'db', 'schema.ts'),
      'utf8'
    );
    const table = src.slice(src.indexOf('export const leadership = pgTable'));
    const memberId = table.slice(0, table.indexOf('name: text('));
    expect(memberId).toMatch(/onDelete:\s*'set null'/);
    expect(memberId).not.toMatch(/onDelete:\s*'cascade'/);
  });

  it('is SET NULL in the migration that changes it', () => {
    const sql = read('migrations/0027_redundant_sharon_ventura.sql');
    expect(sql).toMatch(/ALTER TABLE "leadership".*ON DELETE set null/s);
  });
});

// The gold seed's whole failure mode was deleting tables it did not own. These
// hold the shape of the rewrite: upserts, and deletes only where a row can be
// proven to have come from the archive.
describe('db/seed-gold.ts upserts rather than wiping', () => {
  const src = read('seed-gold.ts');

  const OWNED = [
    'seasonStandings', 'matches', 'players', 'rosters',
    'teams', 'seasons', 'members', 'schools', 'games',
  ];

  it.each(OWNED)('does not delete schema.%s wholesale', (table) => {
    expect(src).not.toMatch(new RegExp(`db\\.delete\\(schema\\.${table}\\)`));
  });

  it('upserts every table it loads', () => {
    // 9 tables, one onConflictDoUpdate each.
    expect(src.match(/onConflictDoUpdate/g)).toHaveLength(9);
  });

  // The rule the school logos were lost to. gold_schools.csv carries slug, name
  // and display_order; anything else on the table belongs to the admin editor.
  it('never writes an admin-owned school column', () => {
    const upsert = src.slice(src.indexOf('target: schema.schools.slug'));
    const setBlock = upsert.slice(0, upsert.indexOf('.returning()'));
    for (const column of ['logoUrl', 'storageKey', 'websiteUrl', 'isActive']) {
      expect(setBlock).not.toMatch(new RegExp(column));
    }
  });

  // Both guards on the prune. Without isNotNull it deletes admin rows; without
  // the empty-key check a CSV that failed to parse deletes everything.
  it('scopes the prune to archive-stamped rows', () => {
    expect(src).toMatch(/isNotNull\(key\)/);
  });

  it('prunes nothing when the archive yields no keys', () => {
    expect(src).toMatch(/if \(keys\.length === 0\) return 0;/);
  });
});

describe('migration 0026', () => {
  const sql = read('migrations/0026_lush_genesis.sql');

  // The reviewer's finding: createMember has no duplicate check, so two members
  // with the same name at the same school are a legal state, and an
  // unconditional UPDATE aborts the whole migration on them with
  // `Key (member_key)=(...|dan|lu) is duplicated`. Only unambiguous groups are
  // stamped; the rest keep a NULL key, which the NULLS DISTINCT index allows.
  it('backfills member_key only where the derived key is unambiguous', () => {
    const update = sql.slice(sql.indexOf('UPDATE "members"'));
    expect(update).toMatch(/WHERE[\s\S]*group_size = 1/);
    expect(sql).toMatch(/count\(\*\) OVER \(\s*PARTITION BY m\."school_id", lower\(m\."first_name"\), lower\(m\."last_name"\)/);
  });

  // rank is payload. In the key, a rank correction re-keys the row so the
  // upsert inserts a duplicate — and the TFT "All" rows carry league-wide
  // ranks, so one new player would re-key dozens of rows at once.
  it('keys season_standings on source_key, with rank nowhere in the key', () => {
    expect(sql).toContain('ALTER TABLE "season_standings" ADD COLUMN "source_key" text;');
    const prefix = sql.slice(sql.indexOf('FROM "season_standings" ss'));
    expect(sql).toMatch(
      /ss\."division" \|\| '\|' \|\| sc\."slug" \|\| '\|'\s*\|\| coalesce\(ss\."player_name", ''\) AS prefix/
    );
    expect(prefix).not.toMatch(/\|\| ss\."rank"/);
  });

  // NULLS NOT DISTINCT would break a supported admin state: the rank input is
  // optional, so a second rank-less row for the same season/school/division
  // would fail with a unique violation the admin cannot work around.
  it('leaves every unique index NULLS DISTINCT, so admin rows can share a NULL key', () => {
    expect(sql).not.toMatch(/NULLS NOT DISTINCT/i);
    for (const idx of [
      'CREATE UNIQUE INDEX "matches_source_key_unique_idx"',
      'CREATE UNIQUE INDEX "members_member_key_unique_idx"',
      'CREATE UNIQUE INDEX "season_standings_source_key_unique_idx"',
    ]) {
      expect(sql).toContain(idx);
    }
  });

  it('creates the unique indexes after the backfills, not before', () => {
    const lastUpdate = sql.lastIndexOf('UPDATE ');
    const firstIndex = sql.indexOf('CREATE UNIQUE INDEX');
    expect(lastUpdate).toBeLessThan(firstIndex);
  });
});

describe('runtime enforcement of guards', () => {
  const originalUrl = process.env.DATABASE_URL;
  const originalAllow = process.env[ALLOW_REMOTE_ENV];

  afterEach(() => {
    if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
    else delete process.env.DATABASE_URL;
    if (originalAllow !== undefined) process.env[ALLOW_REMOTE_ENV] = originalAllow;
    else delete process.env[ALLOW_REMOTE_ENV];
  });

  it('determineScope() fails closed against a remote target when ownsConnection is true', async () => {
    process.env.DATABASE_URL = 'postgresql://u:pw@db.production.supabase.co:5432/postgres';
    delete process.env[ALLOW_REMOTE_ENV];

    await expect(determineScope()).rejects.toThrow(/not loopback/);
  });

  it('git check-ignore ignores deeply nested CSV files under sharepoint', () => {
    const result = spawnSync('git', ['check-ignore', 'sharepoint/a/b/c/students.csv'], {
      cwd: resolve(__dirname, '../..'),
      encoding: 'utf8',
    });
    expect(result.stdout.trim()).toBe('sharepoint/a/b/c/students.csv');
    expect(result.status).toBe(0);
  });
});

