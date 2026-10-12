import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockDb, mockTx, remove, list, updateTag } = vi.hoisted(() => {
  const mockTx = { execute: vi.fn(), select: vi.fn(), insert: vi.fn() };
  const mockDb = {
    transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
    select: vi.fn(),
    update: vi.fn(),
  };
  return { mockDb, mockTx, remove: vi.fn(), list: vi.fn(), updateTag: vi.fn() };
});

vi.mock('@/app/lib/db', () => ({ db: mockDb }));
vi.mock('@/app/lib/auth', () => ({ requirePermission: vi.fn().mockResolvedValue({ id: 'staff' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag }));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<typeof import('drizzle-orm')>()),
  eq: (_c: unknown, v: unknown) => v,
}));
vi.mock('@/app/lib/supabase/service', () => ({
  createServiceClient: () => ({ storage: { from: () => ({ list, remove }) } }),
}));

import { addGalleryImage, updateGalleryImage, deleteGalleryImage } from '../actions';

const ID = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const OLD_FULL = `gallery/${ID}/1700000000000.jpg`;
const OLD_THUMB = `gallery/${ID}/1700000000000_thumb.webp`;
const NEW_FULL = `gallery/${ID}/1700000009999.jpg`;
const NEW_THUMB = `gallery/${ID}/1700000009999_thumb.webp`;
const BASE = 'https://x.supabase.co/storage/v1/object/public/admin-uploads';

const names = (keys: string[]) => keys.map((k) => k.split('/').pop());

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe('gallery actions with thumbnails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remove.mockResolvedValue({ error: null });
    list.mockResolvedValue({
      data: [OLD_FULL, OLD_THUMB, NEW_FULL, NEW_THUMB].map((k) => ({ name: k.split('/').pop() })),
      error: null,
    });
  });

  it('addGalleryImage persists the validated thumbnail columns and keeps both objects', async () => {
    mockTx.select.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ maxOrder: 3 }]) }),
    });
    const values = vi.fn().mockResolvedValue(undefined);
    mockTx.insert.mockReturnValue({ values });

    const res = await addGalleryImage(
      form({
        src: `${BASE}/${NEW_FULL}`,
        caption: 'cap',
        entityId: ID,
        storageKey: NEW_FULL,
        thumbnailUrl: `${BASE}/${NEW_THUMB}`,
        thumbnailStorageKey: NEW_THUMB,
      }),
    );

    expect(res).toEqual({ success: true });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ storageKey: NEW_FULL, thumbnailUrl: `${BASE}/${NEW_THUMB}`, thumbnailStorageKey: NEW_THUMB }),
    );
    // Only the stale pair is removed; the kept full-size file and its thumbnail survive.
    expect(names(remove.mock.calls[0][0])).toEqual(['1700000000000.jpg', '1700000000000_thumb.webp']);
    expect(updateTag).toHaveBeenCalledWith('gallery-images');
  });

  it('addGalleryImage ignores a thumbnail key that is not derived from the storage key', async () => {
    mockTx.select.mockReturnValue({ from: () => ({ where: () => Promise.resolve([{ maxOrder: 0 }]) }) });
    const values = vi.fn().mockResolvedValue(undefined);
    mockTx.insert.mockReturnValue({ values });

    await addGalleryImage(
      form({
        src: `${BASE}/${NEW_FULL}`,
        caption: 'cap',
        entityId: ID,
        storageKey: NEW_FULL,
        thumbnailUrl: `${BASE}/gallery/other/1_thumb.webp`,
        thumbnailStorageKey: 'gallery/other/1_thumb.webp',
      }),
    );

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ thumbnailUrl: null, thumbnailStorageKey: null }));
  });

  it('updateGalleryImage replacing the photo stores the new pair and removes the old pair', async () => {
    mockDb.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([{ storageKey: OLD_FULL, thumbnailUrl: `${BASE}/${OLD_THUMB}`, thumbnailStorageKey: OLD_THUMB }]),
        }),
      }),
    });
    const set = vi.fn().mockReturnValue({ where: () => Promise.resolve() });
    mockDb.update.mockReturnValue({ set });

    const res = await updateGalleryImage(
      ID,
      form({
        src: `${BASE}/${NEW_FULL}`,
        caption: 'cap',
        storageKey: NEW_FULL,
        thumbnailUrl: `${BASE}/${NEW_THUMB}`,
        thumbnailStorageKey: NEW_THUMB,
      }),
    );

    expect(res).toEqual({ success: true });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ storageKey: NEW_FULL, thumbnailStorageKey: NEW_THUMB, thumbnailUrl: `${BASE}/${NEW_THUMB}` }),
    );
    expect(names(remove.mock.calls[0][0])).toEqual(['1700000000000.jpg', '1700000000000_thumb.webp']);
  });

  it('updateGalleryImage on a caption-only edit keeps the existing thumbnail even if the form posted none', async () => {
    mockDb.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([{ storageKey: OLD_FULL, thumbnailUrl: `${BASE}/${OLD_THUMB}`, thumbnailStorageKey: OLD_THUMB }]),
        }),
      }),
    });
    const set = vi.fn().mockReturnValue({ where: () => Promise.resolve() });
    mockDb.update.mockReturnValue({ set });
    list.mockResolvedValue({ data: [OLD_FULL, OLD_THUMB].map((k) => ({ name: k.split('/').pop() })), error: null });

    await updateGalleryImage(ID, form({ src: `${BASE}/${OLD_FULL}`, caption: 'new caption', storageKey: OLD_FULL }));

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ thumbnailStorageKey: OLD_THUMB }));
    expect(remove).not.toHaveBeenCalled();
  });

  describe('legacy rows (root-level original, thumbnail in gallery/<id>/)', () => {
    const ROOT_NAME = '2c07ef71-aaaa.jpg';
    const ROOT_SRC = `${BASE}/${ROOT_NAME}`;
    const LEGACY_THUMB = `gallery/${ID}/2c07ef71-aaaa_thumb.webp`;
    const legacyRow = {
      src: ROOT_SRC,
      storageKey: ROOT_NAME,
      thumbnailUrl: `${BASE}/${LEGACY_THUMB}`,
      thumbnailStorageKey: LEGACY_THUMB,
    };

    afterEach(() => vi.unstubAllEnvs());

    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
      mockDb.select.mockReturnValue({ from: () => ({ where: () => ({ limit: () => Promise.resolve([legacyRow]) }) }) });
      list.mockResolvedValue({ data: [{ name: '2c07ef71-aaaa_thumb.webp' }], error: null });
    });

    it('a caption-only edit keeps the legacy thumbnail and does not delete it from storage', async () => {
      const set = vi.fn().mockReturnValue({ where: () => Promise.resolve() });
      mockDb.update.mockReturnValue({ set });

      const res = await updateGalleryImage(ID, form({ src: ROOT_SRC, caption: 'new', storageKey: ROOT_NAME }));

      expect(res).toEqual({ success: true });
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({ thumbnailUrl: `${BASE}/${LEGACY_THUMB}`, thumbnailStorageKey: LEGACY_THUMB }),
      );
      expect(remove).not.toHaveBeenCalled();
    });

    it('replacing the photo drops the legacy thumbnail and removes it from the row folder', async () => {
      const set = vi.fn().mockReturnValue({ where: () => Promise.resolve() });
      mockDb.update.mockReturnValue({ set });
      list.mockResolvedValue({ data: [{ name: '2c07ef71-aaaa_thumb.webp' }, { name: '1700000009999.jpg' }], error: null });

      await updateGalleryImage(ID, form({ src: `${BASE}/${NEW_FULL}`, caption: 'new', storageKey: NEW_FULL }));

      expect(set).toHaveBeenCalledWith(expect.objectContaining({ storageKey: NEW_FULL, thumbnailUrl: null, thumbnailStorageKey: null }));
      expect(remove).toHaveBeenCalledWith([LEGACY_THUMB]);
    });

    it('a forged thumbnail posted with an edit is ignored', async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ ...legacyRow, thumbnailUrl: null, thumbnailStorageKey: null }]) }) }),
      });
      const set = vi.fn().mockReturnValue({ where: () => Promise.resolve() });
      mockDb.update.mockReturnValue({ set });
      const forged = `gallery/${ID}/evil_thumb.webp`;

      await updateGalleryImage(
        ID,
        form({ src: ROOT_SRC, caption: 'x', storageKey: ROOT_NAME, thumbnailStorageKey: forged, thumbnailUrl: `${BASE}/${forged}` }),
      );

      expect(set).toHaveBeenCalledWith(expect.objectContaining({ thumbnailUrl: null, thumbnailStorageKey: null }));
    });

    it('deleting removes only the row folder (including the legacy thumbnail); the root-level original is never listed or removed', async () => {
      mockDb.update.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) });

      await deleteGalleryImage(ID);

      expect(list).toHaveBeenCalledWith(`gallery/${ID}`);
      expect(remove).toHaveBeenCalledWith([LEGACY_THUMB]);
      expect(remove.mock.calls.flat(2)).not.toContain(ROOT_NAME);
    });
  });

  describe('before migration 0046 is applied', () => {
    const missing = () =>
      Object.assign(new Error('Failed query'), {
        cause: Object.assign(new Error('column "thumbnail_url" of relation "gallery_images" does not exist'), { code: '42703' }),
      });

    it('addGalleryImage retries the insert without thumbnail columns and still succeeds', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockTx.select.mockReturnValue({ from: () => ({ where: () => Promise.resolve([{ maxOrder: 1 }]) }) });
      const values = vi.fn().mockRejectedValueOnce(missing()).mockResolvedValue(undefined);
      mockTx.insert.mockReturnValue({ values });

      const res = await addGalleryImage(
        form({
          src: `${BASE}/${NEW_FULL}`,
          caption: 'cap',
          entityId: ID,
          storageKey: NEW_FULL,
          thumbnailUrl: `${BASE}/${NEW_THUMB}`,
          thumbnailStorageKey: NEW_THUMB,
        }),
      );

      expect(res).toEqual({ success: true });
      expect(values).toHaveBeenCalledTimes(2);
      expect(values.mock.calls[1][0]).not.toHaveProperty('thumbnailUrl');
      expect(values.mock.calls[1][0]).not.toHaveProperty('thumbnailStorageKey');
      expect(values.mock.calls[1][0]).toMatchObject({ storageKey: NEW_FULL });
    });

    it('updateGalleryImage reads and writes without thumbnail columns', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockDb.select
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.reject(missing()) }) }) })
        .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ storageKey: OLD_FULL }]) }) }) });
      const set = vi
        .fn()
        .mockReturnValueOnce({ where: () => Promise.reject(missing()) })
        .mockReturnValue({ where: () => Promise.resolve() });
      mockDb.update.mockReturnValue({ set });
      list.mockResolvedValue({ data: [{ name: OLD_FULL.split('/').pop() }], error: null });

      const res = await updateGalleryImage(ID, form({ src: `${BASE}/${OLD_FULL}`, caption: 'new', storageKey: OLD_FULL }));

      expect(res).toEqual({ success: true });
      expect(set).toHaveBeenCalledTimes(2);
      expect(set.mock.calls[1][0]).not.toHaveProperty('thumbnailUrl');
      expect(set.mock.calls[1][0]).toMatchObject({ caption: 'new', storageKey: OLD_FULL });
    });

    it('does not swallow unrelated database errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTx.select.mockReturnValue({ from: () => ({ where: () => Promise.resolve([{ maxOrder: 1 }]) }) });
      const values = vi.fn().mockRejectedValue(new Error('connection terminated'));
      mockTx.insert.mockReturnValue({ values });

      const res = await addGalleryImage(form({ src: `${BASE}/${NEW_FULL}`, caption: 'cap', entityId: ID, storageKey: NEW_FULL }));

      expect(res.success).toBe(false);
      expect(values).toHaveBeenCalledTimes(1);
    });
  });

  it('deleteGalleryImage removes both the full-size image and its thumbnail', async () => {
    mockDb.update.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) });
    list.mockResolvedValue({ data: [OLD_FULL, OLD_THUMB].map((k) => ({ name: k.split('/').pop() })), error: null });

    await deleteGalleryImage(ID);

    expect(remove).toHaveBeenCalledWith([OLD_FULL, OLD_THUMB]);
    expect(updateTag).toHaveBeenCalledWith('gallery-images');
  });
});
