import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/lib/db/content', () => ({ getCachedPageContent: vi.fn() }));

import { resolveOnboardingFormConfig } from '../google-form/config';
import { buildAppsScript } from '../google-form/apps-script';

const ID = '1FAIpQLSdAbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
let saved: string | undefined;
beforeEach(() => {
  saved = process.env.GOOGLE_FORM_WEBHOOK_SECRET;
});
afterEach(() => {
  if (saved === undefined) delete process.env.GOOGLE_FORM_WEBHOOK_SECRET;
  else process.env.GOOGLE_FORM_WEBHOOK_SECRET = saved;
});

describe('resolveOnboardingFormConfig', () => {
  const good = { url: `https://docs.google.com/forms/d/e/${ID}/viewform`, entryId: '123456789' };

  it('is enabled only when link, entry id and server secret are all present and valid', () => {
    process.env.GOOGLE_FORM_WEBHOOK_SECRET = 'x'.repeat(24);
    expect(resolveOnboardingFormConfig(good)).toMatchObject({ enabled: true, secretConfigured: true });
    expect(resolveOnboardingFormConfig({ ...good, entryId: '' }).enabled).toBe(false);
    expect(resolveOnboardingFormConfig({ ...good, url: null }).enabled).toBe(false);
    delete process.env.GOOGLE_FORM_WEBHOOK_SECRET;
    expect(resolveOnboardingFormConfig(good)).toMatchObject({ enabled: false, secretConfigured: false });
  });

  it('treats a hand-edited, no-longer-valid stored value as missing so enforcement cannot turn on by accident', () => {
    process.env.GOOGLE_FORM_WEBHOOK_SECRET = 'x'.repeat(24);
    expect(resolveOnboardingFormConfig({ url: 'https://forms.gle/abc', entryId: '123456789' }).enabled).toBe(false);
    expect(resolveOnboardingFormConfig({ url: good.url, entryId: 'entry.abc' }).enabled).toBe(false);
  });
});

describe('buildAppsScript', () => {
  const script = buildAppsScript('https://ezesports.org/api/google-form/complete');

  it('points at the endpoint and sends the derived key as a bearer token', () => {
    expect(script).toContain('"https://ezesports.org/api/google-form/complete"');
    expect(script).toContain("'Bearer ' + key");
    expect(script).toContain('WEBHOOK_KEY');
  });

  it('retries 408, 429 and 5xx (honouring Retry-After) and never retries other statuses', () => {
    expect(script).toMatch(/status === 408 \|\| status === 429 \|\| status >= 500/);
    expect(script).toContain('Retry-After');
    expect(script).toMatch(/if \(!retryable\) \{\s*throw/);
  });

  it('is syntactically valid JavaScript', () => {
    expect(() => new Function(script)).not.toThrow();
  });

  it('quotes an endpoint safely', () => {
    expect(() => new Function(buildAppsScript('https://x.test/a";alert(1);//'))).not.toThrow();
  });
});
