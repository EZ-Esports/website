import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanupEntityStorage } from '@/app/lib/storage';
import { cleanAbandonedStorage } from '@/db/storage-clean';

// Mock Supabase service client
const mockList = vi.fn();
const mockRemove = vi.fn();

vi.mock('@/app/lib/supabase/service', () => ({
  createServiceClient: () => ({
    storage: {
      from: () => ({
        list: mockList,
        remove: mockRemove,
      }),
    },
  }),
}));

// Mock DB queries for cleanAbandonedStorage
vi.mock('@/app/lib/db', () => ({
  db: {
    select: () => ({
      from: () => {
        const p: any = Promise.resolve([]);
        p.where = () => Promise.resolve([]);
        return p;
      },
    }),
  },
}));

describe('cleanupEntityStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scans entity folder and removes only unkept files', async () => {
    mockList.mockResolvedValueOnce({
      data: [
        { name: '1700000000000.png' },
        { name: '1700000005000.png' },
        { name: '1700000010000.png' },
      ],
      error: null,
    });
    mockRemove.mockResolvedValueOnce({ data: [], error: null });

    const keepKey = 'schools/entity-123/1700000010000.png';
    const result = await cleanupEntityStorage('schools', 'entity-123', keepKey);

    expect(mockList).toHaveBeenCalledWith('schools/entity-123');
    expect(mockRemove).toHaveBeenCalledWith([
      'schools/entity-123/1700000000000.png',
      'schools/entity-123/1700000005000.png',
    ]);
    expect(result.deleted).toEqual([
      'schools/entity-123/1700000000000.png',
      'schools/entity-123/1700000005000.png',
    ]);
  });

  it('removes all files when keepStorageKey is not provided (row deletion)', async () => {
    mockList.mockResolvedValueOnce({
      data: [
        { name: '1700000000000.png' },
      ],
      error: null,
    });
    mockRemove.mockResolvedValueOnce({ data: [], error: null });

    const result = await cleanupEntityStorage('gallery', 'gallery-456');

    expect(mockList).toHaveBeenCalledWith('gallery/gallery-456');
    expect(mockRemove).toHaveBeenCalledWith([
      'gallery/gallery-456/1700000000000.png',
    ]);
    expect(result.deleted).toEqual(['gallery/gallery-456/1700000000000.png']);
  });

  it('no-ops if entityId contains invalid characters or path traversal', async () => {
    const result = await cleanupEntityStorage('schools', '../../hacked');
    expect(mockList).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
    expect(result.deleted).toEqual([]);
  });

  it('no-ops when folder has no files', async () => {
    mockList.mockResolvedValueOnce({ data: [], error: null });

    const result = await cleanupEntityStorage('sponsors', 'sponsor-789');
    expect(mockRemove).not.toHaveBeenCalled();
    expect(result.deleted).toEqual([]);
  });
});

describe('cleanAbandonedStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('purges files older than 24h in unreferenced entity folders', async () => {
    const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
    const newTimestamp = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago

    // When listing section folders (e.g. gallery)
    mockList.mockImplementation((path: string) => {
      if (path === 'gallery') {
        return Promise.resolve({
          data: [{ name: 'abandoned-folder-1' }],
          error: null,
        });
      }
      if (path === 'gallery/abandoned-folder-1') {
        return Promise.resolve({
          data: [
            { name: `${oldTimestamp}.jpg` },
            { name: `${newTimestamp}.jpg` },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    mockRemove.mockResolvedValueOnce({ data: [], error: null });

    const res = await cleanAbandonedStorage();

    expect(res.scannedCount).toBe(2);
    expect(res.unreferencedCount).toBe(2);
    // Only the file older than 24h should be marked for deletion
    expect(res.deletedKeys).toEqual([`gallery/abandoned-folder-1/${oldTimestamp}.jpg`]);
    expect(mockRemove).toHaveBeenCalledWith([`gallery/abandoned-folder-1/${oldTimestamp}.jpg`]);
  });

  it('supports dry-run mode without invoking remove', async () => {
    const oldTimestamp = Date.now() - (30 * 60 * 60 * 1000);

    mockList.mockImplementation((path: string) => {
      if (path === 'schools') {
        return Promise.resolve({
          data: [{ name: 'abandoned-school' }],
          error: null,
        });
      }
      if (path === 'schools/abandoned-school') {
        return Promise.resolve({
          data: [{ name: `${oldTimestamp}.png` }],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    const res = await cleanAbandonedStorage({ dryRun: true });

    expect(res.deletedKeys).toEqual([`schools/abandoned-school/${oldTimestamp}.png`]);
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
