import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const database = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const fromTables: unknown[] = [];

  const db = {
    select: vi.fn(() => {
      const result = selectResults.shift() ?? [];
      const builder = {
        from: vi.fn((table: unknown) => {
          fromTables.push(table);
          return builder;
        }),
        where: vi.fn(() => builder),
        limit: vi.fn(async () => result),
      };
      return builder;
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => {
        const result = Promise.resolve(undefined) as Promise<undefined> & {
          onConflictDoNothing: () => Promise<void>;
        };
        result.onConflictDoNothing = vi.fn(async () => undefined);
        return result;
      }),
    })),
    update: vi.fn(() => {
      const builder = {
        set: vi.fn(() => builder),
        where: vi.fn(async () => undefined),
      };
      return builder;
    }),
    execute: vi.fn(async () => undefined),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
  };

  return { db, selectResults, fromTables };
});

vi.mock('@/app/lib/db', () => ({ db: database.db }));
vi.mock('@/app/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { ensureStaffMember, StaffSetupError } from '@/app/lib/auth';
import { staffAuditLogs, staffMembers, staffRevocations } from '@/app/lib/db/schema';

describe('durable staff revocation', () => {
  beforeEach(() => {
    database.selectResults.length = 0;
    database.fromTables.length = 0;
    vi.clearAllMocks();
  });

  it('rejects a tombstoned identity before membership reconciliation', async () => {
    database.selectResults.push([{ userId: 'revoked-user' }]);

    await expect(
      ensureStaffMember('revoked-user', 'REVOKED@EXAMPLE.COM'),
    ).rejects.toThrow('Your staff access has been revoked');

    expect(database.fromTables).toEqual([staffRevocations]);
    expect(database.db.execute).toHaveBeenCalledOnce();
    expect(database.db.insert).not.toHaveBeenCalled();
  });

  it('still self-heals a non-revoked identity with no membership row', async () => {
    database.selectResults.push(
      [],
      [],
      [],
      [{ email: 'zero-role@example.com' }],
    );

    await expect(
      ensureStaffMember('zero-role-user', 'ZERO-ROLE@EXAMPLE.COM'),
    ).resolves.toBe('zero-role@example.com');

    expect(database.fromTables).toEqual([
      staffRevocations,
      staffMembers,
      staffMembers,
      staffMembers,
    ]);
    expect(database.db.insert).toHaveBeenCalledWith(staffMembers);
  });

  it('keeps identity conflicts visible and writes an audit event', async () => {
    database.selectResults.push(
      [],
      [],
      [{ userId: 'existing-user' }],
    );

    await expect(
      ensureStaffMember('replacement-user', 'staff@example.com'),
    ).rejects.toBeInstanceOf(StaffSetupError);

    expect(database.db.insert).toHaveBeenCalledWith(staffAuditLogs);
    expect(database.db.insert).not.toHaveBeenCalledWith(staffMembers);
  });

  it('persists the tombstone before deleting membership and treats auth deletion as cleanup', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/team/actions.ts'),
      'utf8',
    );
    const tombstoneInsert = source.indexOf('tx.insert(schema.staffRevocations)');
    const membershipDelete = source.indexOf('.delete(schema.staffMembers)', tombstoneInsert);
    const authDelete = source.indexOf('supabase.auth.admin.deleteUser(userId)', membershipDelete);

    expect(tombstoneInsert).toBeGreaterThan(-1);
    expect(membershipDelete).toBeGreaterThan(tombstoneInsert);
    expect(authDelete).toBeGreaterThan(membershipDelete);
  });

  it('does not expose tombstone mutations through authenticated RLS policies', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'db/migrations/0020_fine_cannonball.sql'),
      'utf8',
    );

    expect(migration).toContain('CREATE POLICY "staff_revocations_manage_select"');
    expect(migration).toContain('FOR SELECT TO "authenticated"');
    expect(migration).not.toMatch(/staff_revocations[^;]*FOR (?:INSERT|UPDATE|DELETE)/s);
  });
});
