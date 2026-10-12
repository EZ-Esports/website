import { describe, it, expect } from 'vitest';
import { deriveThumbnailKey, isThumbnailKeyFor } from '@/app/lib/storage-constants';
import { deriveThumbnailUrl, resolveGalleryThumbnail } from '@/app/lib/gallery-thumbnails';

const ID = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const OTHER = '9a8b7c6d-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const FULL = `gallery/${ID}/1700000000000.jpg`;
const THUMB = `gallery/${ID}/1700000000000_thumb.webp`;
const URL_BASE = 'https://x.supabase.co/storage/v1/object/public/admin-uploads';

describe('deriveThumbnailKey', () => {
  it('places the thumbnail beside the original as <name>_thumb.webp', () => {
    expect(deriveThumbnailKey(FULL)).toBe(THUMB);
    expect(deriveThumbnailKey(`gallery/${ID}/1700000000000.webp`)).toBe(THUMB);
  });

  it('is stable: same input, same key (so retries and backfills are idempotent)', () => {
    expect(deriveThumbnailKey(FULL)).toBe(deriveThumbnailKey(FULL));
  });

  it('only strips the extension of the file name, not a dot in a folder', () => {
    expect(deriveThumbnailKey('gallery/a.b/123')).toBe('gallery/a.b/123_thumb.webp');
  });
});

describe('isThumbnailKeyFor', () => {
  it('accepts exactly the derived key inside the entity folder', () => {
    expect(isThumbnailKeyFor(THUMB, FULL, 'gallery', ID)).toBe(true);
  });

  it.each([
    ['another entity folder', `gallery/${OTHER}/1700000000000_thumb.webp`],
    ['a different timestamp', `gallery/${ID}/1700000000001_thumb.webp`],
    ['the full-size key itself', FULL],
    ['a traversal attempt', `gallery/${ID}/../${OTHER}/1700000000000_thumb.webp`],
    ['an empty key', ''],
    ['null', null],
  ])('rejects %s', (_label, key) => {
    expect(isThumbnailKeyFor(key as string | null, FULL, 'gallery', ID)).toBe(false);
  });

  it('rejects when the original is not scoped to the entity', () => {
    expect(isThumbnailKeyFor(THUMB, `gallery/${OTHER}/1700000000000.jpg`, 'gallery', ID)).toBe(false);
  });
});

describe('resolveGalleryThumbnail', () => {
  const src = `${URL_BASE}/${FULL}`;
  const posted = { rawThumbnailKey: THUMB, rawThumbnailUrl: `${URL_BASE}/${THUMB}` };

  it('accepts a posted thumbnail that matches the validated storage key', () => {
    expect(resolveGalleryThumbnail({ src, entityId: ID, storageKey: FULL, ...posted })).toEqual({
      thumbnailUrl: `${URL_BASE}/${THUMB}`,
      thumbnailStorageKey: THUMB,
    });
  });

  it('drops a thumbnail whose key belongs to another entity or is not derived from the storage key', () => {
    const none = { thumbnailUrl: null, thumbnailStorageKey: null };
    const foreign = `gallery/${OTHER}/1700000000000_thumb.webp`;
    expect(
      resolveGalleryThumbnail({ src, entityId: ID, storageKey: FULL, rawThumbnailKey: foreign, rawThumbnailUrl: `${URL_BASE}/${foreign}` }),
    ).toEqual(none);
  });

  it('drops a thumbnail whose URL does not end in its key', () => {
    expect(
      resolveGalleryThumbnail({
        src,
        entityId: ID,
        storageKey: FULL,
        rawThumbnailKey: THUMB,
        rawThumbnailUrl: 'https://evil.example/other.webp',
      }),
    ).toEqual({ thumbnailUrl: null, thumbnailStorageKey: null });
  });

  it.each([
    ['a foreign host that still ends in the key', `https://evil.example/${THUMB}`],
    ['another bucket on the same host', `https://x.supabase.co/storage/v1/object/public/other-bucket/${THUMB}`],
    ['a different scheme', `http://x.supabase.co/storage/v1/object/public/admin-uploads/${THUMB}`],
    ['a query-string suffix', `${URL_BASE}/${THUMB}?x=1`],
  ])('drops a thumbnail URL on %s', (_label, rawThumbnailUrl) => {
    expect(
      resolveGalleryThumbnail({ src, entityId: ID, storageKey: FULL, rawThumbnailKey: THUMB, rawThumbnailUrl }),
    ).toEqual({ thumbnailUrl: null, thumbnailStorageKey: null });
  });

  it('drops a posted thumbnail when no src is supplied to anchor its origin', () => {
    expect(resolveGalleryThumbnail({ entityId: ID, storageKey: FULL, ...posted })).toEqual({
      thumbnailUrl: null,
      thumbnailStorageKey: null,
    });
  });

  it('has no thumbnail when there is no storage key (image removed or untracked)', () => {
    expect(resolveGalleryThumbnail({ src, entityId: ID, storageKey: null, ...posted })).toEqual({
      thumbnailUrl: null,
      thumbnailStorageKey: null,
    });
  });

  it('keeps the existing thumbnail when the form posts none and the full image is unchanged', () => {
    const existing = { storageKey: FULL, thumbnailUrl: `${URL_BASE}/${THUMB}`, thumbnailStorageKey: THUMB };
    expect(
      resolveGalleryThumbnail({ entityId: ID, storageKey: FULL, rawThumbnailKey: null, rawThumbnailUrl: null, existing }),
    ).toEqual({ thumbnailUrl: `${URL_BASE}/${THUMB}`, thumbnailStorageKey: THUMB });
  });

  it('does not carry an old thumbnail over to a replacement image (e.g. a GIF with none)', () => {
    const existing = { storageKey: FULL, thumbnailUrl: `${URL_BASE}/${THUMB}`, thumbnailStorageKey: THUMB };
    expect(
      resolveGalleryThumbnail({
        entityId: ID,
        storageKey: `gallery/${ID}/1700000009999.gif`,
        rawThumbnailKey: null,
        rawThumbnailUrl: null,
        existing,
      }),
    ).toEqual({ thumbnailUrl: null, thumbnailStorageKey: null });
  });
});

describe('deriveThumbnailUrl', () => {
  it('swaps the key into the src, keeping origin and bucket path', () => {
    expect(deriveThumbnailUrl(`${URL_BASE}/${FULL}`, FULL, THUMB)).toBe(`${URL_BASE}/${THUMB}`);
  });

  it('returns null when src is not the object at the storage key, or not a URL', () => {
    expect(deriveThumbnailUrl(`${URL_BASE}/gallery/${ID}/other.jpg`, FULL, THUMB)).toBeNull();
    expect(deriveThumbnailUrl('not a url', FULL, THUMB)).toBeNull();
  });
});
