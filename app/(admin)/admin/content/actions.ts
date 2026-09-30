'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { revalidatePath, updateTag } from 'next/cache';
import type { ActionResult } from '@/app/lib/result';
import {
  savePageContentWithHistory,
  restorePageContentFromHistory,
} from '@/app/lib/db/queries';

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
