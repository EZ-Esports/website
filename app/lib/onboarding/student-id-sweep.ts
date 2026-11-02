import 'server-only';
import { deleteUploadRows, findOrphanUploads } from '@/app/lib/db/student-ids';
import { removeStudentIds } from './student-id-storage';

/**
 * Deletes student ID photos nothing needs any more (spec-056): a member was deleted (roster cleanup,
 * the onboarding purge), or an invite was deleted, revoked or expired before its person submitted.
 *
 * Order matters: the object goes first and the row second, and rows are only deleted once Storage
 * accepted the removal. If Storage is down the row (the only pointer to the object) stays and the next
 * sweep retries, so a photo can never be left behind without a record of where it is.
 *
 * Call it after the database change has committed. It never throws: callers are mid-flow on something
 * that already succeeded. Returns how many photos were removed.
 */
export async function sweepOrphanStudentIds(): Promise<number> {
  try {
    const orphans = await findOrphanUploads();
    if (orphans.length === 0) return 0;
    if (!(await removeStudentIds(orphans.map((o) => o.storageKey)))) return 0;
    await deleteUploadRows(orphans.map((o) => o.id));
    return orphans.length;
  } catch (err) {
    console.error('Student ID sweep failed:', err instanceof Error ? err.message : 'unexpected error');
    return 0;
  }
}
