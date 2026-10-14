import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';
import { NextRequest } from 'next/server';

const { uploadToStorage, removeFromStorage, requirePermission } = vi.hoisted(() => ({
  uploadToStorage: vi.fn(),
  removeFromStorage: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock('@/app/lib/rate-limit', () => ({
  rateLimit: () => ({ allowed: true, resetInMs: 0 }),
  getClientIp: () => '127.0.0.1',
}));
vi.mock('@/app/lib/auth', () => ({ requirePermission }));
vi.mock('@/app/lib/storage', async () => {
  const constants = await vi.importActual<typeof import('@/app/lib/storage-constants')>('@/app/lib/storage-constants');
  return { ...constants, uploadToStorage, removeFromStorage };
});

import { POST } from '../route';

const ID = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

async function jpeg(width = 1600, height = 900) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 90 } } })
    .jpeg()
    .toBuffer();
}

function request(file: Buffer, type: string, fields: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append('file', new File([new Uint8Array(file)], 'photo', { type }));
  fd.append('section', fields.section ?? 'gallery');
  fd.append('entityId', fields.entityId ?? ID);
  return new NextRequest('http://localhost/api/upload', { method: 'POST', body: fd });
}

describe('POST /api/upload (gallery thumbnails)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue({ id: 'staff' });
    removeFromStorage.mockResolvedValue({ error: null });
    uploadToStorage.mockImplementation(async (key: string) => ({
      data: { path: key },
      error: null,
      publicUrl: `https://cdn.example/${key}`,
    }));
  });

  it('uploads the full image and a WebP thumbnail beside it, both with the 1-year cache header', async () => {
    const res = await POST(request(await jpeg(), 'image/jpeg'));
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(uploadToStorage).toHaveBeenCalledTimes(2);
    const [fullKey, fullData, fullOpts] = uploadToStorage.mock.calls[0];
    const [thumbKey, thumbData, thumbOpts] = uploadToStorage.mock.calls[1];

    expect(fullKey).toMatch(new RegExp(`^gallery/${ID}/\\d+\\.jpg$`));
    expect(fullOpts).toMatchObject({ contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
    expect(thumbKey).toBe(fullKey.replace(/\.jpg$/, '_thumb.webp'));
    expect(thumbOpts).toMatchObject({ contentType: 'image/webp', cacheControl: '31536000', upsert: false });

    const meta = await sharp(thumbData as Buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(640);
    expect((fullData as ArrayBuffer).byteLength).toBeGreaterThan((thumbData as Buffer).byteLength);

    expect(body).toEqual({
      url: `https://cdn.example/${fullKey}`,
      storageKey: fullKey,
      thumbnailUrl: `https://cdn.example/${thumbKey}`,
      thumbnailStorageKey: thumbKey,
    });
  });

  it('rolls back the full-size object when the thumbnail upload fails', async () => {
    uploadToStorage
      .mockResolvedValueOnce({ data: {}, error: null, publicUrl: 'https://cdn.example/full' })
      .mockResolvedValueOnce({ data: null, error: new Error('boom'), publicUrl: null });

    const res = await POST(request(await jpeg(), 'image/jpeg'));

    expect(res.status).toBe(500);
    const fullKey = uploadToStorage.mock.calls[0][0];
    expect(removeFromStorage).toHaveBeenCalledWith([fullKey]);
  });

  it('writes nothing when the full-size upload fails (and never tries the thumbnail)', async () => {
    uploadToStorage.mockResolvedValueOnce({ data: null, error: new Error('nope'), publicUrl: null });
    const res = await POST(request(await jpeg(), 'image/jpeg'));
    expect(res.status).toBe(500);
    expect(uploadToStorage).toHaveBeenCalledTimes(1);
    expect(removeFromStorage).not.toHaveBeenCalled();
  });

  it('skips the thumbnail for GIFs and returns null thumbnail fields', async () => {
    const gif = await sharp(await jpeg(64, 64)).gif().toBuffer();
    const res = await POST(request(gif, 'image/gif'));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(uploadToStorage).toHaveBeenCalledTimes(1);
    expect(body.thumbnailUrl).toBeNull();
    expect(body.thumbnailStorageKey).toBeNull();
    expect(body.storageKey).toMatch(/\.gif$/);
  });

  it('rejects bytes that are not an image before writing anything', async () => {
    const res = await POST(request(Buffer.from('<html>not an image</html>'), 'image/jpeg'));
    expect(res.status).toBe(400);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it('rejects an SVG labelled as image/png before writing anything, in every section', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    for (const section of ['gallery', 'sponsors']) {
      const res = await POST(request(svg, 'image/png', { section }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/JPEG, PNG, WebP or GIF/);
    }
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it('rejects a TIFF labelled as image/jpeg before writing anything', async () => {
    const tiff = await sharp(await jpeg(64, 64)).tiff().toBuffer();
    const res = await POST(request(tiff, 'image/jpeg'));
    expect(res.status).toBe(400);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it('returns a clean 400 for an image over the pixel limit, without touching storage', async () => {
    const big = await sharp({ create: { width: 7200, height: 7200, channels: 3, background: '#000' } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(big.length).toBeLessThan(5 * 1024 * 1024);
    const res = await POST(request(big, 'image/png'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/too many pixels/i);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it('does not generate thumbnails for non-gallery sections', async () => {
    const res = await POST(request(await jpeg(), 'image/jpeg', { section: 'sponsors' }));
    expect(res.status).toBe(201);
    expect(uploadToStorage).toHaveBeenCalledTimes(1);
    expect((await res.json()).thumbnailStorageKey).toBeNull();
  });

  it('still enforces permissions before touching storage', async () => {
    requirePermission.mockRejectedValueOnce(new Error('denied'));
    const res = await POST(request(await jpeg(), 'image/jpeg'));
    expect(res.status).toBe(403);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it('still rejects unsafe entity ids', async () => {
    const res = await POST(request(await jpeg(), 'image/jpeg', { entityId: '../evil' }));
    expect(res.status).toBe(400);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });
});
