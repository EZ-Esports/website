import 'server-only';
import { getCachedPageContent } from '@/app/lib/db/content';
import {
  ONBOARDING_FORM_ENTRY_KEY,
  ONBOARDING_FORM_URL_KEY,
  normalizeGoogleFormUrl,
  parseEntryId,
} from './settings';
import { isWebhookSecretConfigured } from './token';

export interface OnboardingFormConfig {
  /** Canonical respondent link, or null when staff have not set a usable one. */
  formUrl: string | null;
  entryId: string | null;
  secretConfigured: boolean;
  /** True only when link, entry id and server secret are all present. Otherwise onboarding skips the step. */
  enabled: boolean;
}

/** Derives the config from raw stored values. Anything that does not validate counts as missing. */
export function resolveOnboardingFormConfig(raw: {
  url: string | null | undefined;
  entryId: string | null | undefined;
}): OnboardingFormConfig {
  const url = raw.url ? normalizeGoogleFormUrl(raw.url) : null;
  const entry = raw.entryId ? parseEntryId(raw.entryId) : null;
  const formUrl = url?.ok ? url.url : null;
  const entryId = entry?.ok ? entry.entryId : null;
  const secretConfigured = isWebhookSecretConfigured();
  return { formUrl, entryId, secretConfigured, enabled: Boolean(formUrl && entryId && secretConfigured) };
}

/**
 * The live config for the wizard and the submission gate. Read through the page-content cache
 * tag, which the staff page invalidates on save. A stored value is re-validated on every read, so
 * a hand-edited row can never switch enforcement on with a link that cannot work.
 */
export async function getOnboardingFormConfig(): Promise<OnboardingFormConfig> {
  const [url, entry] = await Promise.all([
    getCachedPageContent(ONBOARDING_FORM_URL_KEY),
    getCachedPageContent(ONBOARDING_FORM_ENTRY_KEY),
  ]);
  return resolveOnboardingFormConfig({ url: url?.content, entryId: entry?.content });
}
