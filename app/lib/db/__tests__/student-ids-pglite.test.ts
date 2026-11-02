/**
 * Rehearsal of migration 0058 and the student ID persistence against an in-memory PGlite built from
 * db/migrations/*.sql. No other database is touched.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../schema';
import { applyMigrations } from '../../../../db/__tests__/helpers/pglite-migrations';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../index', () => ({
  get db() {
    return holder.db;
  },
}));

let client: PGlite;
let schoolId: string;
let gameId: string;
const USER = '00000000-0000-4000-8000-000000000001';
let n = 0;

async function one<T = { id: string }>(text: string, params: unknown[] = []) {
  return (await client.query(text, params)).rows[0] as T;
}

async function member(email: string, schoolEmail: string | null) {
  return (
    await one<{ id: string }>(
      `insert into members (first_name, last_name, email, school_email, school_id) values ('A', 'B', $1, $2, $3) returning id`,
      [email, schoolEmail, schoolId],
    )
  ).id;
}

async function invite(status = 'pending', expiresIn = '7 days'): Promise<string> {
  n += 1;
  return (
    await one<{ id: string }>(
      `insert into player_invites (school_id, game_id, token_hash, intended_first_name, intended_last_name, invited_by_user_id, status, expires_at)
       values ($1, $2, $3, 'A', 'B', $4, $5, now() + $6::interval) returning id`,
      [schoolId, gameId, `hash-${n}`, USER, status, expiresIn],
    )
  ).id;
}

let lib: typeof import('../student-ids');

beforeAll(async () => {
  client = new PGlite();
  const report = await applyMigrations(client);
  expect(report.skipped.filter((s) => /student_id_uploads|school_email/i.test(s.statement))).toEqual([]);
  holder.db = drizzle(client, { schema });
  schoolId = (await one(`insert into schools (name, slug) values ('Alpha HS', 'alpha') returning id`)).id;
  gameId = (await one(`insert into games (slug, display_name, short_name) values ('val', 'Valorant', 'VAL') returning id`)).id;
  lib = await import('../student-ids');
});
afterAll(async () => {
  await client.close();
});

describe('members.school_email', () => {
  it('is unique case-insensitively but allows many members without one', async () => {
    await member('a1@gmail.com', 'Dup@nycstudents.net');
    await expect(member('a2@gmail.com', 'dup@NYCSTUDENTS.net')).rejects.toThrow(/members_school_email_lower_idx|duplicate key/i);
    await member('a3@gmail.com', null);
    await member('a4@gmail.com', null);
  });
});

describe('student_id_uploads', () => {
  it('keeps one pending upload per invite and returns the replaced key', async () => {
    const inviteId = await invite();
    expect(await lib.replacePendingUpload('player', inviteId, { storageKey: 'k1.jpg', contentType: 'image/jpeg', sizeBytes: 5 })).toEqual({ replacedKey: null });
    expect(await lib.replacePendingUpload('player', inviteId, { storageKey: 'k2.png', contentType: 'image/png', sizeBytes: 6 })).toEqual({ replacedKey: 'k1.jpg' });
    expect((await lib.findPendingUpload('player', inviteId))?.storageKey).toBe('k2.png');
    // A pending upload is invisible to a different invite or the other kind.
    expect(await lib.findPendingUpload('manager', inviteId)).toBeNull();
    expect(await lib.findPendingUpload('player', await invite())).toBeNull();
  });

  it('links the pending upload to the member once, replacing an older photo of the same member', async () => {
    const memberId = await member('link@gmail.com', 'link@nycstudents.net');
    const first = await invite();
    await lib.replacePendingUpload('player', first, { storageKey: 'm1.jpg', contentType: 'image/jpeg', sizeBytes: 1 });
    const db = holder.db as ReturnType<typeof drizzle<typeof schema>>;
    expect(await db.transaction((tx) => lib.linkUploadToMember(tx as never, 'player', first, memberId))).toEqual({ linkedKey: 'm1.jpg', replacedKey: null });
    expect(await lib.findStudentIdKeyForMember(memberId)).toBe('m1.jpg');
    expect(await lib.findPendingUpload('player', first)).toBeNull();
    expect((await lib.listMembersWithStudentId([memberId])).has(memberId)).toBe(true);

    const second = await invite();
    await lib.replacePendingUpload('player', second, { storageKey: 'm2.jpg', contentType: 'image/jpeg', sizeBytes: 1 });
    expect(await db.transaction((tx) => lib.linkUploadToMember(tx as never, 'player', second, memberId))).toEqual({ linkedKey: 'm2.jpg', replacedKey: 'm1.jpg' });
    expect(await lib.findStudentIdKeyForMember(memberId)).toBe('m2.jpg');
  });

  it('keeps a replaced photo as a retrievable orphan record until its object is confirmed removed', async () => {
    const inviteId = await invite();
    await lib.replacePendingUpload('player', inviteId, { storageKey: 'r1.jpg', contentType: 'image/jpeg', sizeBytes: 1 });
    await lib.replacePendingUpload('player', inviteId, { storageKey: 'r2.jpg', contentType: 'image/jpeg', sizeBytes: 1 });
    // Storage removal "failed": nothing deleted any row, so the old key is still found by the sweep.
    const orphans = await lib.findOrphanUploads();
    expect(orphans.map((o) => o.storageKey)).toContain('r1.jpg');
    expect(orphans.map((o) => o.storageKey)).not.toContain('r2.jpg');
    // Same for a member whose older photo is replaced by a newer invite's.
    const memberId = await member('rep@gmail.com', 'rep@nycstudents.net');
    const db = holder.db as ReturnType<typeof drizzle<typeof schema>>;
    const a = await invite();
    await lib.replacePendingUpload('player', a, { storageKey: 'ma.jpg', contentType: 'image/jpeg', sizeBytes: 1 });
    await db.transaction((tx) => lib.linkUploadToMember(tx as never, 'player', a, memberId));
    const b = await invite();
    await lib.replacePendingUpload('player', b, { storageKey: 'mb.jpg', contentType: 'image/jpeg', sizeBytes: 1 });
    await db.transaction((tx) => lib.linkUploadToMember(tx as never, 'player', b, memberId));
    expect((await lib.findOrphanUploads()).map((o) => o.storageKey)).toContain('ma.jpg');
    expect(await lib.findStudentIdKeyForMember(memberId)).toBe('mb.jpg');
  });

  it('returns null from the link when the invite has no pending upload', async () => {
    const memberId = await member('none@gmail.com', 'none@nycstudents.net');
    const db = holder.db as ReturnType<typeof drizzle<typeof schema>>;
    expect(await db.transaction((tx) => lib.linkUploadToMember(tx as never, 'player', crypto.randomUUID(), memberId))).toBeNull();
  });

  it('treats an upload as an orphan once its member is deleted or its invite is no longer pending', async () => {
    const live = await invite();
    await lib.replacePendingUpload('player', live, { storageKey: 'live.jpg', contentType: 'image/jpeg', sizeBytes: 1 });
    const spent = await invite('rejected');
    await lib.replacePendingUpload('player', spent, { storageKey: 'spent.jpg', contentType: 'image/jpeg', sizeBytes: 1 });
    const expired = await invite('pending', '-1 day');
    await lib.replacePendingUpload('player', expired, { storageKey: 'expired.jpg', contentType: 'image/jpeg', sizeBytes: 1 });
    const gone = crypto.randomUUID();
    await lib.replacePendingUpload('manager', gone, { storageKey: 'gone.jpg', contentType: 'image/jpeg', sizeBytes: 1 });

    const memberId = await member('del@gmail.com', 'del@nycstudents.net');
    const inv = await invite('submitted');
    await lib.replacePendingUpload('player', inv, { storageKey: 'del.jpg', contentType: 'image/jpeg', sizeBytes: 1 });
    const db = holder.db as ReturnType<typeof drizzle<typeof schema>>;
    await db.transaction((tx) => lib.linkUploadToMember(tx as never, 'player', inv, memberId));
    expect((await lib.findOrphanUploads()).map((o) => o.storageKey)).not.toContain('del.jpg');

    // Deleting the member keeps the row (set null) so the sweep still knows which object to remove.
    await client.query('delete from members where id = $1', [memberId]);
    const orphans = (await lib.findOrphanUploads()).map((o) => o.storageKey).sort();
    // (earlier tests' demoted photos are orphans too)
    expect(orphans).toEqual(expect.arrayContaining(['del.jpg', 'expired.jpg', 'gone.jpg', 'spent.jpg']));
    expect(orphans).not.toContain('live.jpg');

    const rows = await lib.findOrphanUploads();
    await lib.deleteUploadRows(rows.map((r) => r.id));
    expect(await lib.findOrphanUploads()).toEqual([]);
    expect((await lib.findPendingUpload('player', live))?.storageKey).toBe('live.jpg');
  });
});
