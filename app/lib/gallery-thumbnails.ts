import { isThumbnailKeyFor } from '@/app/lib/storage-constants';

export interface GalleryThumbnailFields {
  thumbnailUrl: string | null;
  thumbnailStorageKey: string | null;
}

const NONE: GalleryThumbnailFields = { thumbnailUrl: null, thumbnailStorageKey: null };

/**
 * Decides which thumbnail columns a gallery write may persist.
 *
 * Form fields come from hidden inputs, so they are only accepted when the key is
 * exactly the one derived from the row's own (already validated) storage key and
 * the URL is the row's own `src` with that key swapped in (same origin and bucket
 * path), so a thumbnail can never point at another host or bucket. Anything else collapses to "no thumbnail", and readers
 * fall back to the full image — a bad value can degrade performance, never point a
 * row at another entity's object.
 *
 * When the full-size image is unchanged, an existing thumbnail is kept even if the
 * form posted none: the edit form can be stale relative to a backfill that ran
 * while it was open, and a caption edit must not discard the thumbnail.
 */
/** The public URL of `thumbnailKey`, derived by swapping it into `src`; null if `src` isn't the object at `storageKey`. */
export function deriveThumbnailUrl(src: string, storageKey: string, thumbnailKey: string): string | null {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  const suffix = `/${storageKey}`;
  if (!url.pathname.endsWith(suffix)) return null;
  url.pathname = `${url.pathname.slice(0, -suffix.length)}/${thumbnailKey}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function resolveGalleryThumbnail(opts: {
  src?: string | null;
  entityId: string | null | undefined;
  storageKey: string | null;
  rawThumbnailKey: string | null | undefined;
  rawThumbnailUrl: string | null | undefined;
  existing?: { storageKey: string | null; thumbnailUrl: string | null; thumbnailStorageKey: string | null } | null;
}): GalleryThumbnailFields {
  const { src, entityId, storageKey, rawThumbnailKey, rawThumbnailUrl, existing } = opts;
  if (!storageKey) return NONE;

  if (
    isThumbnailKeyFor(rawThumbnailKey, storageKey, 'gallery', entityId) &&
    rawThumbnailUrl &&
    src &&
    rawThumbnailUrl === deriveThumbnailUrl(src, storageKey, rawThumbnailKey!)
  ) {
    return { thumbnailUrl: rawThumbnailUrl, thumbnailStorageKey: rawThumbnailKey };
  }

  if (
    existing &&
    existing.storageKey === storageKey &&
    existing.thumbnailUrl &&
    isThumbnailKeyFor(existing.thumbnailStorageKey, storageKey, 'gallery', entityId)
  ) {
    return { thumbnailUrl: existing.thumbnailUrl, thumbnailStorageKey: existing.thumbnailStorageKey };
  }

  return NONE;
}
