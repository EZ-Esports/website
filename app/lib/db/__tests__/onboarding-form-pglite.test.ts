/**
 * Runs the real SQL of db/onboarding-form.ts and migration 0057 against an in-memory PGlite built
 * from db/migrations/*.sql. No other database is touched.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../schema';
import { applyMigrations } from '../../../../db/__tests__/helpers/pglite-migrations';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../index', () => ({
  db: new Proxy({}, { get: (_t, key) => (holder.db as Record<string | symbol, unknown>)[key] }),
}));

import {
  countFormCompletions,
  deleteFormCompletionsForInvites,
  findInviteStateById,
  hasFormCompletion,
  linkFormCompletionToMember,
  readOnboardingFormSettingRows,
  recordFormCompletion,
  writeOnboardingFormSettingRows,
} from '../onboarding-form';

let client: PGlite;
const USER = '00000000-0000-4000-8000-000000000001';
const INVITE_A = '00000000-0000-4000-8000-0000000000a1';
const INVITE_B = '00000000-0000-4000-8000-0000000000b1';
let schoolId: string;
let gameId: string;
let playerInviteId: string;

const one = async <T = { id: string }>(text: string, params: unknown[] = []) =>
  (await client.query(text, params)).rows[0] as T;

beforeAll(async () => {
  client = new PGlite();
  const report = await applyMigrations(client);
  expect(report.skipped.filter((s) => /create table|drop table/i.test(s.statement))).toEqual([]);
  holder.db = drizzle(client, { schema });
  schoolId = (await one(`insert into schools (name, slug) values ('Alpha HS', 'alpha') returning id`)).id;
  gameId = (await one(`insert into games (slug, display_name, short_name) values ('val', 'Valorant', 'VAL') returning id`)).id;
  playerInviteId = (
    await one(
      `insert into player_invites (school_id, game_id, token_hash, intended_first_name, intended_last_name, invited_by_user_id, status, expires_at)
       values ($1, $2, 'h1', 'A', 'B', $3, 'pending', now() + interval '7 days') returning id`,
      [schoolId, gameId, USER]
    )
  ).id;
});
afterAll(async () => {
  await client.close();
});

describe('migration 0057', () => {
  it('creates onboarding_form_completions and drops student_demographics', async () => {
    const tables = (
      await client.query(`select table_name from information_schema.tables where table_schema = 'public'`)
    ).rows.map((r) => (r as { table_name: string }).table_name);
    expect(tables).toContain('onboarding_form_completions');
    expect(tables).not.toContain('student_demographics');
  });

  it('enforces the invite kind, the source and one completion per invite at the database level', async () => {
    await expect(
      client.query(`insert into onboarding_form_completions (invite_kind, invite_id) values ('admin', $1)`, [INVITE_A])
    ).rejects.toThrow();
    await expect(
      client.query(`insert into onboarding_form_completions (invite_kind, invite_id, source) values ('player', $1, 'typed')`, [INVITE_A])
    ).rejects.toThrow();
    await client.query(`insert into onboarding_form_completions (invite_kind, invite_id, source) values ('player', $1, 'manual')`, [INVITE_A]);
    await expect(
      client.query(`insert into onboarding_form_completions (invite_kind, invite_id) values ('player', $1)`, [INVITE_A])
    ).rejects.toThrow();
    // The same id under the other kind is a different invite.
    await client.query(`insert into onboarding_form_completions (invite_kind, invite_id) values ('manager', $1)`, [INVITE_A]);
    await client.query(`delete from onboarding_form_completions`);
  });
});

describe('completions', () => {
  it('records once per invite and reports whether this call created the row', async () => {
    expect(await hasFormCompletion('player', INVITE_B)).toBe(false);
    expect(await recordFormCompletion('player', INVITE_B)).toBe(true);
    expect(await recordFormCompletion('player', INVITE_B)).toBe(false);
    expect(await hasFormCompletion('player', INVITE_B)).toBe(true);
    expect(await hasFormCompletion('manager', INVITE_B)).toBe(false);
    expect(await countFormCompletions()).toBe(1);
    const row = await one<{ source: string; member_id: string | null }>(
      `select source, member_id from onboarding_form_completions where invite_id = $1`,
      [INVITE_B]
    );
    expect(row).toEqual({ source: 'google_form', member_id: null });
  });

  it('ties a completion to a member, and deleting the member removes it', async () => {
    const member = (await one(`insert into members (first_name, last_name, email, school_id) values ('A', 'B', 'a@b.org', $1) returning id`, [schoolId])).id;
    await recordFormCompletion('player', playerInviteId);
    const db = holder.db as Parameters<typeof linkFormCompletionToMember>[0] & { transaction: (cb: (tx: never) => Promise<void>) => Promise<void> };
    await db.transaction((tx) => linkFormCompletionToMember(tx as never, 'player', playerInviteId, member));
    expect((await one<{ member_id: string }>(`select member_id from onboarding_form_completions where invite_id = $1`, [playerInviteId])).member_id).toBe(member);
    await client.query(`delete from members where id = $1`, [member]);
    expect(await hasFormCompletion('player', playerInviteId)).toBe(false);
  });

  it('deletes completions for the invites given and for no others', async () => {
    await recordFormCompletion('player', playerInviteId);
    expect(await deleteFormCompletionsForInvites('player', [])).toBe(0);
    expect(await deleteFormCompletionsForInvites('manager', [playerInviteId])).toBe(0);
    expect(await deleteFormCompletionsForInvites('player', [playerInviteId])).toBe(1);
    expect(await hasFormCompletion('player', INVITE_B)).toBe(true);
  });
});

describe('findInviteStateById', () => {
  it('returns status and expiry for a player invite, and nothing for an unknown or wrong-kind id', async () => {
    const state = await findInviteStateById('player', playerInviteId);
    expect(state?.status).toBe('pending');
    expect(state?.expiresAt).toBeInstanceOf(Date);
    expect(await findInviteStateById('player', INVITE_A)).toBeUndefined();
    expect(await findInviteStateById('manager', playerInviteId)).toBeUndefined();
  });
});

describe('settings rows', () => {
  it('upserts both rows and reads them back, and clears them with empty strings', async () => {
    expect(await readOnboardingFormSettingRows()).toEqual({ url: '', entryId: '' });
    await writeOnboardingFormSettingRows({ url: 'https://docs.google.com/forms/d/e/abc/viewform', entryId: '123456' });
    await writeOnboardingFormSettingRows({ url: 'https://docs.google.com/forms/d/e/xyz/viewform', entryId: '654321' });
    expect(await readOnboardingFormSettingRows()).toEqual({
      url: 'https://docs.google.com/forms/d/e/xyz/viewform',
      entryId: '654321',
    });
    await writeOnboardingFormSettingRows({ url: '', entryId: '' });
    expect(await readOnboardingFormSettingRows()).toEqual({ url: '', entryId: '' });
    const rows = (await client.query(`select count(*)::int as n from page_content where key like 'onboarding_form_%'`)).rows[0] as { n: number };
    expect(rows.n).toBe(2);
  });
});
