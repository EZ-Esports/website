import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { uploadToStorage, requirePermission } = vi.hoisted(() => ({
  uploadToStorage: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock('@/app/lib/rate-limit', () => ({
  rateLimit: () => ({ allowed: true, resetInMs: 0 }),
  getClientIp: () => '127.0.0.1',
}));
vi.mock('@/app/lib/auth', () => ({ requirePermission }));
vi.mock('@/app/lib/storage', () => ({ uploadToStorage, STORAGE_CACHE_CONTROL: '31536000' }));

import { POST } from '../route';
import { Permissions } from '@/app/lib/roles';

function request(bytes: Uint8Array, name = 'handbook.pdf', type = 'application/pdf') {
  const fd = new FormData();
  fd.append('file', new File([bytes as BlobPart], name, { type }));
  return new NextRequest('http://localhost/api/handbook', { method: 'POST', body: fd });
}

const pdf = new TextEncoder().encode('%PDF-1.7 hello');

describe('POST /api/handbook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue({ id: 'staff' });
    uploadToStorage.mockImplementation(async (key: string) => ({ data: {}, error: null, publicUrl: `https://cdn.example/${key}` }));
  });

  it('requires MANAGE_CONTENT and uploads nothing without it', async () => {
    requirePermission.mockRejectedValue(new Error('Forbidden'));
    const res = await POST(request(pdf));
    expect(res.status).toBe(403);
    expect(requirePermission).toHaveBeenCalledWith(Permissions.MANAGE_CONTENT);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it('stores a valid PDF under handbook/ as application/pdf', async () => {
    const res = await POST(request(pdf));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.storageKey).toMatch(/^handbook\/\d+\.pdf$/);
    expect(uploadToStorage.mock.calls[0][2]).toMatchObject({ contentType: 'application/pdf', upsert: false });
  });

  it('rejects a file that claims to be a PDF but is not', async () => {
    const res = await POST(request(new TextEncoder().encode('<html></html>')));
    expect(res.status).toBe(400);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it('rejects non-PDF uploads and oversized files', async () => {
    expect((await POST(request(pdf, 'a.png', 'image/png'))).status).toBe(400);
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    big.set(pdf);
    expect((await POST(request(big))).status).toBe(400);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it('returns 500 when storage fails', async () => {
    uploadToStorage.mockResolvedValue({ data: null, error: new Error('boom'), publicUrl: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await POST(request(pdf))).status).toBe(500);
  });
});
