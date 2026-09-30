import { describe, it, expect, vi } from 'vitest';
import { Permissions } from '@/app/lib/roles';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_RAW_INPUT_BYTES,
  MAX_IMAGE_DIMENSION,
  STORAGE_CACHE_CONTROL,
  MIME_TO_EXT,
  SECTION_PERMISSIONS,
  ALLOWED_UPLOAD_SECTIONS,
  isValidSection,
  sanitizeEntityId,
  buildStorageKey,
  isKeyScopedToEntity,
  uploadToStorage,
} from '@/app/lib/storage';

const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null });
const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test.jpg' } });

vi.mock('@/app/lib/supabase/service', () => ({
  createServiceClient: () => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
  }),
}));

describe('Image upload validation & constraints', () => {
  it('accepts standard web image MIME types', () => {
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
    expect(ALLOWED_MIME_TYPES).toContain('image/png');
    expect(ALLOWED_MIME_TYPES).toContain('image/gif');
    expect(ALLOWED_MIME_TYPES).toContain('image/webp');
  });

  it('rejects executable and vector SVG types to prevent XSS', () => {
    // @ts-expect-error testing invalid type
    expect(ALLOWED_MIME_TYPES.includes('image/svg+xml')).toBe(false);
    // @ts-expect-error testing invalid type
    expect(ALLOWED_MIME_TYPES.includes('application/pdf')).toBe(false);
    // @ts-expect-error testing invalid type
    expect(ALLOWED_MIME_TYPES.includes('text/html')).toBe(false);
    // @ts-expect-error testing invalid type
    expect(ALLOWED_MIME_TYPES.includes('application/javascript')).toBe(false);
  });

  it('enforces a 5 MB file size limit', () => {
    const validSize = 4.9 * 1024 * 1024;
    const oversized = 5.1 * 1024 * 1024;
    expect(validSize <= MAX_FILE_SIZE_BYTES).toBe(true);
    expect(oversized <= MAX_FILE_SIZE_BYTES).toBe(false);
  });

  it('maps MIME types correctly to extensions', () => {
    expect(MIME_TO_EXT['image/jpeg']).toBe('jpg');
    expect(MIME_TO_EXT['image/png']).toBe('png');
    expect(MIME_TO_EXT['image/gif']).toBe('gif');
    expect(MIME_TO_EXT['image/webp']).toBe('webp');
  });
});

describe('Section-specific authorization mapping', () => {
  it('enforces explicit permissions for each allowed section', () => {
    expect(SECTION_PERMISSIONS.gallery).toBe(Permissions.MANAGE_GALLERY);
    expect(SECTION_PERMISSIONS.schools).toBe(Permissions.MANAGE_SCHOOLS);
    expect(SECTION_PERMISSIONS.sponsors).toBe(Permissions.MANAGE_SPONSORS);
    expect(SECTION_PERMISSIONS.leadership).toBe(Permissions.MANAGE_LEADERSHIP);
  });

  it('validates only allowed sections', () => {
    for (const section of ALLOWED_UPLOAD_SECTIONS) {
      expect(isValidSection(section)).toBe(true);
    }

    expect(isValidSection('admin')).toBe(false);
    expect(isValidSection('users')).toBe(false);
    expect(isValidSection('profile')).toBe(false);
    expect(isValidSection('')).toBe(false);
    expect(isValidSection(null)).toBe(false);
    expect(isValidSection(undefined)).toBe(false);
    expect(isValidSection('../gallery')).toBe(false);
  });
});

describe('Deterministic storage key format', () => {
  it('formats keys strictly as ${section}/${entityId}/${timestamp}.${ext}', () => {
    const section = 'leadership';
    const entityId = '550e8400-e29b-41d4-a716-446655440000';
    const ext = 'webp';
    const timestamp = 1718000000000;

    const key = buildStorageKey(section, entityId, ext, timestamp);

    expect(key).toBe('leadership/550e8400-e29b-41d4-a716-446655440000/1718000000000.webp');
    expect(key).toMatch(/^(gallery|schools|sponsors|leadership)\/[0-9a-fA-F-]{36}\/\d+\.(jpg|png|gif|webp)$/);
  });

  it('supports alphanumeric entity IDs and strips leading dots on ext', () => {
    const key = buildStorageKey('schools', 'school-123_abc', '.png', 1700000000000);
    expect(key).toBe('schools/school-123_abc/1700000000000.png');
  });

  it('throws when building key with invalid entityId', () => {
    expect(() => buildStorageKey('schools', '../../hacked', 'png')).toThrow();
  });
});

describe('Path traversal prevention & entity scoping', () => {
  it('sanitizes and rejects path traversal sequences in entityId', () => {
    expect(sanitizeEntityId('valid-id-123')).toBe('valid-id-123');
    expect(sanitizeEntityId('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');

    // Traversal attempts
    expect(sanitizeEntityId('../secret')).toBe(null);
    expect(sanitizeEntityId('..')).toBe(null);
    expect(sanitizeEntityId('../../etc/passwd')).toBe(null);
    expect(sanitizeEntityId('foo/bar')).toBe(null);
    expect(sanitizeEntityId('foo\\bar')).toBe(null);
    expect(sanitizeEntityId('foo\0bar')).toBe(null);
    expect(sanitizeEntityId('foo/../bar')).toBe(null);
    expect(sanitizeEntityId('   ')).toBe(null);
    expect(sanitizeEntityId('')).toBe(null);
    expect(sanitizeEntityId(null)).toBe(null);
    expect(sanitizeEntityId(undefined)).toBe(null);
  });

  it('verifies that keys are strictly scoped to the specific entity folder', () => {
    const section = 'schools';
    const entityId = 'school-abc-123';
    const validKey = 'schools/school-abc-123/1718000000000.png';

    expect(isKeyScopedToEntity(validKey, section, entityId)).toBe(true);

    // Cross-section forgery
    expect(isKeyScopedToEntity('gallery/school-abc-123/1718000000000.png', section, entityId)).toBe(false);

    // Cross-entity forgery (e.g. gallery editor trying to delete school logo)
    expect(isKeyScopedToEntity('schools/other-school/1718000000000.png', section, entityId)).toBe(false);
    expect(isKeyScopedToEntity('schools/school-abc-123-sibling/1718000000000.png', section, entityId)).toBe(false);

    // Un-scoped legacy root keys
    expect(isKeyScopedToEntity('uuid.png', section, entityId)).toBe(false);

    // Nested traversal inside key
    expect(isKeyScopedToEntity('schools/school-abc-123/../other.png', section, entityId)).toBe(false);
    expect(isKeyScopedToEntity('schools/school-abc-123/nested/file.png', section, entityId)).toBe(false);

    // Empty or malformed
    expect(isKeyScopedToEntity('', section, entityId)).toBe(false);
    expect(isKeyScopedToEntity(null, section, entityId)).toBe(false);
    expect(isKeyScopedToEntity(undefined, section, entityId)).toBe(false);
  });
});

describe('Storage cache control & bandwidth mitigation constraints', () => {
  it('defines 1-year (31536000s) default cache-control header for immutable assets', () => {
    expect(STORAGE_CACHE_CONTROL).toBe('31536000');
  });

  it('defines 2048px maximum dimension cap for web-optimized assets', () => {
    expect(MAX_IMAGE_DIMENSION).toBe(2048);
  });

  it('defines 20 MB client-side raw input limit before compression', () => {
    expect(MAX_RAW_INPUT_BYTES).toBe(20 * 1024 * 1024);
  });

  it('uploadToStorage attaches cacheControl header and returns publicUrl', async () => {
    mockUpload.mockClear();
    mockGetPublicUrl.mockClear();

    const buffer = new Uint8Array([1, 2, 3]).buffer;
    const result = await uploadToStorage('gallery/test/123.jpg', buffer, {
      contentType: 'image/jpeg',
    });

    expect(mockUpload).toHaveBeenCalledWith(
      'gallery/test/123.jpg',
      buffer,
      {
        contentType: 'image/jpeg',
        upsert: false,
        cacheControl: '31536000',
      },
    );
    expect(result.error).toBe(null);
    expect(result.publicUrl).toBe('https://example.com/test.jpg');
  });

  it('uploadToStorage supports custom cacheControl and upsert flags', async () => {
    mockUpload.mockClear();

    const buffer = new Uint8Array([4, 5, 6]).buffer;
    await uploadToStorage('sponsors/logo/456.png', buffer, {
      contentType: 'image/png',
      upsert: true,
      cacheControl: '86400',
    });

    expect(mockUpload).toHaveBeenCalledWith(
      'sponsors/logo/456.png',
      buffer,
      {
        contentType: 'image/png',
        upsert: true,
        cacheControl: '86400',
      },
    );
  });

  it('uploadToStorage returns error when Supabase upload fails', async () => {
    mockUpload.mockResolvedValueOnce({ data: null, error: { message: 'Network error' } });

    const buffer = new Uint8Array([7, 8, 9]).buffer;
    const result = await uploadToStorage('schools/school-1/error.jpg', buffer, {
      contentType: 'image/jpeg',
    });

    expect(result.error).toEqual({ message: 'Network error' });
    expect(result.publicUrl).toBe(null);
  });
});

