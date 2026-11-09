'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { CACHE_TAGS, updateCacheTags } from '@/app/lib/cache';
import type { ActionResult } from '@/app/lib/result';
import { writeOnboardingFormSettingRows } from '@/app/lib/db/onboarding-form';
import { normalizeGoogleFormUrl, parseEntryId } from '@/app/lib/onboarding/google-form/settings';

/**
 * Saves the onboarding Google Form link and the entry id of its "Verification code" question.
 * Both blank turns the form off (onboarding then skips the step); one without the other is refused,
 * because half a configuration cannot work and the wizard would silently skip it. Requires
 * MANAGE_LEAGUE: the generic page-content editor (MANAGE_CONTENT) refuses these rows on purpose.
 */
export async function saveOnboardingFormSettings(formData: FormData): Promise<ActionResult> {
  try {
    await requirePermission(Permissions.MANAGE_LEAGUE);

    const rawUrl = String(formData.get('formUrl') ?? '').trim();
    const rawEntry = String(formData.get('entryId') ?? '').trim();

    let url = '';
    let entryId = '';
    if (rawUrl || rawEntry) {
      const urlResult = normalizeGoogleFormUrl(rawUrl);
      if (!urlResult.ok) return { success: false, error: urlResult.error };
      const entryResult = parseEntryId(rawEntry);
      if (!entryResult.ok) return { success: false, error: entryResult.error };
      url = urlResult.url;
      entryId = entryResult.entryId;
    }

    await writeOnboardingFormSettingRows({ url, entryId });

    // Every cached read of the settings carries this tag; without it the wizard keeps the old link.
    updateCacheTags(CACHE_TAGS.PAGE_CONTENT);
    revalidatePath('/admin/onboarding-form');
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === 'Forbidden') {
      return { success: false, error: 'You do not have permission to change the onboarding form.' };
    }
    console.error('Failed to save onboarding form settings', err);
    return { success: false, error: 'Could not save. Please try again.' };
  }
}
