'use server';
import { requireUser } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function createLeader(formData: FormData) {
  await requireUser();
  const name = formData.get('name') as string;
  const role = formData.get('role') as string;
  const year = formData.get('year') as string;
  const bio = formData.get('bio') as string;

  if (!name || !role || !year) {
    throw new Error('Name, Role, and Year are required.');
  }

  await db.insert(schema.leadership).values({
    name,
    role,
    year,
    bio,
  });

  // Revalidate query cache and public pages
  revalidateTag('leadership', {});
  revalidatePath('/admin/leadership');
  revalidatePath('/leadership');
  revalidatePath(`/leadership/${year}`);
}

export async function updateLeader(id: string, year: string, formData: FormData) {
  await requireUser();
  const name = formData.get('name') as string;
  const role = formData.get('role') as string;
  const newYear = formData.get('year') as string;
  const bio = formData.get('bio') as string;
  if (!name || !role || !newYear) throw new Error('Name, Role, and Year are required.');
  await db.update(schema.leadership).set({ name, role, year: newYear, bio }).where(eq(schema.leadership.id, id));
  revalidateTag('leadership', {});
  revalidatePath('/admin/leadership');
  revalidatePath('/leadership');
  revalidatePath(`/leadership/${year}`);
  revalidatePath(`/leadership/${newYear}`);
}

export async function deleteLeader(id: string, year: string) {
  const user = await requireUser();
  await db.update(schema.leadership).set({ deletedAt: new Date(), deletedBy: user.id }).where(eq(schema.leadership.id, id));

  // Revalidate query cache and public pages
  revalidateTag('leadership', {});
  revalidatePath('/admin/leadership');
  revalidatePath('/leadership');
  revalidatePath(`/leadership/${year}`);
}
