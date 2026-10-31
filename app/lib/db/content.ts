import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './index';
import * as schema from './schema';
import { withThumbnailColumnFallback } from './thumbnail-columns';
import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { HANDBOOK_PDF_CONTENT_KEY, HANDBOOK_PDF_LABEL, isHandbookStorageKey } from '@/app/lib/handbook';
import { ONBOARDING_FORM_PAGE_CONTENT_ERROR, isOnboardingFormKey } from '@/app/lib/onboarding/google-form/settings';

export const NEWS_PAGE_SIZE = 20;
const DEFAULT_PAGE_SIZE = NEWS_PAGE_SIZE;

/**
 * Paginated published news for public pages.
 * Use getStaffNews() in staff views where you need all statuses.
 */
export const getCachedNews = unstable_cache(
  async (limit = DEFAULT_PAGE_SIZE, offset = 0) => {
    return db
      .select()
      .from(schema.newsPosts)
      .where(and(eq(schema.newsPosts.status, 'published'), isNull(schema.newsPosts.deletedAt)))
      .orderBy(desc(schema.newsPosts.publishedAt))
      .limit(limit)
      .offset(offset);
  },
  ['news-list'],
  { tags: ['news'] }
);

/** Uncached: returns all posts (all statuses) for staff views. */
export const getStaffNews = () =>
  db
    .select()
    .from(schema.newsPosts)
    .where(isNull(schema.newsPosts.deletedAt))
    .orderBy(desc(schema.newsPosts.updatedAt));

/** Count of published (non-deleted) news posts (for dashboard). */
export const countPublishedNews = async (): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(schema.newsPosts)
    .where(and(eq(schema.newsPosts.status, 'published'), isNull(schema.newsPosts.deletedAt)));
  return row?.value ?? 0;
};

export const getCachedSponsors = unstable_cache(
  async () =>
    db
      .select()
      .from(schema.sponsors)
      .where(and(eq(schema.sponsors.isActive, true), isNull(schema.sponsors.deletedAt)))
      .orderBy(schema.sponsors.tier, schema.sponsors.displayOrder),
  ['sponsors'],
  { tags: ['sponsors'] }
);

export const getCachedPageContent = unstable_cache(
  async (key: string) => {
    const rows = await db
      .select()
      .from(schema.pageContent)
      .where(eq(schema.pageContent.key, key))
      .limit(1);
    return rows[0] ?? null;
  },
  ['page-content'],
  { tags: ['page-content'] }
);

/**
 * Storage key of the staff-uploaded handbook PDF, or null when none has been
 * uploaded (or the stored value is not a key this feature wrote).
 */
export const getCachedHandbookPdfKey = unstable_cache(
  async (): Promise<string | null> => {
    const row = await getPageContentRow(HANDBOOK_PDF_CONTENT_KEY);
    return isHandbookStorageKey(row?.content) ? row.content : null;
  },
  ['handbook-pdf-key'],
  { tags: ['page-content'] }
);

async function getPageContentRow(key: string) {
  const rows = await db
    .select({ content: schema.pageContent.content })
    .from(schema.pageContent)
    .where(eq(schema.pageContent.key, key))
    .limit(1);
  return rows[0] ?? null;
}

/** Uncached read for staff views and for finding the object a replacement supersedes. */
export async function getHandbookPdfKey(): Promise<string | null> {
  const row = await getPageContentRow(HANDBOOK_PDF_CONTENT_KEY);
  return isHandbookStorageKey(row?.content) ? row.content : null;
}

/**
 * Points the handbook at a new PDF. Upserts so no seed or migration is needed
 * for the row to exist; returns the previous key so the caller can delete the
 * superseded object.
 */
export async function setHandbookPdfKey(storageKey: string): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ content: schema.pageContent.content })
      .from(schema.pageContent)
      .where(eq(schema.pageContent.key, HANDBOOK_PDF_CONTENT_KEY))
      .limit(1);

    await tx
      .insert(schema.pageContent)
      .values({ key: HANDBOOK_PDF_CONTENT_KEY, label: HANDBOOK_PDF_LABEL, content: storageKey })
      .onConflictDoUpdate({ target: schema.pageContent.key, set: { content: storageKey } });

    return isHandbookStorageKey(current?.content) ? current.content : null;
  });
}

export const getCachedHomepageContent = unstable_cache(
  async () => {
    const keys = ['hero.title', 'hero.subtitle', 'hero.cta', 'home_about_blurb'];
    const rows = await db
      .select({
        key: schema.pageContent.key,
        content: schema.pageContent.content,
      })
      .from(schema.pageContent)
      .where(inArray(schema.pageContent.key, keys));

    return Object.fromEntries(rows.map((row) => [row.key, row.content]));
  },
  ['homepage-content'],
  { tags: ['page-content'] }
);

/**
 * Updates a page content block and appends a history entry atomically.
 */
export async function savePageContentWithHistory(id: string, content: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ content: schema.pageContent.content, key: schema.pageContent.key })
      .from(schema.pageContent)
      .where(eq(schema.pageContent.id, id))
      .limit(1);

    // The handbook row holds a storage key managed by the uploader, not free text.
    if (current?.key === HANDBOOK_PDF_CONTENT_KEY) {
      throw new Error('Use the handbook uploader to change the handbook PDF.');
    }
    // The onboarding form settings need MANAGE_LEAGUE and validation; the generic editor
    // (MANAGE_CONTENT) must not be a way around either.
    if (isOnboardingFormKey(current?.key)) {
      throw new Error(ONBOARDING_FORM_PAGE_CONTENT_ERROR);
    }

    if (current) {
      await tx.insert(schema.pageContentHistory).values({
        contentKey: current.key,
        previousContent: current.content,
      });
    }

    await tx.update(schema.pageContent).set({ content }).where(eq(schema.pageContent.id, id));
  });
}

/**
 * Restores a page content block from a history entry atomically.
 */
export async function restorePageContentFromHistory(id: string, historyId: string): Promise<void> {
  const [entry] = await db
    .select()
    .from(schema.pageContentHistory)
    .where(eq(schema.pageContentHistory.id, historyId))
    .limit(1);

  if (!entry) throw new Error('History entry not found.');
  if (isOnboardingFormKey(entry.contentKey)) throw new Error(ONBOARDING_FORM_PAGE_CONTENT_ERROR);

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ content: schema.pageContent.content, key: schema.pageContent.key })
      .from(schema.pageContent)
      .where(eq(schema.pageContent.id, id))
      .limit(1);

    if (!current) throw new Error('Content block not found.');
    if (isOnboardingFormKey(current.key)) throw new Error(ONBOARDING_FORM_PAGE_CONTENT_ERROR);
    if (current.key !== entry.contentKey) {
      throw new Error('History entry does not belong to this content block.');
    }

    await tx.insert(schema.pageContentHistory).values({
      contentKey: current.key,
      previousContent: current.content,
    });

    await tx
      .update(schema.pageContent)
      .set({ content: entry.previousContent })
      .where(eq(schema.pageContent.id, id));
  });
}

export const getCachedHomepageGallery = unstable_cache(
  async () => {
    const active = and(eq(schema.galleryImages.isActive, true), isNull(schema.galleryImages.deletedAt));
    const order = [asc(schema.galleryImages.displayOrder), asc(schema.galleryImages.createdAt)] as const;
    const rows = await withThumbnailColumnFallback(
      () =>
        db
          .select({
            id: schema.galleryImages.id,
            src: schema.galleryImages.src,
            thumbnailUrl: schema.galleryImages.thumbnailUrl,
            caption: schema.galleryImages.caption,
          })
          .from(schema.galleryImages)
          .where(active)
          .orderBy(...order),
      async () =>
        (
          await db
            .select({
              id: schema.galleryImages.id,
              src: schema.galleryImages.src,
              caption: schema.galleryImages.caption,
            })
            .from(schema.galleryImages)
            .where(active)
            .orderBy(...order)
        ).map((row) => ({ ...row, thumbnailUrl: null as string | null })),
    );

    // Defensive de-dupe: bad data entry has occasionally produced two active rows
    // for the same set pointing at the same underlying image file (by basename).
    // Silently drop the later duplicate so the homepage doesn't render the same
    // photo twice. Deliberately NOT keyed on display_order: it defaults to 0 in
    // both the schema and the admin upload form, so distinct images routinely
    // share a slot. The real fix is cleaning up the gallery_images table; this
    // just guards presentation.
    const seenSrc = new Set<string>();
    const dedupedRows = rows.filter((row) => {
      const basename = row.src.split('/').pop() ?? row.src;
      const srcKey = basename;
      if (seenSrc.has(srcKey)) return false;
      seenSrc.add(srcKey);
      return true;
    });

    return {
      set1: dedupedRows.map((row) => ({
        id: row.id,
        src: row.src,
        thumbnailSrc: row.thumbnailUrl,
        alt: row.caption || 'EZ Esports gallery photo',
      })),
    };
  },
  ['homepage-gallery'],
  { tags: ['gallery-images'] }
);
