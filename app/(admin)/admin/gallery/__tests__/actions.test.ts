import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockTx, mockRequirePermission, mockRevalidatePath, mockRevalidateTag } = vi.hoisted(() => {
  const mockTx = {
    execute: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  };

  const mockDb = {
    transaction: vi.fn(async (callback: (tx: typeof mockTx) => Promise<unknown>) => {
      return await callback(mockTx);
    }),
    select: vi.fn(),
    update: vi.fn(),
  };

  const mockRequirePermission = vi.fn();
  const mockRevalidatePath = vi.fn();
  const mockRevalidateTag = vi.fn();

  return { mockDb, mockTx, mockRequirePermission, mockRevalidatePath, mockRevalidateTag };
});

vi.mock('@/app/lib/db', () => ({
  db: mockDb,
}));

vi.mock('@/app/lib/auth', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}));

vi.mock('@/app/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn().mockResolvedValue({}),
      })),
    },
  })),
}));

import { updateGalleryImagesOrder } from '../actions';
import { Permissions } from '@/app/lib/roles';

describe('updateGalleryImagesOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue({ id: 'admin-user' });
  });

  function setupDbWithImages(ids: string[]) {
    mockTx.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(ids.map((id) => ({ id }))),
      }),
    });
    mockTx.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  }

  it('checks for MANAGE_GALLERY permission', async () => {
    setupDbWithImages(['1', '2']);

    await updateGalleryImagesOrder(['1', '2']);

    expect(mockRequirePermission).toHaveBeenCalledWith(Permissions.MANAGE_GALLERY);
  });

  it('acquires the advisory lock inside transaction', async () => {
    setupDbWithImages(['id-1', 'id-2']);

    const res = await updateGalleryImagesOrder(['id-1', 'id-2']);

    expect(res).toEqual({ success: true });
    expect(mockTx.execute).toHaveBeenCalledTimes(1);
    const sqlCall = mockTx.execute.mock.calls[0][0];
    // Check that sql contains the advisory lock query
    expect(JSON.stringify(sqlCall)).toContain('pg_advisory_xact_lock');
    expect(JSON.stringify(sqlCall)).toContain('gallery_images_display_order');
  });

  it('rejects partial list of IDs', async () => {
    setupDbWithImages(['id-1', 'id-2', 'id-3']);

    const res = await updateGalleryImagesOrder(['id-1', 'id-2']);

    expect(res.success).toBe(false);
    expect(res.error).toBe(
      'Image list is out of date or invalid. Please refresh and try again.'
    );
    expect(mockTx.update).not.toHaveBeenCalled();
  });

  it('rejects list with duplicate IDs', async () => {
    setupDbWithImages(['id-1', 'id-2', 'id-3']);

    const res = await updateGalleryImagesOrder(['id-1', 'id-2', 'id-2']);

    expect(res.success).toBe(false);
    expect(res.error).toBe(
      'Image list is out of date or invalid. Please refresh and try again.'
    );
    expect(mockTx.update).not.toHaveBeenCalled();
  });

  it('rejects list with unknown or deleted IDs', async () => {
    setupDbWithImages(['id-1', 'id-2', 'id-3']);

    const res = await updateGalleryImagesOrder(['id-1', 'id-2', 'id-unknown']);

    expect(res.success).toBe(false);
    expect(res.error).toBe(
      'Image list is out of date or invalid. Please refresh and try again.'
    );
    expect(mockTx.update).not.toHaveBeenCalled();
  });

  it('rejects non-array input', async () => {
    setupDbWithImages(['id-1']);

    // @ts-expect-error testing invalid argument type
    const res = await updateGalleryImagesOrder('not-an-array');

    expect(res.success).toBe(false);
    expect(res.error).toBe('Invalid payload: orderedIds must be an array.');
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('updates displayOrder in sequence (i + 1) for valid reordered IDs', async () => {
    setupDbWithImages(['id-1', 'id-2', 'id-3']);

    const updates: Array<{ id: string; displayOrder: number }> = [];
    mockTx.update.mockImplementation(() => ({
      set: vi.fn(({ displayOrder }) => ({
        where: vi.fn((clause) => {
          updates.push({ id: clause, displayOrder });
          return Promise.resolve();
        }),
      })),
    }));

    const res = await updateGalleryImagesOrder(['id-3', 'id-1', 'id-2']);

    expect(res).toEqual({ success: true });
    expect(mockTx.update).toHaveBeenCalledTimes(3);
    expect(updates.map((u) => u.displayOrder)).toEqual([1, 2, 3]);

    expect(mockRevalidateTag).toHaveBeenCalledWith('gallery-images', {});
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/gallery');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });

  it('handles database errors gracefully', async () => {
    mockTx.execute.mockRejectedValueOnce(new Error('DB failure'));

    const res = await updateGalleryImagesOrder(['id-1']);

    expect(res.success).toBe(false);
    expect(res.error).toBe('Could not update order. Please try again.');
  });
});
