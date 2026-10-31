/**
 * Rehearsal of the real roster-removal SQL (FOR UPDATE, savepoints, FK behaviour, the history
 * reads) against an in-memory PGlite built from db/migrations/*.sql through drizzle's pglite driver.
 * No other database is touched. The mocked-transaction suite (roster-removal.test.ts) covers the
 * decision table; this one proves the statements are valid Postgres and behave as the spec says.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import * as schema from '../schema';
import { removePlayerFromRosterTx, cleanupOrphanMember, type RosterRemovalResult } from '../roster-removal';
import { applyMigrations } from '../../../../db/__tests__/helpers/pglite-migrations';

// Every PGlite here replays all migrations (the suite's own plus the one in 'failure isolation'), which
// outlasts the 15s default per-test timeout when the full suite runs in parallel under the pre-push hook.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let world: { school: string; game: string; season: string; team: string; varsity: string; jv: string; other: string };

const USER = '00000000-0000-4000-8000-000000000001';
let n = 0;
const uniq = () => ++n;

async function one<T = { id: string }>(text: string, params: unknown[] = []) {
  return (await client.query(text, params)).rows[0] as T;
}
const id = async (text: string, params: unknown[] = []) => (await one<{ id: string }>(text, params)).id;

beforeAll(async () => {
  client = new PGlite();
  const report = await applyMigrations(client);
  // Everything this suite relies on must have been applied for real, not skipped.
  expect(report.skipped.filter((s) => /create table/i.test(s.statement))).toEqual([]);
  db = drizzle(client, { schema });
  const school = await id(`insert into schools (name, slug) values ('Alpha HS', 'alpha') returning id`);
  const game = await id(`insert into games (slug, display_name, short_name) values ('val', 'Valorant', 'VAL') returning id`);
  const season = await id(`insert into seasons (game_id, name, is_active) values ($1, '2026-27', true) returning id`, [game]);
  const team = await id(`insert into teams (school_id, game_id, season_id) values ($1, $2, $3) returning id`, [school, game, season]);
  const varsity = await id(`insert into rosters (team_id, name, division) values ($1, 'Varsity', 'A') returning id`, [team]);
  const jv = await id(`insert into rosters (team_id, name, division) values ($1, 'JV', 'B') returning id`, [team]);
  const school2 = await id(`insert into schools (name, slug) values ('Beta HS', 'beta') returning id`);
  const otherTeam = await id(`insert into teams (school_id, game_id, season_id) values ($1, $2, $3) returning id`, [school2, game, season]);
  const other = await id(`insert into rosters (team_id, name, division) values ($1, 'Other', 'A') returning id`, [otherTeam]);
  world = { school, game, season, team, varsity, jv, other };
});
afterAll(async () => {
  await client.close();
});

interface Student { memberId: string; playerId: string; first: string; last: string; email: string }

/** A member on `roster` with the full set of onboarding leftovers. */
async function student(opts: { roster?: string; memberKey?: string; ign?: string; email?: string } = {}): Promise<Student> {
  const i = uniq();
  const first = `Sam${i}`;
  const last = `Student${i}`;
  const email = opts.email ?? `sam${i}@school.org`;
  const memberId = await id(
    `insert into members (first_name, last_name, email, school_id, member_key) values ($1, $2, $3, $4, $5) returning id`,
    [first, last, email, world.school, opts.memberKey ?? null],
  );
  const playerId = await id(`insert into players (roster_id, member_id, ign) values ($1, $2, $3) returning id`, [opts.roster ?? world.varsity, memberId, opts.ign ?? null]);
  const invite = await id(
    `insert into player_invites (school_id, game_id, token_hash, intended_first_name, intended_last_name, invited_by_user_id, status, expires_at, member_id)
     values ($1, $2, $3, $4, $5, $6, 'accepted', now(), $7) returning id`,
    [world.school, world.game, `hash-${i}`, first, last, USER, memberId],
  );
  await client.query(
    `insert into onboarding_consents (member_id, school_id, invite_kind, invite_id, form_version, is_minor, age_at_signing, tos_acknowledged, participant_legal_name)
     values ($1, $2, 'player', $3, 'v1', false, 17, true, $4)`,
    [memberId, world.school, invite, `${first} ${last}`],
  );
  await client.query(`insert into onboarding_form_completions (member_id, invite_kind, invite_id) values ($1, 'player', $2)`, [memberId, invite]);
  await client.query(`insert into player_identities (member_id, provider, provider_user_id, provider_username) values ($1, 'discord', $2, 'd')`, [memberId, `disc-${i}`]);
  await client.query(
    `insert into onboarding_content_flags (member_id, school_id, invite_kind, invite_id, flagged_fields)
     values ($1, $2, 'player', $3, '[]'::jsonb)`,
    [memberId, world.school, invite],
  );
  return { memberId, playerId, first, last, email };
}

const remove = (s: Student, rosterId = world.varsity): Promise<RosterRemovalResult> =>
  db.transaction((tx) => removePlayerFromRosterTx(tx as never, { playerId: s.playerId, rosterId }));

const count = async (table: string, memberId: string) =>
  Number((await one<{ n: string }>(`select count(*) as n from ${table} where member_id = $1`, [memberId])).n);
const playerRows = async (playerId: string) => Number((await one<{ n: string }>(`select count(*) as n from players where id = $1`, [playerId])).n);

async function expectKept(s: Student, reason: string, result: RosterRemovalResult) {
  expect(result).toMatchObject({ removed: true, studentRecord: 'kept', keptReason: reason });
  expect(Number((await one<{ n: string }>(`select count(*) as n from members where id = $1`, [s.memberId])).n)).toBe(1);
  for (const t of ['onboarding_consents', 'onboarding_form_completions', 'player_identities', 'onboarding_content_flags', 'player_invites']) {
    expect(await count(t, s.memberId), t).toBe(1);
  }
}

describe('orphan: deleted with every leftover', () => {
  it('removes the player, the member, consents, form completion, identities and invites', async () => {
    const s = await student();
    const result = await remove(s);
    expect(result).toEqual({
      removed: true,
      memberId: s.memberId,
      studentRecord: 'deleted',
      deleted: { consents: 1, formCompletions: 1, identities: 1, contentFlags: 1, invites: 1 },
    });
    expect(await playerRows(s.playerId)).toBe(0);
    for (const t of ['onboarding_consents', 'onboarding_form_completions', 'player_identities', 'onboarding_content_flags', 'player_invites']) {
      expect(await count(t, s.memberId), t).toBe(0);
    }
    expect(Number((await one<{ n: string }>(`select count(*) as n from members where id = $1`, [s.memberId])).n)).toBe(0);
  });

  it('also removes a form completion that was never tied to the member, through its invite', async () => {
    const s = await student();
    await client.query(`update onboarding_form_completions set member_id = null where member_id = $1`, [s.memberId]);
    const result = await remove(s);
    expect(result).toMatchObject({ removed: true, studentRecord: 'deleted', deleted: { formCompletions: 1 } });
    expect(Number((await one<{ n: string }>(`select count(*) as n from onboarding_form_completions`)).n)).toBe(0);
  });

  it('a stale player row reports removed:false and changes nothing', async () => {
    const s = await student();
    const result = await remove(s, world.jv); // wrong roster
    expect(result).toEqual({ removed: false });
    expect(await playerRows(s.playerId)).toBe(1);
  });
});

describe('kept: the roster spot goes, the student record stays', () => {
  it('on another roster', async () => {
    const s = await student();
    await client.query(`insert into players (roster_id, member_id) values ($1, $2)`, [world.other, s.memberId]);
    await expectKept(s, 'other_roster', await remove(s));
    expect(await playerRows(s.playerId)).toBe(0);
  });

  it('staff, matched by email regardless of case and padding', async () => {
    const s = await student({ email: 'Boss.Person@ez.org' });
    await client.query(`insert into staff_members (user_id, email) values (gen_random_uuid(), '  boss.person@EZ.org ')`);
    await expectKept(s, 'staff', await remove(s));
  });

  it('staff linked by member id', async () => {
    const s = await student();
    await client.query(`insert into staff_members (user_id, email, member_id) values (gen_random_uuid(), $1, $2)`, [`x${uniq()}@ez.org`, s.memberId]);
    await expectKept(s, 'staff', await remove(s));
  });

  it('school manager row', async () => {
    const s = await student();
    await client.query(`insert into school_managers (school_id, user_id, member_id, academic_year) values ($1, gen_random_uuid(), $2, '2026-27')`, [world.school, s.memberId]);
    await expectKept(s, 'school_manager', await remove(s));
  });

  it('manager invite linked to the member', async () => {
    const s = await student();
    await client.query(
      `insert into manager_invites (school_id, token_hash, intended_first_name, intended_last_name, invited_by_user_id, expires_at, member_id)
       values ($1, $2, 'Zed', 'Zed', $3, now(), $4)`,
      [world.school, `mi-${uniq()}`, USER, s.memberId],
    );
    await expectKept(s, 'school_manager', await remove(s));
  });

  it('manager invite for the same name at the same school (no email column exists)', async () => {
    const s = await student();
    await client.query(
      `insert into manager_invites (school_id, token_hash, intended_first_name, intended_last_name, invited_by_user_id, expires_at)
       values ($1, $2, $3, $4, $5, now())`,
      [world.school, `mi-${uniq()}`, `  ${s.first.toUpperCase()} `, s.last.toLowerCase(), USER],
    );
    await expectKept(s, 'school_manager', await remove(s));
  });

  it('people profile matched by email, and leadership linked by member id', async () => {
    const a = await student();
    await client.query(`insert into people (full_name, email) values ('Someone', $1)`, [` ${a.email.toUpperCase()}`]);
    await expectKept(a, 'profile', await remove(a));
    const b = await student();
    await client.query(`insert into leadership (member_id, name, role, year) values ($1, 'L', 'Director', '2026')`, [b.memberId]);
    await expectKept(b, 'profile', await remove(b));
  });

  it('gold-archive member_key', async () => {
    const s = await student({ memberKey: `alpha|key${uniq()}|x` });
    await expectKept(s, 'archive_member', await remove(s));
  });
});

describe('kept: match history', () => {
  it('a scored match on the removed roster', async () => {
    const s = await student({ roster: world.jv });
    await client.query(
      `insert into matches (season_id, home_roster_id, away_roster_id, scheduled_at, home_score, away_score, status) values ($1, $2, $3, now(), 2, 1, 'completed')`,
      [world.season, world.jv, world.other],
    );
    await expectKept(s, 'match_history', await remove(s, world.jv));
  });

  it('a scored match on a SIBLING roster of the same team', async () => {
    const s = await student({ roster: world.varsity });
    await client.query(
      `insert into matches (season_id, home_roster_id, away_roster_id, scheduled_at, home_score, away_score, status) values ($1, $2, $3, now(), 1, 0, 'completed')`,
      [world.season, world.jv, world.other],
    );
    await expectKept(s, 'match_history', await remove(s, world.varsity));
  });

  it('matches.mvp naming the student, with odd spacing and case', async () => {
    const s = await student({ roster: world.other });
    // "other" has no scored match of its own in this world apart from the ones above, so isolate:
    await client.query(`update matches set mvp = null`);
    await client.query(`delete from matches`);
    await client.query(
      `insert into matches (season_id, home_roster_id, away_roster_id, scheduled_at, mvp) values ($1, $2, $3, now(), $4)`,
      [world.season, world.varsity, world.jv, `  ${s.first.toUpperCase()}    ${s.last.toLowerCase()}  `],
    );
    await expectKept(s, 'match_history', await remove(s, world.other));
    await client.query(`delete from matches`);
  });

  it('a Valorant scoreboard line whose name#tag equals the in-game name', async () => {
    const s = await student({ ign: 'Ace Spade#NA1' });
    const game = await id(
      `insert into valorant_games (riot_match_id, map_id, map_name, started_at, game_length_ms, queue_id, red_rounds, blue_rounds, winning_side)
       values ($1, 'm', 'Bind', now(), 1000, 'custom', 13, 5, 'Red') returning id`,
      [`riot-${uniq()}`],
    );
    await client.query(
      `insert into valorant_game_players (game_id, puuid, name, tag, side, agent, score, kills, deaths, assists, headshots, bodyshots, legshots, damage_dealt, damage_received)
       values ($1, 'p', ' ace SPADE ', 'na1', 'Red', 'Jett', 1, 1, 1, 1, 1, 1, 1, 1, 1)`,
      [game],
    );
    await expectKept(s, 'match_history', await remove(s));
  });

  it('a standings row carrying the student\'s name', async () => {
    const s = await student();
    await client.query(
      `insert into season_standings (season_id, school_id, division, player_name) values ($1, $2, 'All', $3)`,
      [world.season, world.school, `${s.first}  ${s.last.toUpperCase()}`],
    );
    await expectKept(s, 'match_history', await remove(s));
  });
});

describe('failure isolation', () => {
  it('a concurrent enrol (FK restrict) at the last moment leaves the member intact and the removal committed', async () => {
    const s = await student();
    const result = await db.transaction(async (tx) => {
      // Wrap the cleanup's savepoint so a players row appears just before the member delete, which
      // is what a concurrent enrol that slipped past the checks would look like.
      const hooked = new Proxy(tx, {
        get(target, prop, receiver) {
          if (prop !== 'transaction') return Reflect.get(target, prop, receiver);
          return (cb: (sp: unknown) => Promise<unknown>) =>
            target.transaction(async (sp) =>
              cb(new Proxy(sp, {
                get(t2, p2, r2) {
                  if (p2 !== 'delete') return Reflect.get(t2, p2, r2);
                  return (table: unknown) => {
                    const builder = (t2 as typeof tx).delete(table as typeof schema.members);
                    if (table !== schema.members) return builder;
                    return {
                      where: (c: never) => ({
                        returning: async (f: never) => {
                          await (t2 as typeof tx).execute(sql`insert into players (roster_id, member_id) values (${world.other}, ${s.memberId})`);
                          return builder.where(c).returning(f);
                        },
                      }),
                    };
                  };
                },
              })),
            );
        },
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      return removePlayerFromRosterTx(hooked as never, { playerId: s.playerId, rosterId: world.varsity });
    });
    expect(result).toEqual({ removed: true, memberId: s.memberId, studentRecord: 'kept', keptReason: 'cleanup_error' });
    expect(await playerRows(s.playerId)).toBe(0); // the roster removal still committed
    expect(Number((await one<{ n: string }>(`select count(*) as n from members where id = $1`, [s.memberId])).n)).toBe(1);
    // The savepoint rolled back the leftovers' deletes too.
    for (const t of ['onboarding_consents', 'onboarding_form_completions', 'player_identities', 'onboarding_content_flags', 'player_invites']) {
      expect(await count(t, s.memberId), t).toBe(1);
    }
    vi.restoreAllMocks();
  });

  it('a failing optional query (table absent) leaves the outer transaction usable', async () => {
    // Own database: dropping a table must not disturb the other cases.
    const c2 = new PGlite();
    await applyMigrations(c2);
    const d2 = drizzle(c2, { schema });
    const q = async (text: string, params: unknown[] = []) => (await c2.query(text, params)).rows as Array<Record<string, string>>;
    const [school] = await q(`insert into schools (name, slug) values ('A', 'a') returning id`);
    const [game] = await q(`insert into games (slug, display_name, short_name) values ('v', 'V', 'V') returning id`);
    const [season] = await q(`insert into seasons (game_id, name, is_active) values ($1, '2026-27', true) returning id`, [game.id]);
    const [team] = await q(`insert into teams (school_id, game_id, season_id) values ($1, $2, $3) returning id`, [school.id, game.id, season.id]);
    const [roster] = await q(`insert into rosters (team_id, name, division) values ($1, 'V', 'A') returning id`, [team.id]);
    const [member] = await q(`insert into members (first_name, last_name, email, school_id) values ('Q', 'R', 'q@r.org', $1) returning id`, [school.id]);
    const [player] = await q(`insert into players (roster_id, member_id, ign) values ($1, $2, 'Zed#1') returning id`, [roster.id, member.id]);
    await c2.exec(`drop table valorant_game_players`);

    const result = await d2.transaction(async (tx) => {
      const r = await removePlayerFromRosterTx(tx as never, { playerId: player.id, rosterId: roster.id });
      // The statement after the failed optional read must still run in the same outer transaction.
      await tx.execute(sql`insert into schools (name, slug) values ('After', 'after')`);
      return r;
    });
    expect(result).toMatchObject({ removed: true, studentRecord: 'deleted' });
    expect((await q(`select count(*)::int as n from schools where slug = 'after'`))[0].n).toBe(1);
    expect((await q(`select count(*)::int as n from members where id = $1`, [member.id]))[0].n).toBe(0);
    await c2.close();
  });

  it('a missing KEEP-check table keeps the member and the outer transaction still commits', async () => {
    const c2 = new PGlite();
    await applyMigrations(c2);
    const d2 = drizzle(c2, { schema });
    const q = async (text: string, params: unknown[] = []) => (await c2.query(text, params)).rows as Array<Record<string, string>>;
    const [school] = await q(`insert into schools (name, slug) values ('A', 'a') returning id`);
    const [game] = await q(`insert into games (slug, display_name, short_name) values ('v', 'V', 'V') returning id`);
    const [season] = await q(`insert into seasons (game_id, name, is_active) values ($1, '2026-27', true) returning id`, [game.id]);
    const [team] = await q(`insert into teams (school_id, game_id, season_id) values ($1, $2, $3) returning id`, [school.id, game.id, season.id]);
    const [roster] = await q(`insert into rosters (team_id, name, division) values ($1, 'V', 'A') returning id`, [team.id]);
    const [member] = await q(`insert into members (first_name, last_name, school_id) values ('Q', 'R', $1) returning id`, [school.id]);
    const [player] = await q(`insert into players (roster_id, member_id) values ($1, $2) returning id`, [roster.id, member.id]);
    await c2.exec(`drop table manager_invites`);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await d2.transaction((tx) => removePlayerFromRosterTx(tx as never, { playerId: player.id, rosterId: roster.id }));
    vi.restoreAllMocks();
    expect(result).toEqual({ removed: true, memberId: member.id, studentRecord: 'kept', keptReason: 'cleanup_error' });
    expect((await q(`select count(*)::int as n from members where id = $1`, [member.id]))[0].n).toBe(1);
    expect((await q(`select count(*)::int as n from players where id = $1`, [player.id]))[0].n).toBe(0);
    await c2.close();
  });
});

describe('cleanupOrphanMember directly (roster delete path)', () => {
  it('deletes an orphan whose roster is already gone, and uses the passed team for siblings', async () => {
    const s = await student({ roster: world.jv });
    await client.query(`delete from matches`);
    await client.query(`delete from players where id = $1`, [s.playerId]);
    const out = await db.transaction((tx) =>
      cleanupOrphanMember(tx as never, { memberId: s.memberId, rosterId: world.jv, teamId: world.team }));
    expect(out.studentRecord).toBe('deleted');

    // With a scored match on the sibling roster and the roster id gone, the passed team finds it.
    const t = await student({ roster: world.varsity });
    await client.query(
      `insert into matches (season_id, home_roster_id, away_roster_id, scheduled_at, home_score, away_score, status) values ($1, $2, $3, now(), 3, 0, 'completed')`,
      [world.season, world.varsity, world.other],
    );
    await client.query(`delete from players where id = $1`, [t.playerId]);
    const kept = await db.transaction((tx) =>
      cleanupOrphanMember(tx as never, { memberId: t.memberId, rosterId: world.jv, teamId: world.team }));
    expect(kept).toEqual({ studentRecord: 'kept', keptReason: 'match_history' });
    await client.query(`delete from matches`);
  });
});
