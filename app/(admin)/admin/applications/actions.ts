'use server';
import { requireUser } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updateApplicationStatus(id: string, status: 'pending' | 'reviewed' | 'accepted') {
  await requireUser();
  await db.update(schema.schoolApplications).set({ status }).where(eq(schema.schoolApplications.id, id));
  revalidatePath('/admin/applications');
}

export async function deleteApplication(id: string) {
  await requireUser();
  await db.delete(schema.schoolApplications).where(eq(schema.schoolApplications.id, id));
  revalidatePath('/admin/applications');
}
