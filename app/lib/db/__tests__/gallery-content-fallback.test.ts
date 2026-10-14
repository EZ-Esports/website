import { describe, it, expect, vi, beforeEach } from 'vitest';

const { select } = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('../index', () => ({ db: { select } }));

import { getCachedHomepageGallery } from '../content';

const chain = (result: Promise<unknown[]>) => ({
  from: () => ({ where: () => ({ orderBy: () => result }) }),
});

const missing = () =>
  Object.assign(new Error('Failed query'), {
    cause: Object.assign(new Error('column "thumbnail_url" does not exist'), { code: '42703' }),
  });

describe('getCachedHomepageGallery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps the thumbnail column onto thumbnailSrc', async () => {
    select.mockReturnValueOnce(
      chain(Promise.resolve([{ id: '1', src: 'https://h/a.jpg', thumbnailUrl: 'https://h/a_thumb.webp', caption: 'A' }])),
    );
    const { set1 } = await getCachedHomepageGallery();
    expect(set1).toEqual([{ id: '1', src: 'https://h/a.jpg', thumbnailSrc: 'https://h/a_thumb.webp', alt: 'A' }]);
  });

  it('still serves the gallery (full-size images) when migration 0046 has not been applied', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    select
      .mockReturnValueOnce(chain(Promise.reject(missing())))
      .mockReturnValueOnce(chain(Promise.resolve([{ id: '1', src: 'https://h/a.jpg', caption: null }])));
    const { set1 } = await getCachedHomepageGallery();
    expect(set1).toEqual([
      { id: '1', src: 'https://h/a.jpg', thumbnailSrc: null, alt: 'EZ Esports gallery photo' },
    ]);
  });

  it('propagates unrelated database failures', async () => {
    select.mockReturnValueOnce(chain(Promise.reject(new Error('connection terminated'))));
    await expect(getCachedHomepageGallery()).rejects.toThrow('connection terminated');
  });
});
