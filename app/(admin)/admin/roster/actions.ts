'use server';

import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function createRosterMember(formData: FormData) {
  const rosterId = formData.get('rosterId') as string;
  const name = formData.get('name') as string;
  const role = formData.get('role') as string;
  const bio = formData.get('bio') as string;

  if (!rosterId || !name || !role) {
    throw new Error('Roster, Name, and Role are required.');
  }

  await db.insert(schema.players).values({
    rosterId,
    name,
    role,
    bio,
  });

  revalidateTag('players', 'max');
  revalidatePath('/admin/roster');
  revalidatePath('/');
}

export async function deleteRosterMember(id: string) {
  await db.delete(schema.players).where(eq(schema.players.id, id));
  revalidateTag('players', 'max');
  revalidatePath('/admin/roster');
  revalidatePath('/');
}
