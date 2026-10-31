import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requirePermission, writeOnboardingFormSettingRows, updateCacheTags, revalidatePath } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  writeOnboardingFormSettingRows: vi.fn(),
  updateCacheTags: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/app/lib/auth', () => ({ requirePermission }));
vi.mock('@/app/lib/db/onboarding-form', () => ({ writeOnboardingFormSettingRows }));
vi.mock('@/app/lib/cache', () => ({ CACHE_TAGS: { PAGE_CONTENT: 'page-content' }, updateCacheTags }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { saveOnboardingFormSettings } from '../actions';
import { Permissions } from '@/app/lib/roles';

const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdAbCdEfGhIjKlMnOpQrStUvWxYz0123456789/viewform';

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({});
  writeOnboardingFormSettingRows.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('saveOnboardingFormSettings', () => {
  it('requires MANAGE_LEAGUE and writes nothing for anyone else', async () => {
    requirePermission.mockRejectedValue(new Error('Forbidden'));
    const res = await saveOnboardingFormSettings(form({ formUrl: FORM, entryId: '123456' }));
    expect(res.success).toBe(false);
    expect(requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_LEAGUE);
    expect(writeOnboardingFormSettingRows).not.toHaveBeenCalled();
  });

  it('stores the canonical link and the bare entry id, then expires the page-content cache tag', async () => {
    const res = await saveOnboardingFormSettings(form({ formUrl: `${FORM}?usp=sf_link`, entryId: 'entry.123456' }));
    expect(res).toEqual({ success: true });
    expect(writeOnboardingFormSettingRows).toHaveBeenCalledWith({ url: FORM, entryId: '123456' });
    expect(updateCacheTags).toHaveBeenCalledWith('page-content');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/onboarding-form');
  });

  it('turns the form off when both fields are empty', async () => {
    const res = await saveOnboardingFormSettings(form({ formUrl: '  ', entryId: '' }));
    expect(res.success).toBe(true);
    expect(writeOnboardingFormSettingRows).toHaveBeenCalledWith({ url: '', entryId: '' });
    expect(updateCacheTags).toHaveBeenCalledWith('page-content');
  });

  it('refuses a link that cannot carry a prefilled code, a missing entry id, and half a configuration', async () => {
    const edit = await saveOnboardingFormSettings(form({ formUrl: FORM.replace('/viewform', '/edit'), entryId: '123456' }));
    const short = await saveOnboardingFormSettings(form({ formUrl: 'https://forms.gle/abc123', entryId: '123456' }));
    const noEntry = await saveOnboardingFormSettings(form({ formUrl: FORM, entryId: '' }));
    const noUrl = await saveOnboardingFormSettings(form({ formUrl: '', entryId: '123456' }));
    for (const res of [edit, short, noEntry, noUrl]) expect(res.success).toBe(false);
    expect(writeOnboardingFormSettingRows).not.toHaveBeenCalled();
    expect(updateCacheTags).not.toHaveBeenCalled();
  });

  it('reports a database failure without leaking it', async () => {
    writeOnboardingFormSettingRows.mockRejectedValue(new Error('connection string postgres://secret'));
    const res = await saveOnboardingFormSettings(form({ formUrl: FORM, entryId: '123456' }));
    expect(res).toEqual({ success: false, error: 'Could not save. Please try again.' });
    expect(updateCacheTags).not.toHaveBeenCalled();
  });
});
