'use server';
import { requireAdmin } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updateApplicationStatus(id: string, status: 'pending' | 'reviewed' | 'accepted') {
  await requireAdmin();
  await db.update(schema.schoolApplications).set({ status }).where(eq(schema.schoolApplications.id, id));
  revalidatePath('/admin/applications');
}

export async function deleteApplication(id: string) {
  await requireAdmin();
  await db.delete(schema.schoolApplications).where(eq(schema.schoolApplications.id, id));
  revalidatePath('/admin/applications');
}
