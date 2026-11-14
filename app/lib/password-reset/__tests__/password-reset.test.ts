import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Permissions } from '@/app/lib/roles';
import {
  INVALID_RESET_LINK_MESSAGE,
  RESET_LINK_TTL_MS,
  checkIssueAuthorization,
  createPasswordResetService,
  generateResetToken,
  hashResetToken,
  resetLinkStatus,
  type ResetActor,
  type ResetAuthAdmin,
  type ResetLinkRow,
  type ResetStore,
  type ResetTarget,
} from '../core';

const T0 = new Date('2026-11-13T12:00:00Z');

interface FakeAccount {
  active: boolean;
  isStaff: boolean;
  isOwner: boolean;
  highestRolePosition: number;
}

/** In-memory store with the same atomic semantics the Drizzle store gets from SQL. */
function createFakeStore(accounts: Record<string, FakeAccount>) {
  const rows: (ResetLinkRow & { tokenHash: string })[] = [];
  let seq = 0;
  const store: ResetStore = {
    async getTarget(userId, kind) {
      const a = accounts[userId];
      if (!a) return null;
      return { userId, kind, ...a } satisfies ResetTarget;
    },
    async replaceOutstanding({ userId, kind, tokenHash, issuedByUserId, expiresAt, now }) {
      for (const r of rows) {
        if (r.userId === userId && !r.usedAt && !r.revokedAt) {
          r.revokedAt = now;
          r.revokedBy = issuedByUserId;
        }
      }
      const id = `link-${++seq}`;
      rows.push({
        id,
        userId,
        targetKind: kind,
        tokenHash,
        issuedByUserId,
        issuedByEmail: 'staff@example.com',
        createdAt: now,
        expiresAt,
        usedAt: null,
        revokedAt: null,
        revokedBy: null,
      });
      return { id };
    },
    async findByHash(hash) {
      return rows.find((r) => r.tokenHash === hash) ?? null;
    },
    async getById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async claim(id, now) {
      const r = rows.find((x) => x.id === id);
      if (!r || r.usedAt || r.revokedAt || r.expiresAt.getTime() <= now.getTime()) return false;
      r.usedAt = now;
      return true;
    },
    async release(id) {
      const r = rows.find((x) => x.id === id);
      if (r && !r.revokedAt) r.usedAt = null;
    },
    async revoke(id, by, now) {
      const r = rows.find((x) => x.id === id);
      if (!r || r.usedAt || r.revokedAt || r.expiresAt.getTime() <= now.getTime()) return false;
      r.revokedAt = now;
      r.revokedBy = by;
      return true;
    },
    async listForUser(userId, limit) {
      return rows
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    },
  };
  return { store, rows };
}

function setup(initial: Record<string, FakeAccount>, clock = { now: T0 }) {
  const accounts: Record<string, FakeAccount> = Object.fromEntries(
    Object.entries(initial).map(([id, a]) => [id, { ...a }]),
  );
  const { store, rows } = createFakeStore(accounts);
  const passwords: Record<string, string> = { 'mgr-1': 'old-password', 'staff-1': 'old-password' };
  const auth: ResetAuthAdmin = {
    setPassword: vi.fn(async (userId: string, password: string) => {
      passwords[userId] = password;
    }),
    revokeAllSessions: vi.fn(async () => undefined),
  };
  const onSessionRevocationFailed = vi.fn();
  const service = createPasswordResetService({
    store,
    auth,
    now: () => clock.now,
    onSessionRevocationFailed,
  });
  return { service, store, rows, auth, passwords, clock, onSessionRevocationFailed, accounts };
}

const manager: FakeAccount = { active: true, isStaff: false, isOwner: false, highestRolePosition: 0 };
const staffAccount = (position: number, isOwner = false): FakeAccount => ({
  active: true,
  isStaff: true,
  isOwner,
  highestRolePosition: position,
});

const schoolsAdmin: ResetActor = {
  id: 'actor',
  permissions: Permissions.MANAGE_SCHOOLS,
  isOwner: false,
  highestRolePosition: 5,
};
const rolesAdmin: ResetActor = {
  id: 'actor',
  permissions: Permissions.MANAGE_ROLES,
  isOwner: false,
  highestRolePosition: 5,
};
const owner: ResetActor = { id: 'owner', permissions: BigInt(0), isOwner: true, highestRolePosition: 100 };

describe('token generation and hashing', () => {
  it('produces 256-bit hex tokens that do not repeat', () => {
    const a = generateResetToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(generateResetToken()).not.toBe(a);
  });

  it('hashes with SHA-256 and the hash differs from the token', () => {
    const hash = hashResetToken('abc');
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('never stores the raw token', async () => {
    const { service, rows } = setup({ 'mgr-1': manager });
    const res = await service.issue(schoolsAdmin, { userId: 'mgr-1', kind: 'manager' });
    if (!res.success) throw new Error('expected success');
    expect(rows[0].tokenHash).toBe(hashResetToken(res.token));
    expect(JSON.stringify(rows)).not.toContain(res.token);
  });
});

describe('resetLinkStatus', () => {
  const base = { usedAt: null, revokedAt: null, expiresAt: new Date(T0.getTime() + 1000) };
  it('classifies each state', () => {
    expect(resetLinkStatus(base, T0)).toBe('outstanding');
    expect(resetLinkStatus({ ...base, expiresAt: T0 }, T0)).toBe('expired');
    expect(resetLinkStatus({ ...base, usedAt: T0 }, T0)).toBe('used');
    expect(resetLinkStatus({ ...base, revokedAt: T0 }, T0)).toBe('revoked');
  });
});

describe('issuing', () => {
  it('sets a 24 hour expiry and records the issuer', async () => {
    const { service, rows } = setup({ 'mgr-1': manager });
    const res = await service.issue(schoolsAdmin, { userId: 'mgr-1', kind: 'manager' });
    expect(res.success).toBe(true);
    expect(rows[0].expiresAt.getTime() - T0.getTime()).toBe(RESET_LINK_TTL_MS);
    expect(RESET_LINK_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(rows[0].issuedByUserId).toBe('actor');
    expect(rows[0].targetKind).toBe('manager');
  });

  it('revokes the outstanding link when a new one is issued', async () => {
    const { service, rows } = setup({ 'mgr-1': manager });
    const first = await service.issue(schoolsAdmin, { userId: 'mgr-1', kind: 'manager' });
    const second = await service.issue(schoolsAdmin, { userId: 'mgr-1', kind: 'manager' });
    if (!first.success || !second.success) throw new Error('expected success');
    expect(rows[0].revokedAt).toEqual(T0);
    expect(rows[0].revokedBy).toBe('actor');
    expect(rows[1].revokedAt).toBeNull();
    expect(await service.peek(first.token)).toBe(false);
    expect(await service.peek(second.token)).toBe(true);
  });

  it('refuses deactivated accounts', async () => {
    const { service, rows } = setup({ 'mgr-1': { ...manager, active: false } });
    const res = await service.issue(schoolsAdmin, { userId: 'mgr-1', kind: 'manager' });
    expect(res).toMatchObject({ success: false });
    expect(rows).toHaveLength(0);
  });

  it('refuses unknown accounts', async () => {
    const { service } = setup({});
    expect(await service.issue(schoolsAdmin, { userId: 'nope', kind: 'manager' })).toMatchObject({ success: false });
  });

  it('refuses issuing for yourself', async () => {
    const { service } = setup({ actor: staffAccount(1) });
    const res = await service.issue(rolesAdmin, { userId: 'actor', kind: 'staff' });
    expect(res).toMatchObject({ success: false });
  });
});

describe('permission and escalation guards', () => {
  it('manager links need MANAGE_SCHOOLS, staff links need MANAGE_ROLES', async () => {
    const { service } = setup({ 'mgr-1': manager, 'staff-1': staffAccount(1) });
    expect(await service.issue(rolesAdmin, { userId: 'mgr-1', kind: 'manager' })).toMatchObject({ success: false });
    expect(await service.issue(schoolsAdmin, { userId: 'staff-1', kind: 'staff' })).toMatchObject({ success: false });
    expect(await service.issue(schoolsAdmin, { userId: 'mgr-1', kind: 'manager' })).toMatchObject({ success: true });
    expect(await service.issue(rolesAdmin, { userId: 'staff-1', kind: 'staff' })).toMatchObject({ success: true });
  });

  it('requires a strictly higher role than the target staff member', async () => {
    const equal = checkIssueAuthorization(rolesAdmin, {
      userId: 't', kind: 'staff', active: true, isStaff: true, isOwner: false, highestRolePosition: 5,
    });
    const higher = checkIssueAuthorization(rolesAdmin, {
      userId: 't', kind: 'staff', active: true, isStaff: true, isOwner: false, highestRolePosition: 6,
    });
    const lower = checkIssueAuthorization(rolesAdmin, {
      userId: 't', kind: 'staff', active: true, isStaff: true, isOwner: false, highestRolePosition: 4,
    });
    expect(equal.ok).toBe(false);
    expect(higher.ok).toBe(false);
    expect(lower.ok).toBe(true);
  });

  it('only an owner can reset an owner', async () => {
    const { service } = setup({ 'staff-1': staffAccount(100, true) });
    const highRank: ResetActor = { ...rolesAdmin, highestRolePosition: 999 };
    expect(await service.issue(highRank, { userId: 'staff-1', kind: 'staff' })).toMatchObject({ success: false });
    expect(await service.issue(owner, { userId: 'staff-1', kind: 'staff' })).toMatchObject({ success: true });
  });

  it('applies the staff hierarchy to a manager account that is also staff', async () => {
    const { service } = setup({ 'mgr-1': { ...staffAccount(100, true), active: true } });
    const res = await service.issue(schoolsAdmin, { userId: 'mgr-1', kind: 'manager' });
    expect(res).toMatchObject({ success: false });
  });

  it('applies the hierarchy when revoking', async () => {
    const { service, rows, accounts } = setup({ 'staff-1': staffAccount(1) });
    const issued = await service.issue(owner, { userId: 'staff-1', kind: 'staff' });
    if (!issued.success) throw new Error('expected success');
    // The target has since become an owner: a lower-ranked actor can no longer touch the link.
    accounts['staff-1'] = staffAccount(100, true);
    expect(await service.revoke({ ...rolesAdmin, highestRolePosition: 99 }, rows[0].id)).toMatchObject({ success: false });
    expect(rows[0].revokedAt).toBeNull();
    expect(await service.revoke(owner, rows[0].id)).toEqual({ success: true });
    expect(rows[0].revokedBy).toBe('owner');
  });

  it('does not list history to an actor without the permission', async () => {
    const { service } = setup({ 'mgr-1': manager });
    await service.issue(schoolsAdmin, { userId: 'mgr-1', kind: 'manager' });
    expect(await service.list(rolesAdmin, { userId: 'mgr-1', kind: 'manager' })).toEqual([]);
    expect(await service.list(schoolsAdmin, { userId: 'mgr-1', kind: 'manager' })).toHaveLength(1);
  });
});

describe('redeeming', () => {
  async function issued(accounts: Record<string, FakeAccount> = { 'mgr-1': manager }) {
    const ctx = setup(accounts);
    const res = await ctx.service.issue(schoolsAdmin, { userId: 'mgr-1', kind: 'manager' });
    if (!res.success) throw new Error('expected success');
    return { ...ctx, token: res.token };
  }

  it('sets the password, marks the link used and revokes all sessions', async () => {
    const { service, rows, auth, passwords, token } = await issued();
    const res = await service.redeem(token, 'a-new-password');
    expect(res).toEqual({ ok: true, kind: 'manager' });
    expect(auth.setPassword).toHaveBeenCalledWith('mgr-1', 'a-new-password');
    expect(auth.revokeAllSessions).toHaveBeenCalledWith('mgr-1');
    expect(passwords['mgr-1']).toBe('a-new-password');
    expect(rows[0].usedAt).toEqual(T0);
  });

  it('is single use', async () => {
    const { service, auth, token } = await issued();
    await service.redeem(token, 'a-new-password');
    const again = await service.redeem(token, 'another-password');
    expect(again).toEqual({ ok: false, error: INVALID_RESET_LINK_MESSAGE, retryable: false });
    expect(auth.setPassword).toHaveBeenCalledTimes(1);
  });

  it('rejects an expired link', async () => {
    const { service, auth, clock, token } = await issued();
    clock.now = new Date(T0.getTime() + RESET_LINK_TTL_MS);
    expect(await service.redeem(token, 'a-new-password')).toMatchObject({ ok: false, error: INVALID_RESET_LINK_MESSAGE });
    expect(auth.setPassword).not.toHaveBeenCalled();
  });

  it('accepts a link just before expiry', async () => {
    const { service, clock, token } = await issued();
    clock.now = new Date(T0.getTime() + RESET_LINK_TTL_MS - 1);
    expect(await service.redeem(token, 'a-new-password')).toMatchObject({ ok: true });
  });

  it('gives the same generic message for unknown, used, revoked, expired and deactivated', async () => {
    const messages = new Set<string>();
    const collect = (r: Awaited<ReturnType<ReturnType<typeof setup>['service']['redeem']>>) => {
      if (!r.ok) messages.add(r.error);
      return r.ok;
    };

    const a = await issued();
    collect(await a.service.redeem('f'.repeat(64), 'a-new-password')); // unknown
    collect(await a.service.redeem('', 'a-new-password')); // missing

    const b = await issued();
    await b.service.redeem(b.token, 'a-new-password');
    collect(await b.service.redeem(b.token, 'a-new-password')); // used

    const c = await issued();
    await c.service.revoke(schoolsAdmin, c.rows[0].id);
    collect(await c.service.redeem(c.token, 'a-new-password')); // revoked

    const d = await issued();
    d.clock.now = new Date(T0.getTime() + RESET_LINK_TTL_MS + 1);
    collect(await d.service.redeem(d.token, 'a-new-password')); // expired

    const e = await issued();
    e.accounts['mgr-1'].active = false;
    collect(await e.service.redeem(e.token, 'a-new-password')); // account deactivated since

    expect([...messages]).toEqual([INVALID_RESET_LINK_MESSAGE]);
    expect(e.auth.setPassword).not.toHaveBeenCalled();
  });

  it('leaves the old password and the link intact when the password update fails', async () => {
    const { service, rows, auth, passwords, token } = await issued();
    vi.mocked(auth.setPassword).mockRejectedValueOnce(new Error('weak password'));
    const failed = await service.redeem(token, 'a-new-password');
    expect(failed).toMatchObject({ ok: false, retryable: true });
    expect(passwords['mgr-1']).toBe('old-password');
    expect(auth.revokeAllSessions).not.toHaveBeenCalled();
    expect(rows[0].usedAt).toBeNull();
    // The same link still works afterwards.
    expect(await service.redeem(token, 'a-new-password')).toMatchObject({ ok: true });
    expect(passwords['mgr-1']).toBe('a-new-password');
  });

  it('does not touch the password for a too-short one and keeps the link usable', async () => {
    const { service, rows, auth, token } = await issued();
    expect(await service.redeem(token, 'short')).toMatchObject({ ok: false, retryable: true });
    expect(auth.setPassword).not.toHaveBeenCalled();
    expect(rows[0].usedAt).toBeNull();
  });

  it('still succeeds when session revocation fails, and reports it', async () => {
    const { service, auth, onSessionRevocationFailed, token } = await issued();
    vi.mocked(auth.revokeAllSessions).mockRejectedValueOnce(new Error('db down'));
    expect(await service.redeem(token, 'a-new-password')).toMatchObject({ ok: true });
    expect(onSessionRevocationFailed).toHaveBeenCalledWith('mgr-1', expect.any(Error));
  });

  it('lets only one of two concurrent submissions through', async () => {
    const { service, auth, token } = await issued();
    const [a, b] = await Promise.all([
      service.redeem(token, 'first-password'),
      service.redeem(token, 'second-password'),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(auth.setPassword).toHaveBeenCalledTimes(1);
  });

  it('reports the kind so the caller can pick the login page', async () => {
    const ctx = setup({ 'staff-1': staffAccount(1) });
    const res = await ctx.service.issue(rolesAdmin, { userId: 'staff-1', kind: 'staff' });
    if (!res.success) throw new Error('expected success');
    expect(await ctx.service.redeem(res.token, 'a-new-password')).toEqual({ ok: true, kind: 'staff' });
  });
});

describe('migration 0062', () => {
  const dir = resolve(__dirname, '../../../../db/migrations');
  const sql = readFileSync(resolve(dir, '0062_password_reset_links.sql'), 'utf8');

  it('creates the table with RLS enabled and no policies', () => {
    expect(sql).toContain('CREATE TABLE "password_reset_links"');
    expect(sql).toContain('ALTER TABLE "password_reset_links" ENABLE ROW LEVEL SECURITY');
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });

  it('stores a hash, not a token, and allows one outstanding link per user', () => {
    expect(sql).toContain('"token_hash" text NOT NULL');
    expect(sql).not.toMatch(/"token" /);
    expect(sql).toContain('password_reset_links_one_outstanding_idx');
  });

  it('is registered in the journal after every earlier entry', () => {
    const journal = JSON.parse(readFileSync(resolve(dir, 'meta/_journal.json'), 'utf8')) as {
      entries: { idx: number; tag: string; when: number }[];
    };
    const entry = journal.entries.find((e) => e.tag === '0062_password_reset_links');
    expect(entry?.idx).toBe(62);
    for (const other of journal.entries.filter((e) => e.idx < 62)) {
      expect(entry!.when).toBeGreaterThan(other.when);
    }
  });
});
