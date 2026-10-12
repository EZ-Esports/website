import { describe, it, expect } from 'vitest';
import {
  BUCKET,
  buildPublicObjectUrl,
  deriveLegacyThumbnailKey,
  isKeyScopedToEntity,
  isLegacyThumbnailKey,
} from '@/app/lib/storage-constants';
import { resolveGalleryThumbnail } from '@/app/lib/gallery-thumbnails';

const ID = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const OTHER = '9a8b7c6d-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const PROJECT = 'https://abc.supabase.co';
const PUB = `${PROJECT}/storage/v1/object/public/${BUCKET}`;
const NONE = { thumbnailUrl: null, thumbnailStorageKey: null };

describe('deriveLegacyThumbnailKey', () => {
  it.each([
    ['2c07ef71-aaaa.jpg', `gallery/${ID}/2c07ef71-aaaa_thumb.webp`],
    ['Photo.JPG', `gallery/${ID}/Photo_thumb.webp`],
    ['archive.tar.gz', `gallery/${ID}/archive-tar_thumb.webp`],
    ['a.b.c.png', `gallery/${ID}/a-b-c_thumb.webp`],
    ['noext', `gallery/${ID}/noext_thumb.webp`],
    ['.hidden', `gallery/${ID}/hidden_thumb.webp`],
    ['my photo (1).png', `gallery/${ID}/my-photo-1_thumb.webp`],
    ['café-日本.jpg', `gallery/${ID}/caf_thumb.webp`],
    ['日本.jpg', `gallery/${ID}/image_thumb.webp`],
    ['dir/sub/leaf.webp', `gallery/${ID}/leaf_thumb.webp`],
    ['x_thumb.webp', `gallery/${ID}/x_thumb_thumb.webp`],
  ])('%j -> %s', (name, expected) => {
    expect(deriveLegacyThumbnailKey(ID, name)).toBe(expected);
  });

  it('truncates very long names and still ends in a single _thumb.webp', () => {
    const key = deriveLegacyThumbnailKey(ID, `${'a'.repeat(500)}.jpg`);
    expect(key).toBe(`gallery/${ID}/${'a'.repeat(80)}_thumb.webp`);
  });

  it('is deterministic and different rows never share a key', () => {
    expect(deriveLegacyThumbnailKey(ID, 'a.jpg')).toBe(deriveLegacyThumbnailKey(ID, 'a.jpg'));
    expect(deriveLegacyThumbnailKey(ID, 'a.jpg')).not.toBe(deriveLegacyThumbnailKey(OTHER, 'a.jpg'));
  });

  it('always yields a key scoped to the row folder that the validator recognises', () => {
    const hostile = ['a.jpg', '../../x.png', 'a\\b.png', '\u0000.png', '%00.png', '%2e%2e%2fa.png', 'a?b#c.png', 'A B.GIF', '.', '..', '..png', ''];
    for (const name of hostile) {
      const key = deriveLegacyThumbnailKey(ID, name);
      expect(isKeyScopedToEntity(key, 'gallery', ID)).toBe(true);
      expect(isLegacyThumbnailKey(key, ID)).toBe(true);
      expect(key.endsWith('_thumb.webp')).toBe(true);
    }
  });

  it('refuses an unsafe row id', () => {
    expect(() => deriveLegacyThumbnailKey('../x', 'a.jpg')).toThrow();
  });
});

describe('isLegacyThumbnailKey', () => {
  it.each([
    `gallery/${OTHER}/a_thumb.webp`,
    `gallery/${ID}/a.webp`,
    `gallery/${ID}/a_thumb.png`,
    `gallery/${ID}/a_thumb.webp?x=1`,
    `gallery/${ID}/a_thumb.webp#f`,
    `gallery/${ID}/..%2fa_thumb.webp`,
    `gallery/${ID}/../${OTHER}/a_thumb.webp`,
    `gallery/${ID}/sub/a_thumb.webp`,
    `gallery/${ID}/a\\b_thumb.webp`,
    `gallery/${ID}/a b_thumb.webp`,
    `gallery/${ID}/`,
    `schools/${ID}/a_thumb.webp`,
    'a_thumb.webp',
    '',
    null,
  ])('rejects %j', (key) => {
    expect(isLegacyThumbnailKey(key as string | null, ID)).toBe(false);
  });
});

describe('buildPublicObjectUrl', () => {
  it('builds the getPublicUrl form from the project origin', () => {
    expect(buildPublicObjectUrl(PROJECT, BUCKET, `gallery/${ID}/a_thumb.webp`)).toBe(`${PUB}/gallery/${ID}/a_thumb.webp`);
    expect(buildPublicObjectUrl(`${PROJECT}/some/path/`, BUCKET, 'k.webp')).toBe(`${PUB}/k.webp`);
  });

  it('returns null for a missing, unparseable or non-http project URL', () => {
    expect(buildPublicObjectUrl(undefined, BUCKET, 'k')).toBeNull();
    expect(buildPublicObjectUrl('', BUCKET, 'k')).toBeNull();
    expect(buildPublicObjectUrl('not a url', BUCKET, 'k')).toBeNull();
    expect(buildPublicObjectUrl('javascript:alert(1)', BUCKET, 'k')).toBeNull();
  });
});

describe('resolveGalleryThumbnail: legacy (root-level or static original)', () => {
  const key = deriveLegacyThumbnailKey(ID, '2c07ef71-aaaa.jpg');
  const url = `${PUB}/${key}`;
  const rootSrc = `${PUB}/2c07ef71-aaaa.jpg`;
  const existing = (over = {}) => ({ src: rootSrc, storageKey: null, thumbnailUrl: url, thumbnailStorageKey: key, ...over });
  const base = { entityId: ID, storageKey: null, rawThumbnailKey: null, rawThumbnailUrl: null, supabaseUrl: PROJECT };

  it('preserves the thumbnail on a caption-only edit of a root-level row', () => {
    expect(resolveGalleryThumbnail({ ...base, src: rootSrc, existing: existing() })).toEqual({
      thumbnailUrl: url,
      thumbnailStorageKey: key,
    });
  });

  it('also preserves it when the stored storage key was the root-level one', () => {
    expect(
      resolveGalleryThumbnail({ ...base, src: rootSrc, existing: existing({ storageKey: '2c07ef71-aaaa.jpg' }) }),
    ).toEqual({ thumbnailUrl: url, thumbnailStorageKey: key });
  });

  it('preserves a local-static row thumbnail, validated against the configured project', () => {
    const skey = deriveLegacyThumbnailKey(ID, 'gallery-3.png');
    const ex = existing({ src: '/images/gallery/gallery-3.png', thumbnailUrl: `${PUB}/${skey}`, thumbnailStorageKey: skey });
    expect(resolveGalleryThumbnail({ ...base, src: '/images/gallery/gallery-3.png', existing: ex })).toEqual({
      thumbnailUrl: `${PUB}/${skey}`,
      thumbnailStorageKey: skey,
    });
    // Without a configured project there is nothing to validate a relative src against.
    expect(resolveGalleryThumbnail({ ...base, supabaseUrl: '', src: '/images/gallery/gallery-3.png', existing: ex })).toEqual(NONE);
  });

  it('does not inherit the old thumbnail when the image is replaced', () => {
    const newKey = `gallery/${ID}/1700000009999.jpg`;
    // New upload with no thumbnail of its own (e.g. a GIF): nothing carried over.
    expect(
      resolveGalleryThumbnail({ ...base, storageKey: newKey, src: `${PUB}/${newKey}`, existing: existing() }),
    ).toEqual(NONE);
    // Image swapped without an own-folder key: nothing carried over either.
    expect(resolveGalleryThumbnail({ ...base, src: `${PUB}/other.jpg`, existing: existing() })).toEqual(NONE);
    expect(resolveGalleryThumbnail({ ...base, src: '/images/gallery/gallery-4.png', existing: existing() })).toEqual(NONE);
  });

  it('never accepts posted fields for a legacy row', () => {
    const forged = `gallery/${ID}/evil_thumb.webp`;
    expect(
      resolveGalleryThumbnail({
        ...base,
        src: rootSrc,
        rawThumbnailKey: forged,
        rawThumbnailUrl: `${PUB}/${forged}`,
        existing: existing({ thumbnailUrl: null, thumbnailStorageKey: null }),
      }),
    ).toEqual(NONE);
  });

  it.each([
    ['a foreign host', { thumbnailUrl: `https://evil.example/storage/v1/object/public/${BUCKET}/${key}` }],
    ['another bucket', { thumbnailUrl: `${PROJECT}/storage/v1/object/public/other/${key}` }],
    ['a query string', { thumbnailUrl: `${url}?x=1` }],
    ['http scheme', { thumbnailUrl: url.replace('https', 'http') }],
    ['another row folder', { thumbnailStorageKey: `gallery/${OTHER}/a_thumb.webp`, thumbnailUrl: `${PUB}/gallery/${OTHER}/a_thumb.webp` }],
    ['a traversal key', { thumbnailStorageKey: `gallery/${ID}/../x_thumb.webp`, thumbnailUrl: `${PUB}/gallery/${ID}/../x_thumb.webp` }],
    ['a wrong suffix', { thumbnailStorageKey: `gallery/${ID}/a.webp`, thumbnailUrl: `${PUB}/gallery/${ID}/a.webp` }],
    ['a nested key', { thumbnailStorageKey: `gallery/${ID}/x/a_thumb.webp`, thumbnailUrl: `${PUB}/gallery/${ID}/x/a_thumb.webp` }],
  ])('drops a stored thumbnail with %s', (_label, over) => {
    expect(resolveGalleryThumbnail({ ...base, src: rootSrc, existing: existing(over) })).toEqual(NONE);
  });

  it('accepts a stored URL on the src origin when the configured project differs', () => {
    expect(
      resolveGalleryThumbnail({ ...base, supabaseUrl: 'https://other.supabase.co', src: rootSrc, existing: existing() }),
    ).toEqual({ thumbnailUrl: url, thumbnailStorageKey: key });
  });

  it('leaves own-folder rows exactly as before', () => {
    const full = `gallery/${ID}/1700000000000.jpg`;
    const thumb = `gallery/${ID}/1700000000000_thumb.webp`;
    expect(
      resolveGalleryThumbnail({
        entityId: ID,
        src: `${PUB}/${full}`,
        storageKey: full,
        rawThumbnailKey: thumb,
        rawThumbnailUrl: `${PUB}/${thumb}`,
      }),
    ).toEqual({ thumbnailUrl: `${PUB}/${thumb}`, thumbnailStorageKey: thumb });
  });
});
