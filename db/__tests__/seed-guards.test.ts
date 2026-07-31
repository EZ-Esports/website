/**
 * Structural guards over the two destructive seeds and migration 0026.
 *
 * These read source rather than executing it. Both subjects are things that
 * cannot be exercised in a unit test — running a seed needs a database it is
 * allowed to wipe, and running the migration needs one restored from a dump —
 * but both encode an invariant that is easy to break by accident later, and
 * both broke in exactly that way before this PR. Asserting on the source is a
 * weaker check than running it, and it is a much stronger check than nothing.
 *
 * The migration's real proof is a restore of the production dump into a
 * throwaway cluster, applying 0026, and diffing the backfilled keys against
 * what db/gold-keys.ts derives from the CSVs. That is a manual step; these
 * tests keep the properties it verified from being edited away.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

/** Both wipe tables. db/seed.ts wipes strictly more, including leadership. */
const DESTRUCTIVE_SEEDS = ['seed.ts', 'seed-gold.ts'] as const;

describe.each(DESTRUCTIVE_SEEDS)('%s takes a backup before it deletes anything', (file) => {
  const src = read(file);

  it('imports the guard from db/backup', () => {
    expect(src).toMatch(/import \{ requireFreshBackup \} from '\.\/backup'/);
  });

  // Guarding one seed and not the other is the hole this closes: `db:seed` and
  // `db:seed:gold` are one word apart in package.json, and `db:seed` is the more
  // destructive of the two — it wipes leadership, schools and games outright.
  it('calls it', () => {
    expect(src).toMatch(/^\s*requireFreshBackup\(\);/m);
  });

  it('calls it before the first delete, so a failed backup aborts the run', () => {
    const guard = src.indexOf('requireFreshBackup();');
    const firstDelete = src.indexOf('db.delete(');
    expect(guard).toBeGreaterThan(-1);
    expect(firstDelete).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(firstDelete);
  });
});

describe.each(DESTRUCTIVE_SEEDS)('%s refuses a database it was not pointed at', (file) => {
  const src = read(file);

  it('imports the interlock from db/seed-target', () => {
    expect(src).toMatch(/import \{ assertSeedTargetAllowed \} from '\.\/seed-target'/);
  });

  it('calls it', () => {
    expect(src).toMatch(/^\s*assertSeedTargetAllowed\(\);/m);
  });

  // Ordering matters in both directions. Before the first delete for the obvious
  // reason; before the backup because dumping a production database for a minute
  // and then refusing to touch it is a slow way to say no.
  it('calls it before taking the backup', () => {
    const interlock = src.indexOf('assertSeedTargetAllowed();');
    const backup = src.indexOf('requireFreshBackup();');
    expect(interlock).toBeGreaterThan(-1);
    expect(interlock).toBeLessThan(backup);
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

// The specific line that destroyed the 70 rows this PR exists because of. It is
// a one-line edit to put back, and nothing else in the suite would notice.
describe('db/seed.ts leaves leadership alone', () => {
  const src = read('seed.ts');

  it('does not delete the table', () => {
    expect(src).not.toMatch(/db\.delete\(schema\.leadership\)/);
  });

  it('merges into it instead', () => {
    expect(src).toMatch(/mergeLeadership\(/);
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
