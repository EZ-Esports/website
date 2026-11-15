/**
 * Read-only check around migration 0060 (spec-060). Run it BEFORE the migration to preview what it will do, and
 * AFTER to confirm it:
 *   - before: how many rosters per game and season will be backfilled, whether any roster has no team (the one thing
 *     that would make the migration's SET NOT NULL fail, which rolls the whole single-transaction migration back),
 *     and how many membership rows the backfill will add from archived standings.
 *   - after: did every roster get its school, game and season, do they agree with its team, and which membership
 *     rows would the migration still add?
 *
 * Reads only: every statement is a SELECT, nothing is mutated and no backup is taken. It still goes through
 * the seed-target gate, because `.env` here is the production connection string and "read-only" is a claim
 * about this file, not about where it points. The output is counts per game and season: no names, emails or
 * ids of people.
 *
 * Run (the user names the host; against a restored backup first, see docs/dev/LOCAL_DB.md):
 *   SEED_ALLOW_REMOTE=<host> npm run db:verify:roster-backfill [-- --dry-run]
 * `--dry-run` is the default and the only mode.
 *
 * Exit code 1 when, before the migration, a roster has no team, or after it, any roster is unscoped or disagrees
 * with its team.
 */
import postgres from 'postgres';
import { assertSeedTargetAllowed, seedTargetHost } from './seed-target';

/** Anything that can run one SELECT and hand back rows (postgres.js in the script, PGlite in tests). */
export interface RowQuery {
  (text: string): Promise<Record<string, unknown>[]>;
}

export interface ScopeRow {
  game: string;
  season: string;
  rosters: number;
  /** Rosters still missing school, game or season. */
  unscoped: number;
  /** Rosters whose scope disagrees with the team they point at. */
  mismatched: number;
  /** Rosters with no team_id at all (fine after the switch PR, unexpected before it). */
  noTeam: number;
  /** Rosters whose (school, game, season) has no membership row. */
  noMembership: number;
}

export interface VerifyReport {
  migrationApplied: boolean;
  scopes: ScopeRow[];
  /** Membership rows the migration's step 5 would still insert, by source. */
  missingMembership: { standings: number };
  /** Rosters step 6 of 0060 will add (before) or would still add (after), per game and season. */
  rostersToAdd: { game: string; season: string; count: number }[];
  /** Only when the migration is NOT applied yet: what it is going to do. */
  preview?: { scopes: { game: string; season: string; rosters: number; noTeam: number }[] };
}

/**
 * Rosters each membership lacks, mirroring step 6 of 0060 (and planSchoolRosters in app/lib/season-schools.ts):
 * Varsity + JV, Minecraft Varsity only, TFT / osu! / TETR.IO a single All. `scope` says how a roster belongs to a
 * membership row `t`: through team_id before the migration, through school/game/season after it.
 */
function rostersToAddSql(scope: string): string {
  return `
    select g.slug as game, s.name as season, count(*)::int as n
    from teams t
    join games g on g.id = t.game_id
    join seasons s on s.id = t.season_id
    cross join (values ('Varsity', 1), ('JV', 2), ('All', 3)) as v(canon, ord)
    where case
        when g.slug in ('team-fight-tactics', 'osu', 'tetris', 'tetr-io', 'tetrio') then v.canon = 'All'
        when g.slug = 'minecraft' then v.canon = 'Varsity'
        else v.canon in ('Varsity', 'JV')
      end
      and not exists (
        select 1 from rosters r
        where ${scope}
          and (case when r.division in ('JV', 'B') then 'JV' when r.division = 'All' then 'All' else 'Varsity' end) = v.canon
      )
    group by g.slug, s.name
    order by g.slug, s.name`;
}

const toAdd = (rows: Record<string, unknown>[]) =>
  rows.map((r) => ({ game: String(r.game), season: String(r.season), count: num(r.n) }));

export function parseArgs(argv: string[]): { dryRun: true } {
  for (const a of argv) {
    if (a !== '--dry-run') throw new Error(`Unknown argument "${a}". This script is read-only; the only flag is --dry-run.`);
  }
  return { dryRun: true };
}

const num = (v: unknown) => Number(v ?? 0);

export async function loadReport(query: RowQuery): Promise<VerifyReport> {
  const cols = await query(
    `select column_name from information_schema.columns where table_name = 'rosters' and column_name in ('school_id','game_id','season_id')`,
  );
  const standings = await query(`
    select count(*)::int as n from (
      select distinct ss.school_id, s.game_id, ss.season_id
      from season_standings ss join seasons s on s.id = ss.season_id
    ) x where not exists (select 1 from teams m where m.school_id = x.school_id and m.game_id = x.game_id and m.season_id = x.season_id)`);
  if (cols.length < 3) {
    const rostersToAdd = toAdd(await query(rostersToAddSql('r.team_id = t.id')));
    const preview = await query(`
      select g.slug as game, s.name as season, count(*)::int as rosters,
        count(*) filter (where t.id is null)::int as no_team
      from rosters r
      left join teams t on t.id = r.team_id
      left join games g on g.id = t.game_id
      left join seasons s on s.id = t.season_id
      group by g.slug, s.name
      order by g.slug, s.name`);
    return {
      migrationApplied: false,
      scopes: [],
      missingMembership: { standings: num(standings[0]?.n) },
      rostersToAdd,
      preview: {
        scopes: preview.map((r) => ({
          game: String(r.game ?? '(no team)'),
          season: String(r.season ?? '(no team)'),
          rosters: num(r.rosters),
          noTeam: num(r.no_team),
        })),
      },
    };
  }

  const scopes = await query(`
    select g.slug as game, s.name as season,
      count(*)::int as rosters,
      count(*) filter (where r.school_id is null or r.game_id is null or r.season_id is null)::int as unscoped,
      count(*) filter (where t.id is not null and (r.school_id is distinct from t.school_id or r.game_id is distinct from t.game_id or r.season_id is distinct from t.season_id))::int as mismatched,
      count(*) filter (where r.team_id is null)::int as no_team,
      count(*) filter (where r.school_id is not null and r.game_id is not null and r.season_id is not null and not exists (
        select 1 from teams m where m.school_id = r.school_id and m.game_id = r.game_id and m.season_id = r.season_id
      ))::int as no_membership
    from rosters r
    left join teams t on t.id = r.team_id
    left join games g on g.id = coalesce(r.game_id, t.game_id)
    left join seasons s on s.id = coalesce(r.season_id, t.season_id)
    group by g.slug, s.name
    order by g.slug, s.name`);

  return {
    migrationApplied: true,
    scopes: scopes.map((r) => ({
      game: String(r.game ?? '(unknown game)'),
      season: String(r.season ?? '(unknown season)'),
      rosters: num(r.rosters),
      unscoped: num(r.unscoped),
      mismatched: num(r.mismatched),
      noTeam: num(r.no_team),
      noMembership: num(r.no_membership),
    })),
    missingMembership: { standings: num(standings[0]?.n) },
    rostersToAdd: toAdd(
      await query(rostersToAddSql('r.school_id = t.school_id and r.game_id = t.game_id and r.season_id = t.season_id')),
    ),
  };
}

/** True when the backfill is complete and consistent. */
export function isHealthy(report: VerifyReport): boolean {
  if (!report.migrationApplied) return report.preview?.scopes.every((s) => s.noTeam === 0) ?? false;
  return report.scopes.every((s) => s.unscoped === 0 && s.mismatched === 0);
}

function rostersToAddLines(report: VerifyReport, verb: string): string[] {
  const total = report.rostersToAdd.reduce((n, x) => n + x.count, 0);
  return [
    `Rosters ${verb} (one per division a membership lacks, active and archived seasons alike): ${total}`,
    ...report.rostersToAdd.map((x) => `  ${x.game} | ${x.season} | ${x.count}`),
  ];
}

export function formatReport(report: VerifyReport): string {
  if (!report.migrationApplied) {
    const rows = report.preview?.scopes ?? [];
    const lines = [
      'PREVIEW: migration 0060 is NOT applied yet (rosters has no school_id / game_id / season_id). This is what it will do.',
      'game | season | rosters to backfill | rosters with no team',
      ...rows.map((s) => `${s.game} | ${s.season} | ${s.rosters} | ${s.noTeam}`),
      `TOTAL | | ${rows.reduce((n, s) => n + s.rosters, 0)} | ${rows.reduce((n, s) => n + s.noTeam, 0)}`,
      `Membership rows it will add from season_standings: ${report.missingMembership.standings}`,
      ...rostersToAddLines(report, 'it will add'),
      isHealthy(report)
        ? 'OK to migrate: every roster has a team to backfill from. The migration runs in ONE transaction, so a failed constraint rolls the whole backfill back. Re-run this after migrating to confirm.'
        : 'PROBLEM: some rosters have no team to backfill from; the migration would fail at SET NOT NULL and roll back.',
    ];
    return lines.join('\n');
  }
  const lines = ['game | season | rosters | unscoped | mismatched | no team | no membership'];
  for (const s of report.scopes) {
    lines.push(`${s.game} | ${s.season} | ${s.rosters} | ${s.unscoped} | ${s.mismatched} | ${s.noTeam} | ${s.noMembership}`);
  }
  const total = (pick: (s: ScopeRow) => number) => report.scopes.reduce((n, s) => n + pick(s), 0);
  lines.push(
    `TOTAL | | ${total((s) => s.rosters)} | ${total((s) => s.unscoped)} | ${total((s) => s.mismatched)} | ${total((s) => s.noTeam)} | ${total((s) => s.noMembership)}`,
    `Membership rows step 5 of 0060 would still add: ${report.missingMembership.standings} from season_standings`,
    ...rostersToAddLines(report, 'step 6 of 0060 would still add'),
    isHealthy(report) ? 'OK: every roster is scoped and agrees with its team.' : 'PROBLEM: some rosters are unscoped or disagree with their team.',
  );
  return lines.join('\n');
}

async function main(): Promise<void> {
  parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  // Fail closed unless the target is loopback or SEED_ALLOW_REMOTE names this exact host.
  assertSeedTargetAllowed(url);
  console.log(`Read-only check against ${seedTargetHost(url) ?? 'unknown host'} (no writes).`);

  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    // One statement at a time: the production pooler does not support pipelined queries.
    const report = await loadReport(async (text) => (await sql.unsafe(text)) as unknown as Record<string, unknown>[]);
    console.log(formatReport(report));
    if (!isHealthy(report)) process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && /verify-roster-backfill\.ts$/.test(process.argv[1].replaceAll('\\', '/'))) {
  main().catch((err) => {
    console.error('Verify failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
