import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The module under test talks to the database only through this object.
const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
}));
vi.mock('../index', () => ({ db: dbMock }));

import {
  getContentFlagsByMember,
  insertContentFlag,
  isMissingContentFlagsError,
  markContentFlagReviewed,
  toStoredFields,
} from '../content-flags';
import { onboardingContentFlags } from '../schema';

const pgError = (message: string, code: string) => Object.assign(new Error(message), { code });
const wrapped = (cause: unknown) => Object.assign(new Error('Failed query'), { cause });
const missingTable = () => pgError('relation "onboarding_content_flags" does not exist', '42P01');

const field = {
  field: 'riotId' as const,
  label: 'Riot ID',
  value: 'ShitLord#NA1',
  matches: [
    { term: 'shit', language: 'english' },
    { term: 'shit', language: 'english' },
  ],
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  dbMock.select.mockReset();
  dbMock.update.mockReset();
});

describe('isMissingContentFlagsError', () => {
  it('matches undefined table/column errors that name the table, also through a Drizzle wrapper', () => {
    expect(isMissingContentFlagsError(missingTable())).toBe(true);
    expect(isMissingContentFlagsError(wrapped(missingTable()))).toBe(true);
    expect(isMissingContentFlagsError(pgError('column "reviewed_at" of relation "onboarding_content_flags" does not exist', '42703'))).toBe(true);
  });

  it('does not match other tables or other error codes', () => {
    expect(isMissingContentFlagsError(pgError('relation "members" does not exist', '42P01'))).toBe(false);
    expect(isMissingContentFlagsError(pgError('deadlock detected on onboarding_content_flags', '40P01'))).toBe(false);
    expect(isMissingContentFlagsError(new Error('onboarding_content_flags'))).toBe(false);
    expect(isMissingContentFlagsError(null)).toBe(false);
  });
});

describe('toStoredFields', () => {
  it('stores each field once with de-duplicated terms and languages', () => {
    expect(toStoredFields([field])).toEqual([
      { field: 'riotId', label: 'Riot ID', value: 'ShitLord#NA1', matchedTerms: ['shit'], languages: ['english'] },
    ]);
  });
});

describe('insertContentFlag', () => {
  const input = { memberId: 'm1', schoolId: 's1', inviteKind: 'player' as const, inviteId: 'i1', fields: [field] };

  it('writes inside a savepoint and reports success', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const savepoint = { insert: vi.fn().mockReturnValue({ values }) };
    const tx = { transaction: vi.fn(async (cb: (s: unknown) => Promise<void>) => cb(savepoint)) };
    await expect(insertContentFlag(tx as never, input)).resolves.toBe(true);
    expect(savepoint.insert).toHaveBeenCalledWith(onboardingContentFlags);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ memberId: 'm1', inviteKind: 'player', inviteId: 'i1' }));
  });

  it('does nothing when there are no fields', async () => {
    const tx = { transaction: vi.fn() };
    await expect(insertContentFlag(tx as never, { ...input, fields: [] })).resolves.toBe(true);
    expect(tx.transaction).not.toHaveBeenCalled();
  });

  it('degrades with a warning when the table is missing', async () => {
    const tx = { transaction: vi.fn().mockRejectedValue(wrapped(missingTable())) };
    await expect(insertContentFlag(tx as never, input)).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('0055'));
  });

  it('rethrows every other error', async () => {
    const tx = { transaction: vi.fn().mockRejectedValue(pgError('connection reset', '08006')) };
    await expect(insertContentFlag(tx as never, input)).rejects.toThrow('connection reset');
  });
});

describe('getContentFlagsByMember', () => {
  const row = (over: Record<string, unknown>) => ({
    id: 'f1',
    memberId: 'm1',
    schoolId: 's1',
    inviteKind: 'player',
    inviteId: 'i1',
    flaggedFields: [{ field: 'riotId', label: 'Riot ID', value: 'x', matchedTerms: ['shit'], languages: ['english'] }],
    createdAt: new Date('2026-10-28T12:00:00Z'),
    reviewedAt: null,
    reviewedBy: null,
    ...over,
  });
  const selecting = (result: Promise<unknown>) =>
    dbMock.select.mockReturnValue({ from: () => ({ where: () => ({ orderBy: () => result }) }) });

  it('returns an empty map without touching the database for no members', async () => {
    expect((await getContentFlagsByMember([])).size).toBe(0);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('maps rows by member, preferring an unreviewed record over a newer reviewed one', async () => {
    selecting(
      Promise.resolve([
        row({ id: 'new-reviewed', reviewedAt: new Date('2026-10-29T00:00:00Z'), reviewedBy: 'staff@x.org' }),
        row({ id: 'old-open', createdAt: new Date('2026-10-01T00:00:00Z') }),
        row({ id: 'other', memberId: 'm2' }),
      ])
    );
    const map = await getContentFlagsByMember(['m1', 'm2']);
    expect(map.get('m1')?.id).toBe('old-open');
    expect(map.get('m2')?.createdAt).toBe('2026-10-28T12:00:00.000Z');
  });

  it('returns nothing, and does not throw, when the table is missing', async () => {
    selecting(Promise.reject(wrapped(missingTable())));
    const map = await getContentFlagsByMember(['m1']);
    expect(map.size).toBe(0);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('0055'));
  });

  it('rethrows unrelated errors', async () => {
    selecting(Promise.reject(pgError('boom', '08006')));
    await expect(getContentFlagsByMember(['m1'])).rejects.toThrow('boom');
  });
});

describe('markContentFlagReviewed', () => {
  const updating = (result: Promise<unknown>) =>
    dbMock.update.mockReturnValue({ set: () => ({ where: () => ({ returning: () => result }) }) });

  it('reports whether a record was updated', async () => {
    updating(Promise.resolve([{ id: 'f1' }]));
    await expect(markContentFlagReviewed('f1', 'staff@x.org')).resolves.toBe(true);
    updating(Promise.resolve([]));
    await expect(markContentFlagReviewed('nope', 'staff@x.org')).resolves.toBe(false);
  });

  it('returns false instead of throwing when the table is missing', async () => {
    updating(Promise.reject(missingTable()));
    await expect(markContentFlagReviewed('f1', 'staff@x.org')).resolves.toBe(false);
  });
});
