'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { revalidatePath, updateTag } from 'next/cache';
import type { ActionResult } from '@/app/lib/result';
import {
  savePageContentWithHistory,
  restorePageContentFromHistory,
  setHandbookPdfKey,
} from '@/app/lib/db/queries';
import { isHandbookStorageKey } from '@/app/lib/handbook';
import { removeFromStorage } from '@/app/lib/storage';

export async function updatePageContent(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await requirePermission(Permissions.MANAGE_CONTENT);
    const content = formData.get('content') as string;

    await savePageContentWithHistory(id, content);

    updateTag('page-content');
    revalidatePath('/admin/content');
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Save failed.' };
  }
}

export async function restorePageContent(id: string, historyId: string): Promise<ActionResult> {
  try {
    await requirePermission(Permissions.MANAGE_CONTENT);
    await restorePageContentFromHistory(id, historyId);

    updateTag('page-content');
    revalidatePath('/admin/content');
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Restore failed.' };
  }
}

/**
 * Makes an already-uploaded handbook PDF (see /api/handbook) the live one.
 * The key is re-validated against the exact shape the uploader generates, so a
 * client can never point the handbook at an arbitrary object or URL.
 */
export async function saveHandbookPdf(storageKey: string): Promise<ActionResult> {
  try {
    await requirePermission(Permissions.MANAGE_CONTENT);
    if (!isHandbookStorageKey(storageKey)) {
      return { success: false, error: 'Invalid handbook file. Upload the PDF again.' };
    }

    const previousKey = await setHandbookPdfKey(storageKey);

    updateTag('page-content');
    revalidatePath('/admin/content');
    revalidatePath('/handbook');

    // Best effort: a leftover old PDF is harmless, a failed save is not.
    if (previousKey && previousKey !== storageKey) {
      const { error } = await removeFromStorage([previousKey]);
      if (error) console.error('Failed to remove superseded handbook PDF:', error);
    }
    return { success: true };
  } catch (err) {
    console.error('Failed to save handbook PDF', err);
    return { success: false, error: err instanceof Error ? err.message : 'Save failed.' };
  }
}
