'use server';
import { requireUser } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { slugify, sanitizeDbError } from '@/app/lib/text-utils';

function revalidateAll() {
  revalidateTag('news', {});
  revalidatePath('/news');
  revalidatePath('/admin/news');
}

export async function createNewsPost(formData: FormData) {
  await requireUser();
  const title = formData.get('title') as string;
  const excerpt = formData.get('excerpt') as string;
  const content = formData.get('content') as string;
  const category = formData.get('category') as string;
  const intent = formData.get('intent') as string;

  if (!title || !content || !category) {
    return { success: false, error: 'Title, content, and category are required.' };
  }

  const slug = slugify(title);

  try {
    await db.insert(schema.newsPosts).values({
      title,
      slug,
      excerpt,
      content,
      category,
      status: intent === 'publish' ? 'published' : 'draft',
      publishedAt: intent === 'publish' ? new Date() : null,
    });
  } catch (error) {
    console.error('Failed to create news post', error);
    return { success: false, error: sanitizeDbError(error) };
  }

  revalidateAll();
  redirect('/admin/news');
}

export async function updateNewsPost(id: string, formData: FormData) {
  await requireUser();
  const title = formData.get('title') as string;
  const excerpt = formData.get('excerpt') as string;
  const content = formData.get('content') as string;
  const category = formData.get('category') as string;
  const intent = formData.get('intent') as string;

  if (!title || !content || !category) {
    return { success: false, error: 'Title, content, and category are required.' };
  }

  const slug = slugify(title);

  try {
    const [existing] = await db
      .select()
      .from(schema.newsPosts)
      .where(eq(schema.newsPosts.id, id))
      .limit(1);

    let status: 'draft' | 'published' | 'archived' = existing?.status ?? 'draft';
    let publishedAt: Date | null = existing?.publishedAt ?? null;

    if (intent === 'publish') {
      status = 'published';
      if (!publishedAt) {
        publishedAt = new Date();
      }
    } else {
      // intent === 'draft': downgrade to draft regardless of current status
      status = 'draft';
    }

    await db
      .update(schema.newsPosts)
      .set({
        title,
        slug,
        excerpt,
        content,
        category,
        status,
        publishedAt,
      })
      .where(eq(schema.newsPosts.id, id));
  } catch (error) {
    console.error('Failed to update news post', error);
    return { success: false, error: sanitizeDbError(error) };
  }

  revalidateAll();
  revalidatePath(`/news/${slug}`);
  redirect('/admin/news');
}

export async function publishNewsPost(id: string) {
  await requireUser();
  const [existing] = await db
    .select({ publishedAt: schema.newsPosts.publishedAt })
    .from(schema.newsPosts)
    .where(eq(schema.newsPosts.id, id))
    .limit(1);

  await db
    .update(schema.newsPosts)
    // Preserve the original publish date if the post was published before; only stamp on first publish.
    .set({ status: 'published', publishedAt: existing?.publishedAt ?? new Date() })
    .where(eq(schema.newsPosts.id, id));
  revalidateAll();
}

export async function unpublishNewsPost(id: string) {
  await requireUser();
  await db
    .update(schema.newsPosts)
    .set({ status: 'draft' })
    .where(eq(schema.newsPosts.id, id));
  revalidateAll();
}

export async function archiveNewsPost(id: string) {
  await requireUser();
  await db
    .update(schema.newsPosts)
    .set({ status: 'archived' })
    .where(eq(schema.newsPosts.id, id));
  revalidateAll();
}

export async function deleteNewsPost(id: string) {
  const user = await requireUser();
  await db
    .update(schema.newsPosts)
    .set({ deletedAt: new Date(), deletedBy: user.id })
    .where(eq(schema.newsPosts.id, id));
  revalidateAll();
}
