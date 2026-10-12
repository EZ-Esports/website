import { describe, it, expect, vi, afterEach } from 'vitest';
import { isMissingThumbnailColumnError, withThumbnailColumnFallback } from '../thumbnail-columns';

const pgError = (message: string, code = '42703') => Object.assign(new Error(message), { code });
const wrapped = (cause: unknown) => Object.assign(new Error('Failed query'), { cause });

afterEach(() => vi.restoreAllMocks());

describe('isMissingThumbnailColumnError', () => {
  it('matches an undefined-column error for a thumbnail column, including through a Drizzle wrapper', () => {
    expect(isMissingThumbnailColumnError(pgError('column "thumbnail_url" does not exist'))).toBe(true);
    expect(isMissingThumbnailColumnError(wrapped(pgError('column gallery_images.thumbnail_storage_key does not exist')))).toBe(true);
  });

  it.each([
    ['another missing column', pgError('column "foo" does not exist')],
    ['a different SQLSTATE', pgError('column "thumbnail_url" does not exist', '23505')],
    ['a connection error', new Error('connect ECONNREFUSED')],
    ['a non-error', undefined],
  ])('does not match %s', (_label, err) => {
    expect(isMissingThumbnailColumnError(err)).toBe(false);
  });
});

describe('withThumbnailColumnFallback', () => {
  it('uses the thumbnail query when the columns exist and never runs the legacy one', async () => {
    const legacy = vi.fn();
    await expect(withThumbnailColumnFallback(async () => 'new', legacy)).resolves.toBe('new');
    expect(legacy).not.toHaveBeenCalled();
  });

  it('falls back when migration 0046 is not applied yet', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const primary = vi.fn().mockRejectedValue(wrapped(pgError('column "thumbnail_url" does not exist')));
    await expect(withThumbnailColumnFallback(primary, async () => 'legacy')).resolves.toBe('legacy');
  });

  it('rethrows every other failure instead of hiding it', async () => {
    const boom = new Error('connection terminated');
    await expect(withThumbnailColumnFallback(() => Promise.reject(boom), async () => 'legacy')).rejects.toBe(boom);
  });
});
