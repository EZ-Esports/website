'use server';

import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function createRosterMember(formData: FormData) {
  const teamId = formData.get('teamId') as string;
  const name = formData.get('name') as string;
  const role = formData.get('role') as string;
  const bio = formData.get('bio') as string;

  if (!teamId || !name || !role) {
    throw new Error('Team, Name, and Role are required.');
  }

  await db.insert(schema.rosters).values({
    teamId,
    name,
    role,
    bio,
  });

  revalidateTag('rosters', 'max');
  revalidatePath('/admin/roster');
  revalidatePath('/');
}

export async function deleteRosterMember(id: string) {
  await db.delete(schema.rosters).where(eq(schema.rosters.id, id));
  revalidateTag('rosters', 'max');
  revalidatePath('/admin/roster');
  revalidatePath('/');
}
