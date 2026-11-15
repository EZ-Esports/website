import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getStaffForAdminSection } = vi.hoisted(() => ({ getStaffForAdminSection: vi.fn() }));
vi.mock('@/app/lib/auth', () => ({ getStaffForAdminSection }));
vi.mock('@/app/lib/db/onboarding-form', () => ({
  readOnboardingFormSettingRows: vi.fn().mockResolvedValue({ url: '', entryId: '' }),
  countFormCompletions: vi.fn().mockResolvedValue(3),
}));
vi.mock('../actions', () => ({ saveOnboardingFormSettings: vi.fn() }));

import OnboardingFormPage from '../page';

async function html() {
  return renderToStaticMarkup(await OnboardingFormPage());
}

beforeEach(() => {
  getStaffForAdminSection.mockResolvedValue({});
  process.env.DATABASE_URL = 'postgres://test';
  process.env.GOOGLE_FORM_WEBHOOK_SECRET = 'checklist-test-secret-16plus';
});

describe('/admin/onboarding-form checklist', () => {
  it('shows nothing but the permission notice to staff without MANAGE_LEAGUE', async () => {
    getStaffForAdminSection.mockResolvedValue(null);
    const out = await html();
    expect(out).not.toContain('WEBHOOK_KEY');
    expect(getStaffForAdminSection).toHaveBeenCalledWith('/admin/onboarding-form');
  });

  it('puts the save after the script, key and trigger, and says saving switches the requirement on', async () => {
    const out = await html();
    const at = (needle: string) => {
      const i = out.indexOf(needle);
      expect(i, needle).toBeGreaterThan(-1);
      return i;
    };
    const copyLink = at('Copy the pre-filled link and the entry id (do not save yet)');
    const generate = at('Generate script');
    const key = at('Add the key as the script property');
    const trigger = at('Add the trigger and authorize it');
    const save = at('then save. This switches the requirement on');
    const test = at('Test it straight after saving');
    expect(copyLink).toBeLessThan(generate);
    expect(generate).toBeLessThan(key);
    expect(key).toBeLessThan(trigger);
    expect(trigger).toBeLessThan(save);
    expect(save).toBeLessThan(test);
    // The settings form (its inputs) is inside the save step, not before the trigger.
    expect(at('id="onboarding-form-url"')).toBeGreaterThan(trigger);
    expect(out).toContain('so it comes last');
  });

  it('leaves response limits to the form owner, with the second-invite caveat and no claim it was tested', async () => {
    const out = await html();
    expect(out).toContain('accepting responses');
    expect(out).toContain('up to the form owner');
    expect(out).not.toContain('Limit to 1 response');
    expect(out).toContain('Not yet tried against a real form');
    expect(out).toMatch(/second invite/);
  });

  it('explains the unverified-app screen and the trigger type', async () => {
    const out = await html();
    expect(out).toContain('hasn&#x27;t verified this app');
    expect(out).toContain('Advanced');
    expect(out).toContain('(unsafe)');
    expect(out).toContain('From form');
    expect(out).toContain('On form submit');
  });

  it('tells staff to do the Google side first and save last when replacing the form', async () => {
    const out = await html();
    expect(out).toContain('Replacing the form later');
    expect(out).toContain('save last');
    expect(out).toContain('students');
    expect(out).toContain('keep using the old form');
  });

  it('points the script at the pinned production address', async () => {
    const out = await html();
    expect(out).toContain('https://ezesports.org/api/google-form/complete');
  });
});
