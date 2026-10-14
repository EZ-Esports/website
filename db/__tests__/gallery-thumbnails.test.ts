import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { isKeyScopedToEntity } from '@/app/lib/storage-constants';
import {
  BACKFILL_ALLOW_ENV,
  assertBackfillTargetAllowed,
  classifyRowUpdate,
  describeTodo,
  parseBackfillArgs,
  parseStaticGalleryPath,
  planBackfill,
  resolveStaticGalleryFile,
  storageHost,
  summarizePlan,
  type BackfillRow,
} from '../gallery-thumbnails';

const ID1 = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const ID2 = '9a8b7c6d-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

const row = (over: Partial<BackfillRow> & { id: string }): BackfillRow => ({
  src: 'https://x.supabase.co/storage/v1/object/public/admin-uploads/anything.jpg',
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
      {
        kind: 'gallery-folder',
        id: ID1,
        src: expect.any(String),
        storageKey: `gallery/${ID1}/1700000000000.webp`,
        thumbnailKey: `gallery/${ID1}/1700000000000_thumb.webp`,
      },
    ]);
    expect(plan.skipped).toEqual([]);
  });

  it('skips deleted rows, finished rows, animated GIFs and unsupported sources with truthful reasons', () => {
    const plan = planBackfill([
      row({ id: 'd', storageKey: 'gallery/d/1.webp', deletedAt: new Date() }),
      row({
        id: ID1,
        storageKey: `gallery/${ID1}/1.webp`,
        thumbnailUrl: 'https://x/t.webp',
        thumbnailStorageKey: `gallery/${ID1}/1_thumb.webp`,
      }),
      row({ id: ID2, storageKey: null, src: 'https://cdn.example.com/a.png' }),
      row({ id: ID2, storageKey: `gallery/${ID1}/foreign.webp` }),
      row({ id: ID2, storageKey: `gallery/${ID2}/1.GIF` }),
    ]);
    expect(plan.todo).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual([
      'deleted',
      'already-has-thumbnail',
      'unsupported-source',
      'unsupported-source',
      'animated-format',
    ]);
  });

  describe('classification', () => {
    const NAME = '2c07ef71-1111-4222-8333-444455556666.jpg';
    const cases: [string, Partial<BackfillRow>, string, string | null][] = [
      ['own-folder key', { storageKey: `gallery/${ID1}/1700.jpg` }, 'gallery-folder', `gallery/${ID1}/1700_thumb.webp`],
      [
        'root-level legacy key',
        { storageKey: NAME },
        'legacy-root-key',
        `gallery/${ID1}/2c07ef71-1111-4222-8333-444455556666_thumb.webp`,
      ],
      ['root-level uppercase ext', { storageKey: 'Photo.JPG' }, 'legacy-root-key', `gallery/${ID1}/Photo_thumb.webp`],
      ['static png path', { src: '/images/gallery/gallery-3.png' }, 'local-static', `gallery/${ID1}/gallery-3_thumb.webp`],
      ['static jpg path', { src: '/images/gallery/a.JPG' }, 'local-static', `gallery/${ID1}/a_thumb.webp`],
      ['another entity folder key', { storageKey: `gallery/${ID2}/1.jpg` }, 'skip:unsupported-source', null],
      ['other section key', { storageKey: `schools/${ID1}/1.jpg` }, 'skip:unsupported-source', null],
      ['traversal key', { storageKey: `../${NAME}` }, 'skip:unsupported-source', null],
      ['backslash key', { storageKey: 'a\\b.jpg' }, 'skip:unsupported-source', null],
      ['double-dot key', { storageKey: 'a..b.jpg' }, 'skip:unsupported-source', null],
      ['root-level gif', { storageKey: 'anim.gif' }, 'skip:animated-format', null],
      ['static gif', { src: '/images/gallery/anim.gif' }, 'skip:animated-format', null],
      ['static traversal', { src: '/images/gallery/../../.env' }, 'skip:unsupported-source', null],
      ['static other directory', { src: '/images/games/a.png' }, 'skip:unsupported-source', null],
      ['no key, foreign url', { src: 'https://cdn.example.com/a.png' }, 'skip:unsupported-source', null],
      ['no key, empty src', { src: '' }, 'skip:unsupported-source', null],
    ];

    it.each(cases)('%s', (_label, over, expected, thumbKey) => {
      const plan = planBackfill([row({ id: ID1, ...over })]);
      if (expected.startsWith('skip:')) {
        expect(plan.todo).toEqual([]);
        expect(plan.skipped).toEqual([{ id: ID1, reason: expected.slice(5) }]);
      } else {
        expect(plan.skipped).toEqual([]);
        expect(plan.todo).toHaveLength(1);
        expect(plan.todo[0]).toMatchObject({ id: ID1, kind: expected, thumbnailKey: thumbKey });
      }
    });

    it('never derives a thumbnail key outside the row folder, and local rows keep a null storage key', () => {
      const plan = planBackfill([
        row({ id: ID1, storageKey: NAME }),
        row({ id: ID2, src: '/images/gallery/gallery-1.png' }),
      ]);
      for (const t of plan.todo) {
        expect(isKeyScopedToEntity(t.thumbnailKey, 'gallery', t.id)).toBe(true);
      }
      expect(plan.todo[1]).toMatchObject({ kind: 'local-static', storageKey: null, fileName: 'gallery-1.png' });
    });

    it('skips a row whose id is not a safe entity id', () => {
      expect(planBackfill([row({ id: '../x', storageKey: NAME })]).skipped).toEqual([
        { id: '../x', reason: 'unsupported-source' },
      ]);
    });
  });

  it('describes work and summarises by kind and reason', () => {
    const plan = planBackfill([
      row({ id: ID1, storageKey: `gallery/${ID1}/1.jpg` }),
      row({ id: ID2, storageKey: 'legacy.jpg' }),
      row({ id: 'c', src: '/images/gallery/gallery-2.png' }),
      row({ id: 'd', storageKey: 'x.jpg', deletedAt: new Date() }),
      row({ id: 'e', src: 'https://cdn.example.com/a.png' }),
    ]);
    expect(plan.todo.map(describeTodo)).toEqual([
      `would create gallery/${ID1}/1_thumb.webp from bucket object gallery/${ID1}/1.jpg [gallery-folder] (row ${ID1})`,
      `would create gallery/${ID2}/legacy_thumb.webp from bucket object legacy.jpg [legacy-root-key] (row ${ID2})`,
      'would create gallery/c/gallery-2_thumb.webp from local file public/images/gallery/gallery-2.png [local-static] (row c)',
    ]);
    expect(summarizePlan(plan, 5)).toEqual([
      'Summary (5 rows):',
      '  gallery-folder   1',
      '  legacy-root-key  1',
      '  local-static     1',
      '  skipped deleted                1',
      '  skipped already-has-thumbnail  0',
      '  skipped animated-format        0',
      '  skipped unsupported-source     1',
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

describe('parseStaticGalleryPath', () => {
  it.each([
    ['/images/gallery/gallery-3.png', 'gallery-3.png'],
    ['/images/gallery/Team.v2.JPG', 'Team.v2.JPG'],
  ])('accepts %s', (src, name) => {
    expect(parseStaticGalleryPath(src)).toBe(name);
  });

  it.each([
    '/images/gallery/../../.env',
    '/images/gallery/..%2f..%2f.env',
    '/images/gallery/%2e%2e/secret.png',
    '/images/gallery/%2E%2E%5Cx.png',
    '/images/gallery/sub/a.png',
    '/images/gallery/a\\b.png',
    '/images/gallery/..\\x.png',
    '/images/gallery/.hidden.png',
    '/images/gallery/a.png?x=1',
    '/images/gallery/a.png#f',
    '/images/gallery/a.svg',
    '/images/gallery/.env',
    '/images/gallery/a.txt',
    '/images/gallery/',
    '/images/gallery',
    '/images/games/a.png',
    '/public/images/gallery/a.png',
    'images/gallery/a.png',
    '//images/gallery/a.png',
    'https://x.supabase.co/images/gallery/a.png',
    'C:\\images\\gallery\\a.png',
    '/images/gallery/a.png\u0000.txt',
    '',
    null,
    undefined,
  ])('rejects %j', (src) => {
    expect(parseStaticGalleryPath(src as string | null | undefined)).toBeNull();
  });
});

describe('resolveStaticGalleryFile', () => {
  const root = resolve('/repo');

  it('resolves inside public/images/gallery', () => {
    expect(resolveStaticGalleryFile(root, '/images/gallery/gallery-1.png')).toBe(
      resolve(root, 'public', 'images', 'gallery', 'gallery-1.png'),
    );
  });

  it('throws for anything the path guard rejects', () => {
    expect(() => resolveStaticGalleryFile(root, '/images/gallery/../../.env')).toThrow();
    expect(() => resolveStaticGalleryFile(root, '/etc/passwd')).toThrow();
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
