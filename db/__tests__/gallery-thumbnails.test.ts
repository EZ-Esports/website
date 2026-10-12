import { describe, it, expect } from 'vitest';
import {
  BACKFILL_ALLOW_ENV,
  assertBackfillTargetAllowed,
  classifyRowUpdate,
  parseBackfillArgs,
  planBackfill,
  storageHost,
  type BackfillRow,
} from '../gallery-thumbnails';

const ID1 = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const ID2 = '9a8b7c6d-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

const row = (over: Partial<BackfillRow> & { id: string }): BackfillRow => ({
  storageKey: null,
  thumbnailUrl: null,
  thumbnailStorageKey: null,
  deletedAt: null,
  ...over,
});

describe('planBackfill', () => {
  it('queues rows with an own-folder storage key and no thumbnail, deriving the thumbnail key', () => {
    const plan = planBackfill([row({ id: ID1, storageKey: `gallery/${ID1}/1700000000000.webp` })]);
    expect(plan.todo).toEqual([
      { id: ID1, storageKey: `gallery/${ID1}/1700000000000.webp`, thumbnailKey: `gallery/${ID1}/1700000000000_thumb.webp` },
    ]);
    expect(plan.skipped).toEqual([]);
  });

  it('skips deleted rows, rows that already have a thumbnail, untracked rows and GIFs', () => {
    const plan = planBackfill([
      row({ id: 'd', storageKey: `gallery/d/1.webp`, deletedAt: new Date() }),
      row({ id: ID1, storageKey: `gallery/${ID1}/1.webp`, thumbnailUrl: 'https://x/t.webp', thumbnailStorageKey: `gallery/${ID1}/1_thumb.webp` }),
      row({ id: 'static', storageKey: null }),
      row({ id: ID2, storageKey: `gallery/${ID1}/foreign.webp` }),
      row({ id: 'gif', storageKey: `gallery/gif/1.GIF` }),
    ]);
    expect(plan.todo).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual([
      'deleted',
      'already-has-thumbnail',
      'no-storage-key',
      'no-storage-key',
      'animated-format',
    ]);
  });

  it('is resumable: after a partial run only the remaining rows are planned', () => {
    const before = [
      row({ id: ID1, storageKey: `gallery/${ID1}/1.webp` }),
      row({ id: ID2, storageKey: `gallery/${ID2}/2.webp` }),
    ];
    expect(planBackfill(before).todo).toHaveLength(2);
    const after = [
      { ...before[0], thumbnailUrl: 'https://x/t.webp', thumbnailStorageKey: `gallery/${ID1}/1_thumb.webp` },
      before[1],
    ];
    expect(planBackfill(after).todo.map((t) => t.id)).toEqual([ID2]);
  });
});

describe('assertBackfillTargetAllowed', () => {
  const url = 'https://abcdefgh.supabase.co';

  it('extracts the storage host', () => {
    expect(storageHost(url)).toBe('abcdefgh.supabase.co');
    expect(storageHost('not a url')).toBeUndefined();
    expect(storageHost(undefined)).toBeUndefined();
  });

  it('refuses when the opt-in is unset', () => {
    expect(() => assertBackfillTargetAllowed(url, {})).toThrow(BACKFILL_ALLOW_ENV);
  });

  it('refuses a blanket value or a different host', () => {
    expect(() => assertBackfillTargetAllowed(url, { [BACKFILL_ALLOW_ENV]: '1' })).toThrow();
    expect(() => assertBackfillTargetAllowed(url, { [BACKFILL_ALLOW_ENV]: 'other.supabase.co' })).toThrow();
  });

  it('allows only the exact named host', () => {
    expect(assertBackfillTargetAllowed(url, { [BACKFILL_ALLOW_ENV]: 'abcdefgh.supabase.co' })).toBe('abcdefgh.supabase.co');
  });

  it('refuses when the Supabase URL is missing (fails closed)', () => {
    expect(() => assertBackfillTargetAllowed(undefined, { [BACKFILL_ALLOW_ENV]: 'x' })).toThrow();
  });
});

describe('parseBackfillArgs', () => {
  it('is a dry run unless --apply is passed', () => {
    expect(parseBackfillArgs(['--bucket=admin-uploads'], 'admin-uploads').apply).toBe(false);
    expect(parseBackfillArgs(['--bucket=admin-uploads', '--apply'], 'admin-uploads').apply).toBe(true);
  });

  it('requires an explicit, matching --bucket', () => {
    expect(() => parseBackfillArgs([], 'admin-uploads')).toThrow('--bucket');
    expect(() => parseBackfillArgs(['--apply'], 'admin-uploads')).toThrow('--bucket');
    expect(() => parseBackfillArgs(['--bucket=other'], 'admin-uploads')).toThrow('does not match');
  });

  it('parses --limit and --preview-dir, validating the limit', () => {
    const args = parseBackfillArgs(['--bucket=admin-uploads', '--limit=5', '--preview-dir=db/thumbnail-previews'], 'admin-uploads');
    expect(args.limit).toBe(5);
    expect(args.previewDir).toBe('db/thumbnail-previews');
    expect(() => parseBackfillArgs(['--bucket=admin-uploads', '--limit=0'], 'admin-uploads')).toThrow('--limit');
    expect(() => parseBackfillArgs(['--bucket=admin-uploads', '--limit=abc'], 'admin-uploads')).toThrow('--limit');
  });
});

describe('classifyRowUpdate', () => {
  it('counts a matched row as written', () => {
    expect(classifyRowUpdate(1)).toBe('written');
  });

  it('reports a 0-row update as a conflict instead of done', () => {
    expect(classifyRowUpdate(0)).toBe('conflict');
  });
});
