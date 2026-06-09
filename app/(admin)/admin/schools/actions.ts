'use server';
import { requireUser } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createClient } from '@/app/lib/supabase/server';

const BUCKET = 'admin-uploads';

function revalidateAll() {
  revalidateTag('schools', {});
  revalidatePath('/admin/schools');
  revalidatePath('/');
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  // Names made up entirely of non-alphanumerics slugify to '' and would collide; fall back to a unique value.
  return base || `school-${Date.now()}`;
}

// Only allow http(s) URLs; blank out anything else (e.g. a javascript: scheme) before it reaches an href.
function safeUrl(url: string): string {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : '';
}

export async function addSchool(formData: FormData) {
  await requireUser();
  const name = formData.get('name') as string;
  const logoUrl = (formData.get('logoUrl') as string) ?? '';
  const storageKey = (formData.get('storageKey') as string) || null;
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;

  if (!name) return;

  const slug = slugify(name);

  await db.insert(schema.schools).values({ name, slug, logoUrl, storageKey, websiteUrl, displayOrder });
  revalidateAll();
}

export async function updateSchool(id: string, formData: FormData) {
  await requireUser();
  const name = formData.get('name') as string;
  const logoUrl = (formData.get('logoUrl') as string) ?? '';
  const newStorageKey = (formData.get('storageKey') as string) || null;
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;

  if (!name) return;

  const [old] = await db
    .select({ storageKey: schema.schools.storageKey })
    .from(schema.schools)
    .where(eq(schema.schools.id, id))
    .limit(1);

  // Delete old file only if a new image was uploaded and differs from the old one
  if (newStorageKey && old?.storageKey && old.storageKey !== newStorageKey) {
    const supabase = await createClient();
    await supabase.storage.from(BUCKET).remove([old.storageKey]);
  }

  // Preserve existing storageKey if no new upload was made
  const storageKey = newStorageKey ?? old?.storageKey ?? null;

  await db
    .update(schema.schools)
    .set({ name, logoUrl, storageKey, websiteUrl, displayOrder })
    .where(eq(schema.schools.id, id));
  revalidateAll();
}

export async function deleteSchool(id: string) {
  await requireUser();
  // Fetch the row first to get storageKey for cleanup
  const [row] = await db
    .select({ storageKey: schema.schools.storageKey })
    .from(schema.schools)
    .where(eq(schema.schools.id, id))
    .limit(1);

  await db.update(schema.schools).set({ deletedAt: new Date() }).where(eq(schema.schools.id, id));

  // Remove from Supabase Storage if a key exists
  if (row?.storageKey) {
    const supabase = await createClient();
    await supabase.storage.from(BUCKET).remove([row.storageKey]);
  }

  revalidateAll();
}

export async function toggleSchoolActive(id: string, isActive: boolean) {
  await requireUser();
  await db
    .update(schema.schools)
    .set({ isActive })
    .where(eq(schema.schools.id, id));
  revalidateAll();
}
