import { beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('@/app/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { ensureStaffMember } from '@/app/lib/auth';
import { members, schoolManagers, staffMembers, staffRevocations } from '@/app/lib/db/schema';

describe('ensureStaffMember for school managers', () => {
  beforeEach(() => {
    database.selectResults.length = 0;
    database.fromTables.length = 0;
    vi.clearAllMocks();
  });

  it('does not create a staff row for an active manager linked by user id', async () => {
    database.selectResults.push(
      [], // revocation
      [], // staff by id
      [], // staff by email
      [{ id: 'manager-1' }], // school_managers by user id
    );

    await expect(ensureStaffMember('manager-user', 'Manager@Example.com')).resolves.toBeNull();

    expect(database.fromTables).toEqual([
      staffRevocations,
      staffMembers,
      staffMembers,
      schoolManagers,
    ]);
    expect(database.db.insert).not.toHaveBeenCalled();
    expect(database.db.update).not.toHaveBeenCalled();
  });

  it('does not create a staff row for a manager linked through the member email', async () => {
    database.selectResults.push(
      [],
      [],
      [],
      [], // no manager by user id
      [{ id: 'member-1' }], // member by email
      [{ id: 'manager-1' }], // manager by member id
    );

    await expect(ensureStaffMember('manager-user', 'manager@example.com')).resolves.toBeNull();

    expect(database.fromTables.slice(-3)).toEqual([schoolManagers, members, schoolManagers]);
    expect(database.db.insert).not.toHaveBeenCalled();
  });

  it('leaves an existing staff row alone even when the user is also a manager', async () => {
    database.selectResults.push(
      [],
      [{ userId: 'both-user', email: 'both@example.com' }], // staff by id
    );

    await expect(ensureStaffMember('both-user', 'both@example.com')).resolves.toBe('both@example.com');

    expect(database.fromTables).not.toContain(schoolManagers);
    expect(database.db.insert).not.toHaveBeenCalled();
    expect(database.db.update).not.toHaveBeenCalled();
  });
});
