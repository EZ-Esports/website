/**
 * Pure helpers for the staff-configured onboarding Google Form (spec-051). No server-only imports,
 * so the staff page, the wizard and the server all share one definition of a usable form link.
 *
 * Two `page_content` rows hold the settings. They are not free text: only the staff page may write
 * them, and the generic page-content editor refuses them (see ONBOARDING_FORM_KEYS users).
 */

export const ONBOARDING_FORM_URL_KEY = 'onboarding_form_url';
export const ONBOARDING_FORM_ENTRY_KEY = 'onboarding_form_entry_id';
export const ONBOARDING_FORM_URL_LABEL = 'Onboarding Google Form link';
export const ONBOARDING_FORM_ENTRY_LABEL = 'Onboarding Google Form verification entry id';

/** Every `page_content` key that belongs to the onboarding form settings. */
export const ONBOARDING_FORM_KEYS: readonly string[] = [ONBOARDING_FORM_URL_KEY, ONBOARDING_FORM_ENTRY_KEY];

export function isOnboardingFormKey(key: string | null | undefined): boolean {
  return typeof key === 'string' && ONBOARDING_FORM_KEYS.includes(key);
}

export const ONBOARDING_FORM_PAGE_CONTENT_ERROR =
  'The onboarding form settings are managed on the Onboarding Form page, not here.';

export type UrlResult = { ok: true; url: string } | { ok: false; error: string };

const FORM_ID = /^[A-Za-z0-9_-]{10,200}$/;

/**
 * Accepts only a link that honours pre-filled answers and returns its canonical form
 * (`https://docs.google.com/forms/d/e/<id>/viewform`, no query or fragment).
 *
 * Accepted: `/forms/d/e/<id>/viewform` (the public link) and `/forms/d/<id>/viewform`, each
 * optionally with `/forms/u/<n>/...`. A link that does not end the way a respondent link does
 * (`/edit`, `/prefill`, a bare `/forms/d/<id>`) or lives on `forms.gle` cannot carry a prefilled
 * verification code, so it is refused with a message that says what to paste instead. A public
 * link without the trailing `/viewform` (`/forms/d/e/<id>`) is also accepted and completed.
 */
export function normalizeGoogleFormUrl(raw: string): UrlResult {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { ok: false, error: 'Paste the Google Form link.' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'That does not look like a link. Paste the full form link, starting with https://.' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, error: 'The link must start with https://.' };
  }
  if (url.username || url.password || url.port) {
    return { ok: false, error: 'The link must be a plain docs.google.com form link.' };
  }
  if (url.hostname === 'forms.gle') {
    return {
      ok: false,
      error:
        'Short forms.gle links cannot carry the verification code. Open the form, choose Send, then copy the full docs.google.com link (it ends in /viewform).',
    };
  }
  if (url.hostname !== 'docs.google.com') {
    return { ok: false, error: 'Only docs.google.com form links are accepted.' };
  }

  const path = url.pathname.replace(/\/+$/, '');
  const match = /^\/forms(?:\/u\/\d+)?\/d\/(e\/)?([^/]+)(?:\/(viewform))?$/.exec(path);
  if (!match) {
    return {
      ok: false,
      error:
        'That is not a respondent link. Use the link people open to fill the form in: it looks like docs.google.com/forms/d/e/.../viewform, not the /edit link.',
    };
  }
  const isPublic = Boolean(match[1]);
  const id = match[2];
  const hasViewform = Boolean(match[3]);
  if (!FORM_ID.test(id)) {
    return { ok: false, error: 'That form link looks incomplete. Copy it again from the form.' };
  }
  // `/forms/d/<id>` with no suffix is the editor link, not a respondent link. Only the public
  // `/forms/d/e/<id>` shape may omit `/viewform`.
  if (!hasViewform && !isPublic) {
    return {
      ok: false,
      error: 'That is the editor link. Open the form, choose Send, and copy the link that ends in /viewform.',
    };
  }
  return { ok: true, url: `https://docs.google.com/forms/d/${isPublic ? 'e/' : ''}${id}/viewform` };
}

export type EntryIdResult = { ok: true; entryId: string } | { ok: false; error: string };

/**
 * The numeric id of the "Verification code" question. Staff copy it from the prefilled link
 * (`entry.123456789`), so both `123456789` and `entry.123456789` are accepted; the stored form
 * is the digits alone.
 */
export function parseEntryId(raw: string): EntryIdResult {
  const trimmed = (raw ?? '').trim().replace(/^entry\./i, '');
  if (!trimmed) return { ok: false, error: 'Enter the entry id of the Verification code question.' };
  if (!/^\d{3,20}$/.test(trimmed)) {
    return { ok: false, error: 'The entry id is the number after "entry." in the prefilled link, for example 1234567890.' };
  }
  return { ok: true, entryId: trimmed };
}

/**
 * The form link with the verification token prefilled. `usp=pp_url` is what Google requires for
 * a prefilled link to be honoured. Built from the stored canonical URL, never from user input.
 */
export function buildPrefillUrl(formUrl: string, entryId: string, token: string): string {
  const url = new URL(formUrl);
  url.search = '';
  url.searchParams.set('usp', 'pp_url');
  url.searchParams.set(`entry.${entryId}`, token);
  return url.toString();
}
