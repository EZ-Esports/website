'use server';

import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function createLeader(formData: FormData) {
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
  revalidateTag('leadership', 'max');
  revalidatePath('/admin/leadership');
  revalidatePath('/leadership');
  revalidatePath(`/leadership/${year}`);
}

export async function deleteLeader(id: string, year: string) {
  await db.delete(schema.leadership).where(eq(schema.leadership.id, id));

  // Revalidate query cache and public pages
  revalidateTag('leadership', 'max');
  revalidatePath('/admin/leadership');
  revalidatePath('/leadership');
  revalidatePath(`/leadership/${year}`);
}
