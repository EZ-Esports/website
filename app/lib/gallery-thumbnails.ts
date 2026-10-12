import { BUCKET, buildPublicObjectUrl, isLegacyThumbnailKey, isThumbnailKeyFor } from '@/app/lib/storage-constants';

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

/**
 * Public URLs a legacy thumbnail (`gallery/<rowId>/<name>_thumb.webp`, created by
 * the backfill for a root-level or static original) may legitimately have: the
 * configured project, or, when the row's `src` is itself an object in our bucket,
 * that src's origin. Never derived from anything the form posts.
 */
function legacyThumbnailUrls(src: string, thumbnailKey: string, supabaseUrl: string | undefined): string[] {
  const urls: string[] = [];
  const configured = buildPublicObjectUrl(supabaseUrl, BUCKET, thumbnailKey);
  if (configured) urls.push(configured);
  try {
    const parsed = new URL(src);
    if (parsed.pathname.startsWith(`/storage/v1/object/public/${BUCKET}/`)) {
      const fromSrc = buildPublicObjectUrl(parsed.origin, BUCKET, thumbnailKey);
      if (fromSrc) urls.push(fromSrc);
    }
  } catch {
    // Relative src (static asset): only the configured project applies.
  }
  return urls;
}

export function resolveGalleryThumbnail(opts: {
  src?: string | null;
  entityId: string | null | undefined;
  storageKey: string | null;
  rawThumbnailKey: string | null | undefined;
  rawThumbnailUrl: string | null | undefined;
  existing?: {
    src?: string | null;
    storageKey: string | null;
    thumbnailUrl: string | null;
    thumbnailStorageKey: string | null;
  } | null;
  /** Project URL used to validate legacy thumbnails; defaults to NEXT_PUBLIC_SUPABASE_URL. */
  supabaseUrl?: string;
}): GalleryThumbnailFields {
  const { src, entityId, storageKey, rawThumbnailKey, rawThumbnailUrl, existing } = opts;
  if (!storageKey) {
    // A legacy row (root-level or static original) has no own-folder storage key, yet
    // may carry a backfilled thumbnail. It is kept only while the image itself is
    // unchanged (same src as stored) and the stored pair still has exactly the shape
    // the backfill writes. Posted fields are ignored here, and a replaced image
    // (new src) never inherits the old thumbnail.
    if (
      existing &&
      src &&
      existing.src === src &&
      existing.thumbnailUrl &&
      isLegacyThumbnailKey(existing.thumbnailStorageKey, entityId) &&
      legacyThumbnailUrls(src, existing.thumbnailStorageKey, opts.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL).includes(
        existing.thumbnailUrl,
      )
    ) {
      return { thumbnailUrl: existing.thumbnailUrl, thumbnailStorageKey: existing.thumbnailStorageKey };
    }
    return NONE;
  }

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
