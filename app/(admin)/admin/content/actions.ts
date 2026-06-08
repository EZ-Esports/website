'use server';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function updatePageContent(id: string, formData: FormData) {
  const content = formData.get('content') as string;
  await db.update(schema.pageContent).set({ content }).where(eq(schema.pageContent.id, id));
  revalidateTag('page-content');
  revalidatePath('/admin/content');
}
