/**
 * updateActiveSchoolManagerAccess against an in-memory PGlite built from db/migrations/*.sql:
 * the write only applies while the manager is active and keeps one primary contact per school and year.
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
let lib: typeof import('../onboarding-repository');
let n = 0;

async function manager(opts: { active?: boolean; primary?: boolean; year?: string } = {}) {
  n += 1;
  const uid = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const res = await client.query(
    `insert into school_managers (school_id, user_id, academic_year, is_primary_contact, is_active) values ($1, $2, $3, $4, $5) returning id`,
    [schoolId, uid, opts.year ?? '2026-27', opts.primary ?? false, opts.active ?? true],
  );
  return (res.rows[0] as { id: string }).id;
}

async function row(id: string) {
  return (await client.query(`select managed_games, is_primary_contact, is_active from school_managers where id = $1`, [id])).rows[0] as {
    managed_games: string[] | null;
    is_primary_contact: boolean;
    is_active: boolean;
  };
}

beforeAll(async () => {
  client = new PGlite();
  await applyMigrations(client);
  holder.db = drizzle(client, { schema });
  schoolId = ((await client.query(`insert into schools (name, slug) values ('Alpha HS', 'alpha') returning id`)).rows[0] as { id: string }).id;
  lib = await import('../onboarding-repository');
});

afterAll(async () => {
  await client.close();
});

describe('updateActiveSchoolManagerAccess', () => {
  it('updates scope and primary flag of an active manager', async () => {
    const id = await manager();
    const updated = await lib.updateActiveSchoolManagerAccess(id, { managedGames: ['valorant'], isPrimaryContact: false });
    expect(updated?.id).toBe(id);
    expect(await row(id)).toMatchObject({ managed_games: ['valorant'], is_active: true });
  });

  it('never reactivates a removed manager', async () => {
    const id = await manager({ active: false });
    expect(await lib.updateActiveSchoolManagerAccess(id, { managedGames: null, isPrimaryContact: true })).toBeNull();
    expect(await row(id)).toMatchObject({ is_active: false, is_primary_contact: false });
  });

  it('promoting to primary demotes the others of the same school and year only', async () => {
    const old = await manager({ primary: true });
    const otherYear = await manager({ primary: true, year: '2025-26' });
    const target = await manager();
    await lib.updateActiveSchoolManagerAccess(target, { managedGames: null, isPrimaryContact: true });
    expect((await row(target)).is_primary_contact).toBe(true);
    expect((await row(old)).is_primary_contact).toBe(false);
    expect((await row(otherYear)).is_primary_contact).toBe(true);
  });

  it('a removed manager leaves the current primary contact alone', async () => {
    const primary = await manager({ primary: true, year: '2024-25' });
    const removed = await manager({ active: false, year: '2024-25' });
    await lib.updateActiveSchoolManagerAccess(removed, { managedGames: null, isPrimaryContact: true });
    expect((await row(primary)).is_primary_contact).toBe(true);
  });
});
