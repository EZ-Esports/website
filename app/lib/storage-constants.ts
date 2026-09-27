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
