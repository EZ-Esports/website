/**
 * Rehearsal: the script's real SQL (loadSnapshotFrom, locks, deletes, counts, assertions) run
 * against an in-memory PGlite built from db/migrations/*.sql. No other database is touched.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import {
  confirmationPhrase,
  loadSnapshotFrom,
  makeTxHandle,
  parseArgs,
  runPurge,
  type PurgeDeps,
  type SqlLike,
} from '../purge-onboarding-test-data';
import { applyMigrations, type MigrationReport } from './helpers/pglite-migrations';

type Q = { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }> };

function sqlOf(q: Q): SqlLike {
  return {
    unsafe: async (text, params) => {
      const r = await q.query(text, params);
      const rows = r.rows as Record<string, unknown>[] & { count: number };
      rows.count = r.affectedRows ?? rows.length;
      return rows;
    },
  };
}

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const USER = { staff: U(1), mgr: U(2), twin: U(3), other: U(4), student: U(5), noMember: U(6) };

let migrationReport: MigrationReport;

async function freshDb() {
  const db = new PGlite();
  migrationReport = await applyMigrations(db);
  return db;
}

/** One world covering every case in the brief. Returns the ids the assertions need. */
async function seed(db: PGlite) {
  const id = async (text: string, params: unknown[] = []) => ((await db.query(text, params)).rows[0] as { id: string }).id;

  const school = await id(`insert into schools (name, slug) values ('Alpha HS', 'alpha') returning id`);
  const school2 = await id(`insert into schools (name, slug) values ('Beta HS', 'beta') returning id`);
  const game = await id(`insert into games (slug, display_name, short_name) values ('val', 'Valorant', 'VAL') returning id`);
  const active = await id(`insert into seasons (game_id, name, is_active) values ($1, '2026-27', true) returning id`, [game]);
  const past = await id(`insert into seasons (game_id, name, is_active) values ($1, '2025-26', false) returning id`, [game]);
  const team = async (sch: string, season: string) =>
    id(`insert into teams (school_id, game_id, season_id) values ($1, $2, $3) returning id`, [sch, game, season]);
  const roster = async (t: string, name = 'Varsity') =>
    id(`insert into rosters (team_id, name, division) values ($1, $2, 'A') returning id`, [t, name]);
  const rActive = await roster(await team(school, active));
  const rPast = await roster(await team(school, past));
  const rOther = await roster(await team(school2, active));
  const match = await id(
    `insert into matches (season_id, home_roster_id, away_roster_id, scheduled_at) values ($1, $2, $3, now()) returning id`,
    [active, rActive, rOther]
  );

  const member = (first: string, last: string, email: string | null, schoolId = school, key: string | null = null) =>
    id(`insert into members (first_name, last_name, email, school_id, member_key) values ($1, $2, $3, $4, $5) returning id`, [first, last, email, schoolId, key]);
  const m = {
    student: await member('Sam', 'Student', 'sam@school.org'),
    mgrOnly: await member('Mary', 'Manager', 'mary@school.org'),
    staffMgr: await member('Stan', 'Staffer', 'stan@ez.org'),
    twin: await member('Totally', 'Different', '  STAN@EZ.ORG '),
    authTwin: await member('Pat', 'Personal', 'pat.personal@gmail.com'),
    archiveKey: await member('Al', 'Alum', 'al@x.org', school, 'alpha|al|alum'),
    archiveNoKey: await member('Nia', 'NoKey', 'nia@x.org'),
    admin: await member('Ad', 'Min', 'ad@x.org'),
    leader: await member('Lee', 'Leader', 'lee@x.org'),
  };

  const player = (mem: string, ros: string) => id(`insert into players (roster_id, member_id) values ($1, $2) returning id`, [ros, mem]);
  const p = {
    student: await player(m.student, rActive),
    archiveKey: await player(m.archiveKey, rPast),
    archiveNoKey: await player(m.archiveNoKey, rPast),
    admin: await player(m.admin, rActive),
    staffMgr: await player(m.staffMgr, rActive),
  };

  const tok = (() => { let i = 0; return () => `hash-${++i}`; })();
  const pInvite = (mem: string | null) =>
    id(`insert into player_invites (school_id, game_id, token_hash, intended_first_name, intended_last_name, invited_by_user_id, status, expires_at, member_id)
        values ($1, $2, $3, 'x', 'y', $4, 'submitted', now(), $5) returning id`, [school, game, tok(), USER.staff, mem]);
  const mInvite = (mem: string | null) =>
    id(`insert into manager_invites (school_id, token_hash, intended_first_name, intended_last_name, invited_by_user_id, status, expires_at, member_id)
        values ($1, $2, 'x', 'y', $3, 'accepted', now(), $4) returning id`, [school, tok(), USER.staff, mem]);
  const inv = {
    student: await pInvite(m.student),
    pending: await pInvite(null),
    archiveNoKey: await pInvite(m.archiveNoKey),
    archiveKey: await pInvite(m.archiveKey),
    mgrOnly: await mInvite(m.mgrOnly),
    staffMgr: await mInvite(m.staffMgr),
    twin: await mInvite(m.twin),
    authTwin: await mInvite(m.authTwin),
  };

  const mgr = (user: string, mem: string | null, year = '2026-27') =>
    id(`insert into school_managers (school_id, user_id, member_id, academic_year) values ($1, $2, $3, $4) returning id`, [school, user, mem, year]);
  const sm = {
    mgrOnly: await mgr(USER.mgr, m.mgrOnly),
    staffMgr: await mgr(USER.staff, m.staffMgr),
    twin: await mgr(USER.twin, m.twin),
    authTwin: await mgr(USER.other, m.authTwin),
    noMember: await mgr(USER.noMember, null),
  };

  const consent = (mem: string, kind: 'player' | 'manager', invite: string) =>
    id(`insert into onboarding_consents (member_id, school_id, invite_kind, invite_id, form_version, is_minor, age_at_signing, tos_acknowledged, participant_legal_name)
        values ($1, $2, $3, $4, 'v1', false, 18, true, 'x') returning id`, [mem, school, kind, invite]);
  const demo = (mem: string) =>
    id(`insert into student_demographics (member_id, legal_first_name, legal_last_name, birth_date) values ($1, 'a', 'b', now()) returning id`, [mem]);
  const ident = (mem: string, provider: string, pid: string) =>
    id(`insert into player_identities (member_id, provider, provider_user_id, provider_username) values ($1, $2, $3, 'u') returning id`, [mem, provider, pid]);
  const c = {
    student: await consent(m.student, 'player', inv.student),
    mgrOnly: await consent(m.mgrOnly, 'manager', inv.mgrOnly),
    staffMgr: await consent(m.staffMgr, 'manager', inv.staffMgr),
  };
  const d = {
    student: await demo(m.student),
    staffMgr: await demo(m.staffMgr),
    archiveKey: await demo(m.archiveKey),
    archiveNoKey: await demo(m.archiveNoKey),
  };
  const i = {
    studentDiscord: await ident(m.student, 'discord', 'd1'),
    studentRiot: await ident(m.student, 'riot', 'r1'),
    staffDiscord: await ident(m.staffMgr, 'discord', 'd2'),
  };

  // Staff, role, leadership and people links.
  await db.query(`insert into staff_members (user_id, email, member_id) values ($1, 'Stan@EZ.org', $2)`, [USER.staff, m.staffMgr]);
  const role = await id(`insert into roles (name, position) values ('Admin', 1) returning id`);
  await db.query(`insert into user_roles (user_id, role_id) values ($1, $2)`, [USER.staff, role]);
  // A second staff user whose Auth email (not DB email) equals the authTwin member's email.
  const personalStaff = U(7);
  await db.query(`insert into staff_members (user_id, email) values ($1, 'pat@ez.org')`, [personalStaff]);
  await db.query(`insert into leadership (member_id, name, role, year) values ($1, 'Lee Leader', 'Dir', '2026')`, [m.leader]);
  await db.query(`insert into people (full_name, member_id) values ('Lee Leader', $1)`, [m.leader]);
  await db.query(`insert into people (full_name) values ('No Link')`);

  // Manager-portal reschedule requests: one by the deleted manager, one by staff.
  const req = async (user: string) =>
    id(`insert into match_reschedule_requests (match_id, requested_by_school_id, requested_by_user_id, reason, status, is_late, original_scheduled_at)
        values ($1, $2, $3, 'r', $4, false, now()) returning id`, [match, school, user, user === USER.mgr ? 'pending_opponent' : 'cancelled']);
  const reqMgr = await req(USER.mgr);
  const reqStaff = await req(USER.staff);
  const opt = (r: string, hours: number) =>
    id(`insert into match_reschedule_options (request_id, proposed_at) values ($1, now() + ($2 || ' hours')::interval) returning id`, [r, String(hours)]);
  const o = { mgr1: await opt(reqMgr, 1), mgr2: await opt(reqMgr, 5), staff1: await opt(reqStaff, 1) };

  return { school, rActive, rPast, match, m, p, inv, sm, c, d, i, req: { reqMgr, reqStaff }, o, personalStaff, role };
}

type World = Awaited<ReturnType<typeof seed>>;

async function ids(db: PGlite, table: string): Promise<string[]> {
  return ((await db.query(`select id from "${table}"`)).rows as { id: string }[]).map((r) => r.id);
}
async function count(db: PGlite, table: string): Promise<number> {
  return ((await db.query(`select count(*)::int as n from "${table}"`)).rows[0] as { n: number }).n;
}

const AUTH_EMAILS: Record<string, string> = {
  [USER.staff]: 'stan.auth@ez.org',
  [U(7)]: 'pat.personal@gmail.com', // staff user's Auth email equals a member's email
  [USER.mgr]: 'mary@school.org',
  [USER.twin]: 'twin@school.org',
  [USER.other]: 'pat.personal@gmail.com',
  [USER.noMember]: 'orphan@school.org',
};

function depsFor(db: PGlite, over: Partial<PurgeDeps> = {}, authEmails: Record<string, string> = AUTH_EMAILS) {
  const deleted: string[] = [];
  const logs: string[] = [];
  const deps: PurgeDeps = {
    host: 'db.example.com',
    assertTarget: () => {},
    loadSnapshot: () => loadSnapshotFrom(sqlOf(db)),
    takeBackup: () => '/tmp/backup.sql',
    prompt: async () => '',
    transaction: (fn) => db.transaction((tx) => fn(makeTxHandle(sqlOf(tx)))),
    auth: {
      hasCredentials: () => true,
      emailOf: async (id) => authEmails[id] ?? null,
      deleteUser: async (id) => { deleted.push(id); },
    },
    log: (l) => logs.push(l),
    ...over,
  };
  return { deps, deleted, logs };
}

describe('PGlite rehearsal of the purge SQL', () => {
  let db: PGlite;
  let w: World;

  beforeAll(async () => {
    db = await freshDb();
  }, 120_000);
  afterAll(async () => {
    await db.close();
  });

  it('the migrations load faithfully: only role/auth/policy statements may be skipped', () => {
    const fatal = migrationReport.skipped.filter(
      (s) => !/POLICY|FUNCTION|GRANT|REVOKE|DO \$\$|^--/i.test(s.statement)
    );
    expect(fatal).toEqual([]);
  });

  it('sets up the FK behaviour the plan depends on', async () => {
    const r = await db.query(`
      select conrelid::regclass::text as t, confdeltype as d from pg_constraint
      where contype = 'f' and confrelid = 'members'::regclass order by 1`);
    const by = Object.fromEntries((r.rows as { t: string; d: string }[]).map((x) => [x.t, x.d]));
    expect(by.players).toBe('r'); // restrict
    expect(by.player_identities).toBe('c');
    expect(by.student_demographics).toBe('c');
    expect(by.onboarding_consents).toBe('c');
    expect(by.school_managers).toBe('n'); // set null
    expect(by.leadership).toBe('n');
    expect(by.staff_members).toBe('n');
  });

  it('dry run: reads the real schema, mutates nothing, lists the right people', async () => {
    w = await seed(db);
    const before = Object.fromEntries(await Promise.all(['members', 'players', 'school_managers', 'student_demographics', 'match_reschedule_requests'].map(async (t) => [t, await count(db, t)])));
    const { deps, logs } = depsFor(db);
    const res = await runPurge(parseArgs([]), deps);
    for (const [t, n] of Object.entries(before)) expect(await count(db, t)).toBe(n);
    const del = res.plan.deletes;
    // Deleted: the student and the manager-only user, their children, the reschedule request of the deleted manager.
    expect(del.members.sort()).toEqual([w.m.student, w.m.mgrOnly].sort());
    expect(del.players).toEqual([w.p.student]);
    expect(del.match_reschedule_requests).toEqual([w.req.reqMgr]);
    expect(del.match_reschedule_options.sort()).toEqual([w.o.mgr1, w.o.mgr2].sort());
    // The archive member without a member_key is KEPT because its players row is on a past season.
    expect(del.members).not.toContain(w.m.archiveNoKey);
    expect(res.plan.pastSeasonKept.length).toBe(1);
    const out = logs.join('\n');
    expect(out).toContain('2025-26 (past): 1');
    expect(out).not.toContain('sam@school.org');
    expect(out).toContain('s***@school.org');
    // The Auth cross-check caught the member whose email equals a staff user's live Auth email.
    expect(del.members).not.toContain(w.m.authTwin);
    expect(del.school_managers).not.toContain(w.sm.authTwin);
    // Staff-linked and email-twin managers stay.
    for (const k of ['staffMgr', 'twin'] as const) expect(del.school_managers).not.toContain(w.sm[k]);
  });

  it('execute: deletes exactly the plan, keeps everything else, and can delete Auth users after', async () => {
    const dry = await runPurge(parseArgs([]), depsFor(db).deps);
    const plan = dry.plan;
    const authUsers = [USER.mgr, USER.noMember];
    const phrase = confirmationPhrase('db.example.com', plan.totalRows, plan.deletes.players.length, authUsers.length);
    const { deps, deleted } = depsFor(db, { prompt: async () => phrase });
    const res = await runPurge(parseArgs(['--execute', '--delete-auth-users']), deps);

    expect(res.deleted).toBe(plan.totalRows);
    expect(deleted.sort()).toEqual(authUsers.sort());

    // Gone
    const members = await ids(db, 'members');
    expect(members).not.toContain(w.m.student);
    expect(members).not.toContain(w.m.mgrOnly);
    expect(await ids(db, 'players')).not.toContain(w.p.student);
    expect(await ids(db, 'school_managers')).not.toContain(w.sm.mgrOnly);
    expect(await ids(db, 'match_reschedule_requests')).toEqual([w.req.reqStaff]);
    expect(await ids(db, 'match_reschedule_options')).toEqual([w.o.staff1]);
    expect(await ids(db, 'player_invites')).toEqual(expect.not.arrayContaining([w.inv.student, w.inv.pending]));
    // Kept: staff, protected twins, admin, archive members and their roster history, leadership, people
    for (const k of ['staffMgr', 'twin', 'authTwin', 'archiveKey', 'archiveNoKey', 'admin', 'leader'] as const) {
      expect(members).toContain(w.m[k]);
    }
    const players = await ids(db, 'players');
    for (const k of ['archiveKey', 'archiveNoKey', 'admin', 'staffMgr'] as const) expect(players).toContain(w.p[k]);
    expect(await ids(db, 'student_demographics')).toEqual([w.d.staffMgr]); // archive members' demographics are purged
    expect(await ids(db, 'onboarding_consents')).toEqual([w.c.staffMgr]);
    expect(await count(db, 'staff_members')).toBe(2);
    expect(await count(db, 'user_roles')).toBe(1);
    expect(await count(db, 'leadership')).toBe(1);
    expect(await count(db, 'people')).toBe(2);
    expect(await count(db, 'matches')).toBe(1);
    expect(await count(db, 'rosters')).toBe(3);
    const sm = await ids(db, 'school_managers');
    expect(sm.sort()).toEqual([w.sm.staffMgr, w.sm.twin, w.sm.authTwin].sort());
    // protected identity rows survive
    expect(await ids(db, 'player_identities')).toEqual([w.i.staffDiscord]);
  });

  it('is idempotent: a second execute finds nothing', async () => {
    const { deps } = depsFor(db, { prompt: async () => { throw new Error('should not prompt'); } });
    const res = await runPurge(parseArgs(['--execute']), deps);
    expect(res.plan.totalRows).toBe(0);
  });

  it('rolls back when a match is touched as a side effect of the delete', async () => {
    const db3 = await freshDb();
    const w3 = await seed(db3);
    await db3.exec(`
      create function nuke_match() returns trigger language plpgsql as $$
      begin delete from matches; return old; end $$;
      create trigger nuke_match_trg after delete on members for each row execute function nuke_match();
    `);
    const dry = await runPurge(parseArgs([]), depsFor(db3).deps);
    const phrase = confirmationPhrase('db.example.com', dry.plan.totalRows, dry.plan.deletes.players.length, 0);
    await expect(runPurge(parseArgs(['--execute']), depsFor(db3, { prompt: async () => phrase }).deps)).rejects.toThrow(/Invariant matches/);
    expect(await count(db3, 'matches')).toBe(1);
    expect(await ids(db3, 'players')).toContain(w3.p.student);
    await db3.close();
  }, 120_000);

  it('rolls back everything when the database does something the plan did not expect', async () => {
    const db2 = await freshDb();
    const w2 = await seed(db2);
    // A trigger that quietly removes a leadership link whenever a member is deleted.
    await db2.exec(`
      create function sabotage() returns trigger language plpgsql as $$
      begin update leadership set member_id = null; return old; end $$;
      create trigger sabotage_trg after delete on members for each row execute function sabotage();
    `);
    const dry = await runPurge(parseArgs([]), depsFor(db2).deps);
    const phrase = confirmationPhrase('db.example.com', dry.plan.totalRows, dry.plan.deletes.players.length, 0);
    const before = await count(db2, 'members');
    await expect(runPurge(parseArgs(['--execute']), depsFor(db2, { prompt: async () => phrase }).deps)).rejects.toThrow(/Invariant leadership_member/);
    expect(await count(db2, 'members')).toBe(before);
    expect(await ids(db2, 'players')).toContain(w2.p.student);
    await db2.close();
  }, 120_000);
});
