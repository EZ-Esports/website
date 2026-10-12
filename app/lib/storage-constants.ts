import { Permissions } from '@/app/lib/roles';

export const BUCKET = 'admin-uploads';

export const SECTION_PERMISSIONS = {
  gallery: Permissions.MANAGE_GALLERY,
  schools: Permissions.MANAGE_SCHOOLS,
  sponsors: Permissions.MANAGE_SPONSORS,
  leadership: Permissions.MANAGE_LEADERSHIP,
} as const;

export type UploadSection = keyof typeof SECTION_PERMISSIONS;

export const ALLOWED_UPLOAD_SECTIONS = Object.keys(SECTION_PERMISSIONS) as UploadSection[];

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

export const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB hard upload cap
export const MAX_RAW_INPUT_BYTES = 20 * 1024 * 1024; // 20 MB client-side raw input limit before compression
export const MAX_IMAGE_DIMENSION = 2048; // Max width/height for web-optimized assets
export const STORAGE_CACHE_CONTROL = '31536000'; // 1 year cache duration (seconds)

export interface StorageUploadOptions {
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

const SAFE_ID_REGEX = /^[0-9a-fA-F-]{36}$|^[a-zA-Z0-9_-]+$/;

/**
 * Validates and sanitizes an entityId.
 * Disallows path traversal (e.g. '..', '/', '\'), null bytes, and non-alphanumeric characters except '-' and '_'.
 * Returns the sanitized string, or null if the entityId is invalid.
 */
export function sanitizeEntityId(entityId: string | null | undefined): string | null {
  if (!entityId || typeof entityId !== 'string') return null;
  const trimmed = entityId.trim();
  if (!trimmed) return null;
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) {
    return null;
  }
  if (!SAFE_ID_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function isValidSection(section: unknown): section is UploadSection {
  return typeof section === 'string' && Object.prototype.hasOwnProperty.call(SECTION_PERMISSIONS, section);
}

/**
 * Builds a deterministic scoped storage key for an entity asset:
 * `${section}/${entityId}/${timestamp}.${ext}`
 */
export function buildStorageKey(
  section: UploadSection,
  entityId: string,
  ext: string,
  timestamp: number = Date.now(),
): string {
  const safeId = sanitizeEntityId(entityId);
  if (!safeId) {
    throw new Error(`Invalid entityId for storage key: ${entityId}`);
  }
  const cleanExt = ext.replace(/^\.+/, '').toLowerCase();
  return `${section}/${safeId}/${timestamp}.${cleanExt}`;
}

/** Suffix that marks a thumbnail object stored beside its full-size original. */
export const THUMBNAIL_KEY_SUFFIX = '_thumb';
export const THUMBNAIL_EXT = 'webp';

/**
 * Deterministic thumbnail key for a full-size storage key: the thumbnail lives in
 * the same entity folder as the original (`gallery/<id>/<ts>.webp` ->
 * `gallery/<id>/<ts>_thumb.webp`). Keeping it in that folder means the existing
 * folder-scoped cleanup removes both objects together, and the key can always be
 * recomputed from the original so a client never needs to be trusted for it.
 */
export function deriveThumbnailKey(storageKey: string): string {
  const slash = storageKey.lastIndexOf('/');
  const dot = storageKey.lastIndexOf('.');
  const base = dot > slash ? storageKey.slice(0, dot) : storageKey;
  return `${base}${THUMBNAIL_KEY_SUFFIX}.${THUMBNAIL_EXT}`;
}

/**
 * True when `thumbnailKey` is exactly the thumbnail key derived from `storageKey`
 * and both are scoped to the given entity folder.
 */
export function isThumbnailKeyFor(
  thumbnailKey: string | null | undefined,
  storageKey: string | null | undefined,
  section: UploadSection,
  entityId: string | null | undefined,
): thumbnailKey is string {
  if (!thumbnailKey || !storageKey) return false;
  if (!isKeyScopedToEntity(storageKey, section, entityId)) return false;
  if (!isKeyScopedToEntity(thumbnailKey, section, entityId)) return false;
  return thumbnailKey === deriveThumbnailKey(storageKey);
}

/**
 * Checks whether a given storageKey is strictly scoped to the expected section and entity.
 */
export function isKeyScopedToEntity(
  key: string | null | undefined,
  section: UploadSection,
  entityId: string | null | undefined,
): boolean {
  if (!key || !entityId) return false;
  const safeId = sanitizeEntityId(entityId);
  if (!safeId) return false;
  const expectedPrefix = `${section}/${safeId}/`;
  if (!key.startsWith(expectedPrefix)) return false;

  // Ensure key doesn't attempt traversal after prefix
  const relative = key.slice(expectedPrefix.length);
  if (!relative || relative.includes('/') || relative.includes('\\') || relative.includes('..')) {
    return false;
  }
  return true;
}

/** Longest basename kept when naming a legacy thumbnail (keeps keys well under storage limits). */
const LEGACY_THUMBNAIL_NAME_MAX = 80;

/**
 * Thumbnail key for a gallery original that does NOT live in its own folder
 * (legacy root-level uploads, or static files in `public/`). The thumbnail goes
 * in the row's own `gallery/<rowId>/` folder, which is the only place the
 * folder-scoped cleanup and the server-side validation expect to find it.
 *
 * The original's basename is reduced to `[A-Za-z0-9_-]` (runs of anything else,
 * including dots and non-ASCII, collapse to `-`) so the result can never carry
 * traversal, a query/fragment, a second extension, or a character Storage and
 * the public URL would disagree about. One row has one original, so a name
 * collision inside a row's folder cannot happen.
 */
export function deriveLegacyThumbnailKey(rowId: string, originalName: string): string {
  const safeId = sanitizeEntityId(rowId);
  if (!safeId) throw new Error(`Invalid row id for thumbnail key: ${rowId}`);
  const lastSegment = originalName.split(/[\/]/).pop() ?? '';
  const dot = lastSegment.lastIndexOf('.');
  const stem = dot > 0 ? lastSegment.slice(0, dot) : lastSegment;
  const cleaned = stem
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LEGACY_THUMBNAIL_NAME_MAX)
    .replace(/-+$/, '');
  return `gallery/${safeId}/${cleaned || 'image'}${THUMBNAIL_KEY_SUFFIX}.${THUMBNAIL_EXT}`;
}

const LEGACY_THUMBNAIL_FILE = /^[A-Za-z0-9_-]+_thumb\.webp$/;

/**
 * True for a thumbnail key shaped like deriveLegacyThumbnailKey()'s output for
 * this row: inside `gallery/<rowId>/`, a single safe `<name>_thumb.webp` segment.
 * Anything with `/`, `\`, `..`, `%`, `?` or `#` fails the character class.
 */
export function isLegacyThumbnailKey(key: string | null | undefined, entityId: string | null | undefined): key is string {
  if (!key || !isKeyScopedToEntity(key, 'gallery', entityId)) return false;
  return LEGACY_THUMBNAIL_FILE.test(key.slice(key.lastIndexOf('/') + 1));
}

/**
 * Public URL of an object, in the same form `getPublicUrl` returns
 * (`<project>/storage/v1/object/public/<bucket>/<key>`). Null when the project
 * URL is missing or not http(s).
 */
export function buildPublicObjectUrl(supabaseUrl: string | null | undefined, bucket: string, key: string): string | null {
  if (!supabaseUrl) return null;
  let origin: string;
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    origin = url.origin;
  } catch {
    return null;
  }
  return `${origin}/storage/v1/object/public/${bucket}/${encodeURI(key)}`;
}
