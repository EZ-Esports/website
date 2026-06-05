'use server';

import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

// Helper to generate slugs
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function createNewsPost(formData: FormData) {
  const title = formData.get('title') as string;
  const excerpt = formData.get('excerpt') as string;
  const content = formData.get('content') as string;
  const category = formData.get('category') as string;

  if (!title || !content || !category) {
    throw new Error('Title, content, and category are required.');
  }

  const slug = generateSlug(title);

  await db.insert(schema.newsPosts).values({
    title,
    slug,
    excerpt,
    content,
    category,
  });

  revalidateTag('news', 'max');
  revalidatePath('/news');
  revalidatePath('/admin/news');
  return redirect('/admin/news');
}

export async function updateNewsPost(id: string, formData: FormData) {
  const title = formData.get('title') as string;
  const excerpt = formData.get('excerpt') as string;
  const content = formData.get('content') as string;
  const category = formData.get('category') as string;

  if (!title || !content || !category) {
    throw new Error('Title, content, and category are required.');
  }

  const slug = generateSlug(title);

  await db
    .update(schema.newsPosts)
    .set({
      title,
      slug,
      excerpt,
      content,
      category,
    })
    .where(eq(schema.newsPosts.id, id));

  revalidateTag('news', 'max');
  revalidatePath('/news');
  revalidatePath(`/news/${slug}`);
  revalidatePath('/admin/news');
  return redirect('/admin/news');
}
export async function deleteNewsPost(id: string) {
  await db.delete(schema.newsPosts).where(eq(schema.newsPosts.id, id));
  revalidateTag('news', 'max');
  revalidatePath('/news');
  revalidatePath('/admin/news');
}
