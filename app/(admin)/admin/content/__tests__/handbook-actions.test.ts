import { describe, it, expect, vi, beforeEach } from 'vitest';

const { requirePermission, updateTag, revalidatePath, setHandbookPdfKey, removeFromStorage } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  setHandbookPdfKey: vi.fn(),
  removeFromStorage: vi.fn(),
}));

vi.mock('@/app/lib/auth', () => ({ requirePermission }));
vi.mock('next/cache', () => ({ updateTag, revalidatePath }));
vi.mock('@/app/lib/db/queries', () => ({
  savePageContentWithHistory: vi.fn(),
  restorePageContentFromHistory: vi.fn(),
  setHandbookPdfKey,
}));
vi.mock('@/app/lib/storage', () => ({ removeFromStorage }));

import { saveHandbookPdf } from '../actions';
import { Permissions } from '@/app/lib/roles';

const KEY = 'handbook/1760000000000.pdf';

describe('saveHandbookPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue({});
    setHandbookPdfKey.mockResolvedValue(null);
    removeFromStorage.mockResolvedValue({ error: null });
  });

  it('requires MANAGE_CONTENT', async () => {
    requirePermission.mockRejectedValue(new Error('Forbidden'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await saveHandbookPdf(KEY);
    expect(res.success).toBe(false);
    expect(requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_CONTENT);
    expect(setHandbookPdfKey).not.toHaveBeenCalled();
  });

  it('refuses keys that did not come from the uploader', async () => {
    for (const bad of ['gallery/x.png', '../handbook/1.pdf', 'https://evil.example/a.pdf']) {
      const res = await saveHandbookPdf(bad);
      expect(res.success).toBe(false);
    }
    expect(setHandbookPdfKey).not.toHaveBeenCalled();
  });

  it('records the key, expires the page-content cache, and deletes the superseded PDF', async () => {
    setHandbookPdfKey.mockResolvedValue('handbook/1750000000000.pdf');
    const res = await saveHandbookPdf(KEY);
    expect(res).toEqual({ success: true });
    expect(setHandbookPdfKey).toHaveBeenCalledWith(KEY);
    expect(updateTag).toHaveBeenCalledWith('page-content');
    expect(revalidatePath).toHaveBeenCalledWith('/handbook');
    expect(removeFromStorage).toHaveBeenCalledWith(['handbook/1750000000000.pdf']);
  });

  it('still succeeds when cleaning up the old PDF fails', async () => {
    setHandbookPdfKey.mockResolvedValue('handbook/1750000000000.pdf');
    removeFromStorage.mockResolvedValue({ error: 'nope' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await saveHandbookPdf(KEY)).success).toBe(true);
  });
});
