import { BUCKET, buildPublicObjectUrl, isLegacyThumbnailKey, isThumbnailKeyFor } from '@/app/lib/storage-constants';

export interface GalleryThumbnailFields {
  thumbnailUrl: string | null;
  thumbnailStorageKey: string | null;
}

const NONE: GalleryThumbnailFields = { thumbnailUrl: null, thumbnailStorageKey: null };

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

/**
 * Decides which thumbnail columns a gallery write may persist.
 *
 * The posted thumbnail key (a hidden input, the only thumbnail field the client
 * sends) is accepted only when it is exactly the key derived from the row's own
 * (already validated) storage key. The public URL is then derived server-side as the
 * row's own `src` with that key swapped in (same origin and bucket path), so a
 * thumbnail can never point at another host or bucket. Anything else collapses to "no thumbnail", and readers
 * fall back to the full image — a bad value can degrade performance, never point a
 * row at another entity's object.
 *
 * When the full-size image is unchanged, an existing thumbnail is kept even if the
 * form posted none: the edit form can be stale relative to a backfill that ran
 * while it was open, and a caption edit must not discard the thumbnail.
 */
export function resolveGalleryThumbnail(opts: {
  src?: string | null;
  entityId: string | null | undefined;
  storageKey: string | null;
  rawThumbnailKey: string | null | undefined;
  existing?: {
    src?: string | null;
    storageKey: string | null;
    thumbnailUrl: string | null;
    thumbnailStorageKey: string | null;
  } | null;
  /** Project URL used to validate legacy thumbnails; defaults to NEXT_PUBLIC_SUPABASE_URL. */
  supabaseUrl?: string;
}): GalleryThumbnailFields {
  const { src, entityId, storageKey, rawThumbnailKey, existing } = opts;
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

  // The URL is never taken from the form: it is derived here from the row's own src.
  if (src && isThumbnailKeyFor(rawThumbnailKey, storageKey, 'gallery', entityId)) {
    const thumbnailUrl = deriveThumbnailUrl(src, storageKey, rawThumbnailKey);
    if (thumbnailUrl) return { thumbnailUrl, thumbnailStorageKey: rawThumbnailKey };
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

/**
 * Server-side check that a posted gallery `src` points at our own Supabase
 * bucket (`<project>/storage/v1/object/public/<bucket>/...`), https only, no
 * credentials/query/hash. The project origin comes from config, never the form.
 * When the row has an own-folder `storageKey`, `src` must be exactly that
 * object's public URL. An unchanged `src` (equal to the row's stored one) is
 * always accepted so legacy rows (static `/images/gallery/*` paths, old hosts)
 * stay editable. Returns a user-facing error, or null when acceptable.
 */
export function validateGalleryImageSrc(opts: {
  src: string;
  storageKey: string | null;
  existingSrc?: string | null;
  supabaseUrl?: string;
}): string | null {
  const { src, storageKey, existingSrc } = opts;
  if (existingSrc && src === existingSrc) return null;
  const invalid = 'The image must be uploaded through the uploader. Please upload it again.';
  const configured = opts.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prefix = buildPublicObjectUrl(configured, BUCKET, '');
  if (!prefix) return invalid;
  let url: URL;
  let allowed: URL;
  try {
    url = new URL(src);
    allowed = new URL(prefix);
  } catch {
    return invalid;
  }
  const loopback = allowed.hostname === 'localhost' || allowed.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) return invalid;
  if (url.origin !== allowed.origin) return invalid;
  if (url.username || url.password || url.search || url.hash) return invalid;
  if (!url.pathname.startsWith(allowed.pathname) || url.pathname.length === allowed.pathname.length) return invalid;
  if (storageKey && src !== buildPublicObjectUrl(configured, BUCKET, storageKey)) return invalid;
  return null;
}
