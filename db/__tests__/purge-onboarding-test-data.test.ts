import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, resolve } from 'path';
import {
  buildPurgePlan,
  confirmationPhrase,
  DELETE_ORDER,
  filterAuthCandidates,
  maskEmail,
  maskName,
  parseArgs,
  planFingerprint,
  runPurge,
  type PurgeDeps,
  type Snapshot,
  type TxHandle,
} from '../purge-onboarding-test-data';

const root = resolve(__dirname, '..', '..');

function snap(over: Partial<Snapshot> = {}): Snapshot {
  return {
    members: [],
    players: [],
    playerIdentities: [],
    studentDemographics: [],
    onboardingConsents: [],
    playerInvites: [],
    managerInvites: [],
    schoolManagers: [],
    staffMembers: [],
    userRoles: [],
    staffInvites: [],
    staffRevocations: [],
    staffAuditUserIds: [],
    acceptedStaffApplicationEmails: [],
    people: [],
    leadership: [],
    ...over,
  };
}

const member = (id: string, first: string, last: string, email: string | null, memberKey: string | null = null) => ({
  id, firstName: first, lastName: last, email, memberKey,
});

/** One student, one manager-only user, one staff-who-is-also-a-manager. */
function world(): Snapshot {
  return snap({
    members: [
      member('m-student', 'Sam', 'Student', 'sam@school.org'),
      member('m-mgr', 'Mary', 'Manager', 'mary@school.org'),
      member('m-staff', 'Stan', 'Staffer', 'stan@ez.org'),
    ],
    players: [
      { id: 'p-student', memberId: 'm-student' },
      { id: 'p-staff', memberId: 'm-staff' },
    ],
    playerIdentities: [{ id: 'i1', memberId: 'm-student' }],
    studentDemographics: [{ id: 'd1', memberId: 'm-student' }, { id: 'd2', memberId: 'm-staff' }],
    onboardingConsents: [
      { id: 'c1', memberId: 'm-student', inviteId: 'pi-student' },
      { id: 'c2', memberId: 'm-staff', inviteId: 'mi-staff' },
    ],
    playerInvites: [
      { id: 'pi-student', memberId: 'm-student', draftText: null },
      { id: 'pi-pending', memberId: null, draftText: '{"a":1}' },
    ],
    managerInvites: [
      { id: 'mi-mgr', memberId: 'm-mgr', draftText: null },
      { id: 'mi-staff', memberId: 'm-staff', draftText: null },
    ],
    schoolManagers: [
      { id: 'sm-mgr', userId: 'u-mgr', memberId: 'm-mgr' },
      { id: 'sm-staff', userId: 'u-staff', memberId: 'm-staff' },
    ],
    staffMembers: [{ userId: 'u-staff', email: 'Stan@EZ.org', memberId: 'm-staff', invitedBy: null }],
  });
}

describe('buildPurgePlan: staff protection', () => {
  it('deletes a manager-only user and a student, with every dependent row', () => {
    const plan = buildPurgePlan(world());
    expect(plan.deletes.members.sort()).toEqual(['m-mgr', 'm-student']);
    expect(plan.deletes.school_managers).toEqual(['sm-mgr']);
    expect(plan.deletes.players).toEqual(['p-student']);
    expect(plan.deletes.player_identities).toEqual(['i1']);
    expect(plan.deletes.student_demographics).toEqual(['d1']);
    expect(plan.deletes.onboarding_consents).toEqual(['c1']);
    expect(plan.deletes.player_invites.sort()).toEqual(['pi-pending', 'pi-student']);
    expect(plan.deletes.manager_invites).toEqual(['mi-mgr']);
    expect(plan.authCandidates).toEqual(['u-mgr']);
  });

  it('protects a staff member who is also a manager: member, manager row, invites, children, auth user', () => {
    const plan = buildPurgePlan(world());
    for (const t of DELETE_ORDER) {
      for (const id of plan.deletes[t]) expect(id).not.toMatch(/staff/);
    }
    expect(plan.deletes.players).not.toContain('p-staff');
    expect(plan.deletes.student_demographics).not.toContain('d2');
    expect(plan.deletes.onboarding_consents).not.toContain('c2');
    expect(plan.authCandidates).not.toContain('u-staff');
    expect(plan.authProtected).toContain('u-staff');
    expect(plan.protectedPeople.map((p) => p.memberId)).toContain('m-staff');
  });

  it('protects a member whose email matches a staff user, ignoring case and whitespace', () => {
    const s = world();
    s.members.push(member('m-twin', 'Different', 'Name', '  STAN@ez.ORG '));
    s.playerInvites.push({ id: 'pi-twin', memberId: 'm-twin', draftText: null });
    const plan = buildPurgePlan(s);
    expect(plan.deletes.members).not.toContain('m-twin');
    expect(plan.deletes.player_invites).not.toContain('pi-twin');
  });

  it('protects a manager row whose user id is a staff user even with no member link', () => {
    const s = world();
    s.schoolManagers.push({ id: 'sm-orphan', userId: 'u-staff', memberId: null });
    const plan = buildPurgePlan(s);
    expect(plan.deletes.school_managers).not.toContain('sm-orphan');
  });

  it('protects a staff user known only by user id: no member link, a different email, a manager row on a student member', () => {
    const s = world();
    s.staffMembers.push({ userId: 'u-bare', email: 'bare@ez.org', memberId: null, invitedBy: null });
    s.members.push(member('m-borrowed', 'Bo', 'Rrowed', 'bo@school.org'));
    s.schoolManagers.push({ id: 'sm-bare', userId: 'u-bare', memberId: 'm-borrowed' });
    const plan = buildPurgePlan(s);
    expect(plan.deletes.school_managers).not.toContain('sm-bare');
    expect(plan.deletes.members).not.toContain('m-borrowed');
    expect(plan.authCandidates).not.toContain('u-bare');
  });

  it('protects on a role assignment, a leadership link, a people link, a revocation, an accepted staff application and a staff invite', () => {
    const base = world();
    base.members.push(
      member('m-role', 'A', 'One', 'a@x.org'),
      member('m-lead', 'B', 'Two', 'b@x.org'),
      member('m-ppl', 'C', 'Three', 'c@x.org'),
      member('m-rev', 'D', 'Four', 'd@x.org'),
      member('m-app', 'E', 'Five', 'e@x.org'),
      member('m-inv', 'F', 'Six', 'f@x.org')
    );
    base.schoolManagers.push({ id: 'sm-role', userId: 'u-role', memberId: 'm-role' });
    base.userRoles.push({ userId: 'u-role' });
    base.leadership.push({ memberId: 'm-lead' });
    base.people.push({ fullName: 'Someone Else', userId: null, memberId: 'm-ppl', email: null });
    base.staffRevocations.push({ userId: 'u-x', email: 'd@x.org', revokedBy: 'u-staff' });
    base.acceptedStaffApplicationEmails.push('E@x.org');
    base.staffInvites.push({ email: 'f@x.org', invitedBy: 'u-staff' });
    for (const id of ['m-role', 'm-lead', 'm-ppl', 'm-rev', 'm-app', 'm-inv']) {
      base.managerInvites.push({ id: `mi-${id}`, memberId: id, draftText: null });
    }
    const plan = buildPurgePlan(base);
    for (const id of ['m-role', 'm-lead', 'm-ppl', 'm-rev', 'm-app', 'm-inv']) {
      expect(plan.deletes.members).not.toContain(id);
      expect(plan.deletes.manager_invites).not.toContain(`mi-${id}`);
    }
    expect(plan.deletes.school_managers).not.toContain('sm-role');
    expect(plan.authCandidates).not.toContain('u-role');
  });

  it('protects when the link is ambiguous: same name as staff, or a draft that mentions a staff email', () => {
    const s = world();
    s.members.push(member('m-name', 'stan', 'STAFFER', 'other@school.org'));
    s.playerInvites.push({ id: 'pi-name', memberId: 'm-name', draftText: null });
    s.playerInvites.push({ id: 'pi-draft', memberId: null, draftText: '{"email":"STAN@ez.org"}' });
    const plan = buildPurgePlan(s);
    expect(plan.deletes.members).not.toContain('m-name');
    expect(plan.deletes.player_invites).not.toContain('pi-draft');
  });

  it('spreads protection: a protected member shares a manager row with another user, who is then protected too', () => {
    const s = world();
    s.schoolManagers.push({ id: 'sm-second', userId: 'u-second', memberId: 'm-staff' });
    const plan = buildPurgePlan(s);
    expect(plan.deletes.school_managers).not.toContain('sm-second');
    expect(plan.authCandidates).not.toContain('u-second');
    expect(plan.authProtected).toContain('u-second');
  });

  it('keeps a gold-archive member (member_key) and its players but purges its onboarding records', () => {
    const s = world();
    s.members.push(member('m-alum', 'Al', 'Um', 'al@x.org', 'school|al|um'));
    s.players.push({ id: 'p-alum', memberId: 'm-alum' });
    s.studentDemographics.push({ id: 'd-alum', memberId: 'm-alum' });
    s.playerInvites.push({ id: 'pi-alum', memberId: 'm-alum', draftText: null });
    const plan = buildPurgePlan(s);
    expect(plan.deletes.members).not.toContain('m-alum');
    expect(plan.deletes.players).not.toContain('p-alum');
    expect(plan.deletes.student_demographics).toContain('d-alum');
    expect(plan.deletes.player_invites).toContain('pi-alum');
    expect(plan.archiveKeptMemberIds).toContain('m-alum');
  });

  it('never touches a member with no onboarding footprint (admin-created)', () => {
    const s = world();
    s.members.push(member('m-admin', 'Ad', 'Min', 'ad@x.org'));
    s.players.push({ id: 'p-admin', memberId: 'm-admin' });
    const plan = buildPurgePlan(s);
    expect(plan.deletes.members).not.toContain('m-admin');
    expect(plan.deletes.players).not.toContain('p-admin');
  });

  it('is idempotent: an empty database yields an empty plan', () => {
    const plan = buildPurgePlan(snap());
    expect(plan.totalRows).toBe(0);
    expect(plan.authCandidates).toEqual([]);
  });

  it('orders players before members and children before parents', () => {
    expect(DELETE_ORDER.indexOf('players')).toBeLessThan(DELETE_ORDER.indexOf('members'));
    for (const child of ['onboarding_consents', 'student_demographics', 'player_identities', 'school_managers'] as const) {
      expect(DELETE_ORDER.indexOf(child)).toBeLessThan(DELETE_ORDER.indexOf('members'));
    }
  });
});

describe('filterAuthCandidates', () => {
  it('protects an auth user whose live email matches staff, and one whose email cannot be read', () => {
    const r = filterAuthCandidates(
      ['a', 'b', 'c', 'd'],
      new Map<string, string | null>([['a', 'ok@x.org'], ['b', 'STAN@ez.org'], ['c', null]]),
      ['stan@ez.org'],
      []
    );
    expect(r.toDelete).toEqual(['a']);
    expect(r.protectedIds.sort()).toEqual(['b', 'c', 'd']);
  });
  it('protects a staff user id even when the email looks harmless', () => {
    const r = filterAuthCandidates(['a'], new Map([['a', 'ok@x.org']]), [], ['a']);
    expect(r.toDelete).toEqual([]);
  });
});

describe('parseArgs', () => {
  it('defaults to dry run', () => {
    expect(parseArgs([])).toMatchObject({ execute: false, deleteAuthUsers: false });
  });
  it('rejects --delete-auth-users without --execute', () => {
    expect(() => parseArgs(['--delete-auth-users'])).toThrow(/only valid together with --execute/);
    expect(() => parseArgs(['--dry-run', '--delete-auth-users'])).toThrow();
  });
  it('rejects unknown flags and --execute with --dry-run', () => {
    expect(() => parseArgs(['--yolo'])).toThrow(/Unknown argument/);
    expect(() => parseArgs(['--execute', '--dry-run'])).toThrow(/mutually exclusive/);
  });
  it('rejects --auth-user-ids-file without --delete-auth-users', () => {
    expect(() => parseArgs(['--execute', '--auth-user-ids-file=x.json'])).toThrow();
  });
});

describe('masking', () => {
  it('masks emails and names', () => {
    expect(maskEmail('Stan@ez.org')).toBe('S***@ez.org');
    expect(maskName('Sam', 'Student')).toBe('S. S.');
    expect(maskEmail(null)).toBe('(none)');
  });
});

// --- orchestration with fakes -------------------------------------------------

function fakeDeps(snapshot: Snapshot, over: Partial<PurgeDeps> = {}, txOver: Partial<TxHandle> = {}) {
  const logs: string[] = [];
  const calls: string[] = [];
  const tx: TxHandle = {
    lockTables: async () => { calls.push('lock'); },
    loadSnapshot: async () => snapshot,
    deleteByIds: vi.fn(async (table, ids) => { calls.push(`delete:${table}`); return ids.length; }),
    countMembers: async (ids) => ids.length,
    countSchoolManagers: async (ids) => ids.length,
    ...txOver,
  };
  const deps: PurgeDeps = {
    host: 'db.example.com',
    assertTarget: vi.fn(() => { calls.push('gate'); }),
    loadSnapshot: async () => { calls.push('load'); return snapshot; },
    takeBackup: vi.fn(() => { calls.push('backup'); return '/tmp/backup.sql'; }),
    prompt: vi.fn(async () => 'purge db.example.com 8'),
    transaction: async (fn) => { calls.push('tx'); return fn(tx); },
    auth: {
      hasCredentials: () => true,
      emailOf: async (id) => `${id}@school.org`,
      deleteUser: vi.fn(async () => {}),
    },
    writeAuthList: () => '/tmp/ids.json',
    log: (l) => logs.push(l),
    ...over,
  };
  return { deps, logs, calls, tx };
}

describe('runPurge', () => {
  const total = buildPurgePlan(world()).totalRows;

  it('dry run mutates nothing: no gate, no backup, no prompt, no transaction', async () => {
    const { deps, calls } = fakeDeps(world());
    const r = await runPurge(parseArgs([]), deps);
    expect(r.mode).toBe('dry-run');
    expect(deps.takeBackup).not.toHaveBeenCalled();
    expect(deps.prompt).not.toHaveBeenCalled();
    expect(calls).toEqual(['load']);
  });

  it('dry run output shows masked people, never full emails', async () => {
    const { deps, logs } = fakeDeps(world());
    await runPurge(parseArgs([]), deps);
    const out = logs.join('\n');
    expect(out).toContain('s***@ez.org');
    expect(out).not.toContain('stan@ez.org');
    expect(out).not.toContain('Stan');
    expect(out).toMatch(/Refresh these tags: members, players, rosters/);
  });

  it('execute is refused when the remote gate throws, before reading or backing up', async () => {
    const { deps, calls } = fakeDeps(world(), {
      assertTarget: () => { throw new Error('not loopback'); },
    });
    await expect(runPurge(parseArgs(['--execute']), deps)).rejects.toThrow('not loopback');
    expect(calls).toEqual([]);
    expect(deps.takeBackup).not.toHaveBeenCalled();
  });

  it('execute aborts, deleting nothing, when the backup fails', async () => {
    const { deps, calls } = fakeDeps(world(), {
      takeBackup: () => { throw new Error('pg_dump failed'); },
    });
    await expect(runPurge(parseArgs(['--execute']), deps)).rejects.toThrow('pg_dump failed');
    expect(calls).not.toContain('tx');
  });

  it('a wrong confirmation aborts before the transaction', async () => {
    const { deps, calls } = fakeDeps(world(), { prompt: async () => 'yes' });
    await expect(runPurge(parseArgs(['--execute']), deps)).rejects.toThrow(/Confirmation did not match/);
    expect(calls).not.toContain('tx');
  });

  it('a confirmation with the wrong hostname or count aborts', async () => {
    for (const bad of [`purge other.example.com ${total}`, `purge db.example.com ${total + 1}`]) {
      const { deps, calls } = fakeDeps(world(), { prompt: async () => bad });
      await expect(runPurge(parseArgs(['--execute']), deps)).rejects.toThrow(/Confirmation/);
      expect(calls).not.toContain('tx');
    }
  });

  it('execute runs gate -> backup -> transaction, deleting in dependency order', async () => {
    const { deps, calls } = fakeDeps(world(), { prompt: async () => confirmationPhrase('db.example.com', total) });
    const r = await runPurge(parseArgs(['--execute']), deps);
    expect(r.deleted).toBe(total);
    expect(calls.indexOf('gate')).toBeLessThan(calls.indexOf('load'));
    expect(calls.indexOf('backup')).toBeLessThan(calls.indexOf('tx'));
    const order = calls.filter((c) => c.startsWith('delete:')).map((c) => c.slice(7));
    expect(order.indexOf('players')).toBeLessThan(order.indexOf('members'));
    expect(order).toEqual(DELETE_ORDER.filter((t) => buildPurgePlan(world()).deletes[t].length > 0));
  });

  it('a row-count mismatch rolls back (the transaction rejects)', async () => {
    const { deps } = fakeDeps(
      world(),
      { prompt: async () => confirmationPhrase('db.example.com', total) },
      { deleteByIds: async (table, ids) => (table === 'members' ? ids.length - 1 : ids.length) }
    );
    await expect(runPurge(parseArgs(['--execute']), deps)).rejects.toThrow(/expected to delete 2 row\(s\) but the database removed 1/);
  });

  it('data drift between the plan and the transaction rolls back', async () => {
    const drifted = world();
    drifted.members.push(member('m-new', 'New', 'Kid', 'new@x.org'));
    drifted.playerInvites.push({ id: 'pi-new', memberId: 'm-new', draftText: null });
    const { deps, tx } = fakeDeps(
      world(),
      { prompt: async () => confirmationPhrase('db.example.com', total) },
      { loadSnapshot: async () => drifted }
    );
    await expect(runPurge(parseArgs(['--execute']), deps)).rejects.toThrow(/data changed/);
    expect(tx.deleteByIds).not.toHaveBeenCalled();
  });

  it('a protected row that vanished rolls back', async () => {
    const { deps } = fakeDeps(
      world(),
      { prompt: async () => confirmationPhrase('db.example.com', total) },
      { countMembers: async (ids) => ids.length - 1 }
    );
    await expect(runPurge(parseArgs(['--execute']), deps)).rejects.toThrow(/protected member row is missing/);
  });

  it('--delete-auth-users needs service credentials before anything is changed', async () => {
    const { deps, calls } = fakeDeps(world(), { auth: { hasCredentials: () => false, emailOf: async () => null, deleteUser: async () => {} } });
    await expect(runPurge(parseArgs(['--execute', '--delete-auth-users']), deps)).rejects.toThrow(/SUPABASE_SECRET_KEY/);
    expect(calls).not.toContain('backup');
  });

  it('deletes auth users after commit, one by one, skipping staff by live email, continuing past failures', async () => {
    const s = world();
    s.schoolManagers.push({ id: 'sm-b', userId: 'u-b', memberId: null }, { id: 'sm-c', userId: 'u-c', memberId: null });
    const t = buildPurgePlan(s).totalRows;
    const deleteUser = vi.fn(async (id: string) => { if (id === 'u-b') throw new Error('boom'); });
    const { deps, calls, logs } = fakeDeps(s, {
      prompt: async () => confirmationPhrase('db.example.com', t),
      auth: {
        hasCredentials: () => true,
        // u-c is an auth user whose live email is a staff email.
        emailOf: async (id) => (id === 'u-c' ? 'stan@ez.org' : `${id}@school.org`),
        deleteUser,
      },
    });
    const r = await runPurge(parseArgs(['--execute', '--delete-auth-users']), deps);
    expect(calls.indexOf('tx')).toBeLessThan(calls.length);
    expect(deleteUser.mock.calls.map((c) => c[0]).sort()).toEqual(['u-b', 'u-mgr']);
    expect(deleteUser).not.toHaveBeenCalledWith('u-staff');
    expect(deleteUser).not.toHaveBeenCalledWith('u-c');
    expect(r.authFailed).toEqual(['u-b']);
    expect(r.authDeleted).toEqual(['u-mgr']);
    expect(logs.join('\n')).not.toContain('@school.org');
  });

  it('without --delete-auth-users, auth users are never deleted', async () => {
    const { deps } = fakeDeps(world(), { prompt: async () => confirmationPhrase('db.example.com', total) });
    await runPurge(parseArgs(['--execute']), deps);
    expect(deps.auth!.deleteUser).not.toHaveBeenCalled();
  });

  it('a second run on an emptied database does nothing and takes no backup', async () => {
    const { deps } = fakeDeps(snap());
    await runPurge(parseArgs(['--execute']), deps);
    expect(deps.takeBackup).not.toHaveBeenCalled();
    expect(deps.prompt).not.toHaveBeenCalled();
  });

  it('fingerprint ignores order but notices a different set', () => {
    const a = buildPurgePlan(world());
    const b = buildPurgePlan(world());
    b.deletes.members.reverse();
    expect(planFingerprint(a)).toBe(planFingerprint(b));
    b.deletes.members.pop();
    expect(planFingerprint(a)).not.toBe(planFingerprint(b));
  });
});

// --- structural guards ----------------------------------------------------------

describe('schema audit', () => {
  const schema = readFileSync(join(root, 'app/lib/db/schema.ts'), 'utf8');
  const tableBlocks = schema.split(/\nexport const /).slice(1);

  function tablesReferencing(target: string): string[] {
    return tableBlocks
      .filter((b) => b.includes('pgTable('))
      .filter((b) => new RegExp(`references\\(\\(\\) => ${target}\\.id`).test(b))
      .map((b) => /pgTable\(\s*'([a-z_]+)'/.exec(b)![1])
      .sort();
  }

  it('every table with a foreign key to members is one this script knows about', () => {
    // A new FK to members must be classified (delete, keep or protect) before this passes.
    expect(tablesReferencing('members')).toEqual(
      [
        'leadership', 'manager_invites', 'onboarding_consents', 'people', 'player_identities',
        'player_invites', 'players', 'school_managers', 'staff_members', 'student_demographics',
      ].sort()
    );
  });

  it('no table has a foreign key to school_managers, player_invites or manager_invites', () => {
    for (const t of ['schoolManagers', 'playerInvites', 'managerInvites']) {
      expect(tablesReferencing(t)).toEqual([]);
    }
  });

  it('players.member_id is RESTRICT, which is why players are deleted before members', () => {
    expect(schema).toMatch(/memberId: uuid\('member_id'\)\s*\.references\(\(\) => members\.id, \{ onDelete: 'restrict' \}\)/);
  });

  it('every deleted table exists in the schema', () => {
    for (const t of DELETE_ORDER) expect(schema).toMatch(new RegExp(`pgTable\\(\\s*'${t}'`));
  });
});

describe('script source guards', () => {
  const src = readFileSync(join(root, 'db/purge-onboarding-test-data.ts'), 'utf8');
  it('never reads .env itself and names the service key only by variable name', () => {
    expect(src).not.toMatch(/readFileSync\([^)]*\.env/);
    expect(src).toMatch(/process\.env\.SUPABASE_SECRET_KEY/);
  });
  it('the npm script uses the react-server condition (the repo service client imports server-only)', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['db:purge:onboarding-test-data']).toContain('--conditions=react-server');
    expect(pkg.scripts['db:purge:onboarding-test-data']).toContain('db/purge-onboarding-test-data.ts');
  });
});

describe('entry point', () => {
  const tsxCli = join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const entry = join(root, 'db', 'purge-onboarding-test-data.ts');
  const run = (args: string[], env: Record<string, string>) =>
    spawnSync(process.execPath, [tsxCli, '--conditions=react-server', entry, ...args], {
      cwd: root,
      env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '', ...env } as unknown as NodeJS.ProcessEnv,
      encoding: 'utf8',
      timeout: 60_000,
    });

  it('--execute against a remote host is refused by the real gate before any connection', () => {
    const r = run(['--execute'], { DATABASE_URL: 'postgresql://u:p@db.example.com:5432/x' });
    expect(`${r.stdout}${r.stderr}`).toMatch(/not loopback/);
    expect(r.status).toBe(1);
  }, 70_000);

  it('--delete-auth-users without --execute is rejected', () => {
    const r = run(['--delete-auth-users'], { DATABASE_URL: 'postgresql://u:p@127.0.0.1:1/x' });
    expect(`${r.stdout}${r.stderr}`).toMatch(/only valid together with --execute/);
    expect(r.status).toBe(1);
  }, 70_000);
});
