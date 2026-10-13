import 'server-only';
import { db } from './index';
import * as schema from './schema';
import { withThumbnailColumnFallback } from './thumbnail-columns';
import { eq, isNull, sql } from 'drizzle-orm';
import { ActionError } from '@/app/lib/errors';
import type { GalleryThumbnailFields } from '@/app/lib/gallery-thumbnails';

export interface GalleryImageInput {
  src: string;
  caption: string;
  schoolName: string;
  eventName: string;
  storageKey: string | null;
}

/** The stored fields the update action needs to validate keys and keep an existing thumbnail. */
export interface GalleryImageStoredFields extends GalleryThumbnailFields {
  src: string;
  storageKey: string | null;
}

// Serializes concurrent adds and reorders. Tied to the transaction, so it is safe under
// Supabase's transaction pooler, unlike a session-level advisory lock.
const lockDisplayOrder = (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtext('gallery_images_display_order'))`);

/**
 * Inserts a gallery image at the end of the list: display order is derived, never
 * user-entered. The lock keeps two simultaneous submissions from reading the same
 * max() and inserting duplicate displayOrder values.
 */
export async function insertGalleryImage(input: GalleryImageInput & { id: string | null; thumb: GalleryThumbnailFields }) {
  const { id, thumb, ...row } = input;
  const insertRow = (includeThumbnail: boolean) =>
    db.transaction(async (tx) => {
      await lockDisplayOrder(tx);

      const [maxOrderResult] = await tx
        .select({ maxOrder: sql<number>`max(${schema.galleryImages.displayOrder})` })
        .from(schema.galleryImages)
        .where(isNull(schema.galleryImages.deletedAt));

      const insertValues: typeof schema.galleryImages.$inferInsert = {
        ...row,
        displayOrder: (maxOrderResult?.maxOrder ?? 0) + 1,
        ...(includeThumbnail ? thumb : {}),
      };
      if (id) {
        insertValues.id = id;
      }

      await tx.insert(schema.galleryImages).values(insertValues);
    });
  // A failed statement aborts the transaction, so the legacy path re-runs it whole.
  await withThumbnailColumnFallback(() => insertRow(true), () => insertRow(false));
}

/** Current stored image and thumbnail columns for one row, or undefined if it doesn't exist. */
export async function getGalleryImageStoredFields(id: string): Promise<GalleryImageStoredFields | undefined> {
  const [row] = await withThumbnailColumnFallback(
    () =>
      db
        .select({
          src: schema.galleryImages.src,
          storageKey: schema.galleryImages.storageKey,
          thumbnailUrl: schema.galleryImages.thumbnailUrl,
          thumbnailStorageKey: schema.galleryImages.thumbnailStorageKey,
        })
        .from(schema.galleryImages)
        .where(eq(schema.galleryImages.id, id))
        .limit(1),
    async () =>
      (
        await db
          .select({ src: schema.galleryImages.src, storageKey: schema.galleryImages.storageKey })
          .from(schema.galleryImages)
          .where(eq(schema.galleryImages.id, id))
          .limit(1)
      ).map((r) => ({ ...r, thumbnailUrl: null as string | null, thumbnailStorageKey: null as string | null })),
  );
  return row;
}

export async function updateGalleryImageRow(id: string, row: GalleryImageInput, thumb: GalleryThumbnailFields) {
  await withThumbnailColumnFallback(
    () => db.update(schema.galleryImages).set({ ...row, ...thumb }).where(eq(schema.galleryImages.id, id)),
    () => db.update(schema.galleryImages).set(row).where(eq(schema.galleryImages.id, id)),
  );
}

/**
 * Persists a full reorder: `orderedIds` must be exactly the set of non-deleted image
 * IDs, with no duplicates or omissions. Throws ActionError('INVALID_ORDER_PAYLOAD') otherwise.
 */
export async function reorderGalleryImages(orderedIds: string[]) {
  await db.transaction(async (tx) => {
    await lockDisplayOrder(tx);

    const currentImages = await tx
      .select({ id: schema.galleryImages.id })
      .from(schema.galleryImages)
      .where(isNull(schema.galleryImages.deletedAt));

    const currentIdSet = new Set(currentImages.map((img) => img.id));

    if (
      orderedIds.length !== currentImages.length ||
      new Set(orderedIds).size !== orderedIds.length ||
      !orderedIds.every((id) => currentIdSet.has(id))
    ) {
      throw new ActionError(
        'INVALID_ORDER_PAYLOAD',
        'Image list is out of date or invalid. Please refresh and try again.'
      );
    }

    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schema.galleryImages)
        .set({ displayOrder: i + 1 })
        .where(eq(schema.galleryImages.id, orderedIds[i]));
    }
  });
}

export async function setGalleryImageActive(id: string, isActive: boolean) {
  await db.update(schema.galleryImages).set({ isActive }).where(eq(schema.galleryImages.id, id));
}

export async function softDeleteGalleryImage(id: string, deletedBy: string) {
  await db
    .update(schema.galleryImages)
    .set({ deletedAt: new Date(), deletedBy })
    .where(eq(schema.galleryImages.id, id));
}
