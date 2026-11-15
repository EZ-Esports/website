import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_FORM_ENTRY_KEY,
  ONBOARDING_FORM_KEYS,
  ONBOARDING_FORM_URL_KEY,
  buildPrefillUrl,
  isOnboardingFormKey,
  normalizeGoogleFormUrl,
  parseEntryId,
} from '../google-form/settings';

const ID = '1FAIpQLSdAbCdEfGhIjKlMnOpQrStUvWxYz0123456789';

describe('normalizeGoogleFormUrl', () => {
  it('accepts the public respondent link and strips query and fragment', () => {
    const r = normalizeGoogleFormUrl(`  https://docs.google.com/forms/d/e/${ID}/viewform?usp=sf_link#x  `);
    expect(r).toEqual({ ok: true, url: `https://docs.google.com/forms/d/e/${ID}/viewform` });
  });

  it('completes a public link that lacks /viewform', () => {
    expect(normalizeGoogleFormUrl(`https://docs.google.com/forms/d/e/${ID}`)).toEqual({
      ok: true,
      url: `https://docs.google.com/forms/d/e/${ID}/viewform`,
    });
  });

  it('accepts the editor-id respondent link and the /u/<n> account prefix', () => {
    expect(normalizeGoogleFormUrl(`https://docs.google.com/forms/d/${ID}/viewform`)).toEqual({
      ok: true,
      url: `https://docs.google.com/forms/d/${ID}/viewform`,
    });
    expect(normalizeGoogleFormUrl(`https://docs.google.com/forms/u/1/d/e/${ID}/viewform`)).toMatchObject({ ok: true });
  });

  it('refuses /edit, /prefill and a bare editor id, which do not honour a prefilled answer', () => {
    for (const path of [`/forms/d/${ID}/edit`, `/forms/d/${ID}/prefill`, `/forms/d/${ID}`, `/forms/d/e/${ID}/edit`]) {
      const r = normalizeGoogleFormUrl(`https://docs.google.com${path}`);
      expect(r.ok, path).toBe(false);
    }
  });

  it('refuses forms.gle short links with a message that says what to use instead', () => {
    const r = normalizeGoogleFormUrl('https://forms.gle/AbCdEf123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/forms\.gle/);
  });

  it('refuses other schemes, other hosts, lookalikes, credentials, ports and junk', () => {
    for (const raw of [
      '',
      'not a url',
      `http://docs.google.com/forms/d/e/${ID}/viewform`,
      `https://evil.example/forms/d/e/${ID}/viewform`,
      `https://docs.google.com.evil.example/forms/d/e/${ID}/viewform`,
      `https://user:pw@docs.google.com/forms/d/e/${ID}/viewform`,
      `https://docs.google.com:8443/forms/d/e/${ID}/viewform`,
      'javascript:alert(1)',
      'https://docs.google.com/forms/d/e/short/viewform',
    ]) {
      expect(normalizeGoogleFormUrl(raw).ok, raw).toBe(false);
    }
  });
});

describe('parseEntryId', () => {
  it('accepts digits with or without the entry. prefix', () => {
    expect(parseEntryId('1234567890')).toEqual({ ok: true, entryId: '1234567890' });
    expect(parseEntryId(' entry.1234567890 ')).toEqual({ ok: true, entryId: '1234567890' });
  });

  it('refuses anything that is not a numeric id', () => {
    for (const raw of ['', 'entry.', 'abc', '12', '12 34', 'entry.12&x=1', '1'.repeat(30)]) {
      expect(parseEntryId(raw).ok, raw).toBe(false);
    }
  });
});

describe('buildPrefillUrl', () => {
  it('adds usp=pp_url and the token under entry.<id>, replacing any existing query', () => {
    const url = new URL(buildPrefillUrl(`https://docs.google.com/forms/d/e/${ID}/viewform?old=1`, '123456', 'body.mac'));
    expect(url.origin + url.pathname).toBe(`https://docs.google.com/forms/d/e/${ID}/viewform`);
    expect(url.searchParams.get('usp')).toBe('pp_url');
    expect(url.searchParams.get('entry.123456')).toBe('body.mac');
    expect(url.searchParams.has('old')).toBe(false);
  });
});

describe('settings keys', () => {
  it('lists exactly the two rows the staff page owns', () => {
    expect([...ONBOARDING_FORM_KEYS].sort()).toEqual([ONBOARDING_FORM_ENTRY_KEY, ONBOARDING_FORM_URL_KEY].sort());
    expect(isOnboardingFormKey(ONBOARDING_FORM_URL_KEY)).toBe(true);
    expect(isOnboardingFormKey('hero.title')).toBe(false);
    expect(isOnboardingFormKey(undefined)).toBe(false);
  });
});
