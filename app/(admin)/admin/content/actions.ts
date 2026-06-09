'use server';
import { requireUser } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function updatePageContent(id: string, formData: FormData) {
  await requireUser();
  const content = formData.get('content') as string;

  // Snapshot the current value and overwrite atomically so history can never drift from content.
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ content: schema.pageContent.content, key: schema.pageContent.key })
      .from(schema.pageContent)
      .where(eq(schema.pageContent.id, id))
      .limit(1);

    if (current) {
      await tx.insert(schema.pageContentHistory).values({
        contentKey: current.key,
        previousContent: current.content,
      });
    }

    await tx.update(schema.pageContent).set({ content }).where(eq(schema.pageContent.id, id));
  });

  revalidateTag('page-content', {});
  revalidatePath('/admin/content');
}

export async function restorePageContent(id: string, historyId: string) {
  await requireUser();
  // Fetch the history entry
  const [entry] = await db
    .select()
    .from(schema.pageContentHistory)
    .where(eq(schema.pageContentHistory.id, historyId))
    .limit(1);

  if (!entry) return;

  // Snapshot current then restore atomically (so the restore is itself undoable and consistent).
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ content: schema.pageContent.content, key: schema.pageContent.key })
      .from(schema.pageContent)
      .where(eq(schema.pageContent.id, id))
      .limit(1);

    if (current) {
      await tx.insert(schema.pageContentHistory).values({
        contentKey: current.key,
        previousContent: current.content,
      });
    }

    await tx
      .update(schema.pageContent)
      .set({ content: entry.previousContent })
      .where(eq(schema.pageContent.id, id));
  });

  revalidateTag('page-content', {});
  revalidatePath('/admin/content');
}
