import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { STUDENT_ID_MAX_BYTES, isStudentIdStorageKey } from '@/app/lib/onboarding/student-id';

const mocks = vi.hoisted(() => ({
  findInviteByTokenHash: vi.fn(),
  replacePendingUpload: vi.fn(),
  deleteUploadRowByKey: vi.fn(),
  putStudentId: vi.fn(),
  removeStudentIds: vi.fn(),
  sweep: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock('@/app/lib/db/onboarding', () => ({ findInviteByTokenHash: mocks.findInviteByTokenHash }));
vi.mock('@/app/lib/db/student-ids', () => ({
  replacePendingUpload: mocks.replacePendingUpload,
  deleteUploadRowByKey: mocks.deleteUploadRowByKey,
}));
vi.mock('@/app/lib/onboarding/student-id-storage', () => ({
  putStudentId: mocks.putStudentId,
  removeStudentIds: mocks.removeStudentIds,
}));
vi.mock('@/app/lib/onboarding/student-id-sweep', () => ({ sweepOrphanStudentIds: mocks.sweep }));
vi.mock('@/app/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit, getClientIp: () => '203.0.113.9' }));

const { POST } = await import('../route');

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function request(fields: { token?: string; file?: File | string | null }, headers: Record<string, string> = {}) {
  const form = new FormData();
  if (fields.token !== undefined) form.set('token', fields.token);
  if (fields.file !== undefined && fields.file !== null) form.set('file', fields.file);
  return new NextRequest('http://localhost/api/onboarding/student-id', { method: 'POST', body: form, headers });
}

const pendingInvite = (over: Record<string, unknown> = {}) => ({
  kind: 'player' as const,
  invite: { id: 'invite-1', status: 'pending', expiresAt: new Date(Date.now() + 86_400_000), ...over },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockReturnValue({ allowed: true, remaining: 9, resetInMs: 0 });
  mocks.findInviteByTokenHash.mockResolvedValue(pendingInvite());
  mocks.putStudentId.mockResolvedValue({ error: null });
  mocks.replacePendingUpload.mockResolvedValue({ replacedKey: null });
  mocks.removeStudentIds.mockResolvedValue(true);
  mocks.deleteUploadRowByKey.mockResolvedValue(undefined);
});

describe('POST /api/onboarding/student-id', () => {
  it('stores a valid image under a random key and records it against the invite', async () => {
    const res = await POST(request({ token: 'tok-1', file: new File([JPEG], 'my student id.JPG', { type: 'image/jpeg' }) }));
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('private, no-store');

    const hash = crypto.createHash('sha256').update('tok-1').digest('hex');
    expect(mocks.findInviteByTokenHash).toHaveBeenCalledWith(hash);

    const [key, , contentType] = mocks.putStudentId.mock.calls[0];
    expect(isStudentIdStorageKey(key)).toBe(true);
    // Nothing from the file name reaches the key.
    expect(key).not.toMatch(/student|my/i);
    expect(contentType).toBe('image/jpeg');
    expect(mocks.replacePendingUpload).toHaveBeenCalledWith('player', 'invite-1', {
      storageKey: key,
      contentType: 'image/jpeg',
      sizeBytes: JPEG.length,
    });
  });

  it('uses the detected type, not the file name or declared content type', async () => {
    // A PNG uploaded as "id.jpg" with a lying Content-Type is stored (and keyed) as PNG.
    const res = await POST(request({ token: 't', file: new File([PNG], 'id.jpg', { type: 'image/jpeg' }) }));
    expect(res.status).toBe(201);
    const [key, , contentType] = mocks.putStudentId.mock.calls[0];
    expect(key.endsWith('.png')).toBe(true);
    expect(contentType).toBe('image/png');
  });

  it('rejects a file with an image extension and Content-Type but the wrong magic bytes, writing nothing', async () => {
    const fake = new File([new TextEncoder().encode('<html><script>alert(1)</script></html>')], 'id.jpg', { type: 'image/jpeg' });
    const res = await POST(request({ token: 't', file: fake }));
    expect(res.status).toBe(400);
    expect(mocks.putStudentId).not.toHaveBeenCalled();
    expect(mocks.replacePendingUpload).not.toHaveBeenCalled();
  });

  it('rejects an oversized file and a declared oversized body before parsing', async () => {
    const big = new File([new Uint8Array(STUDENT_ID_MAX_BYTES + 1).fill(0xff)], 'id.jpg', { type: 'image/jpeg' });
    expect((await POST(request({ token: 't', file: big }))).status).toBe(400);
    const declared = await POST(request({ token: 't', file: new File([JPEG], 'a.jpg') }, { 'content-length': String(STUDENT_ID_MAX_BYTES * 3) }));
    expect(declared.status).toBe(413);
    expect(mocks.putStudentId).not.toHaveBeenCalled();
  });

  it('is bound to the invite: an unknown token, a missing token or a non-file part writes nothing', async () => {
    mocks.findInviteByTokenHash.mockResolvedValue(undefined);
    expect((await POST(request({ token: 'nope', file: new File([JPEG], 'a.jpg') }))).status).toBe(404);
    expect((await POST(request({ file: new File([JPEG], 'a.jpg') }))).status).toBe(404);
    mocks.findInviteByTokenHash.mockResolvedValue(pendingInvite());
    expect((await POST(request({ token: 't', file: 'not a file' }))).status).toBe(400);
    expect(mocks.putStudentId).not.toHaveBeenCalled();
  });

  it.each([
    ['accepted', { status: 'accepted' }, 409],
    ['submitted', { status: 'submitted' }, 409],
    ['expired by date', { expiresAt: new Date(Date.now() - 1000) }, 410],
  ])('refuses uploads for an invite that is %s', async (_label, over, status) => {
    mocks.findInviteByTokenHash.mockResolvedValue(pendingInvite(over));
    const res = await POST(request({ token: 't', file: new File([JPEG], 'a.jpg') }));
    expect(res.status).toBe(status);
    expect(mocks.putStudentId).not.toHaveBeenCalled();
  });

  it('records a manager invite under the manager kind', async () => {
    mocks.findInviteByTokenHash.mockResolvedValue({ ...pendingInvite(), kind: 'manager' });
    await POST(request({ token: 't', file: new File([JPEG], 'a.jpg') }));
    expect(mocks.replacePendingUpload).toHaveBeenCalledWith('manager', 'invite-1', expect.any(Object));
  });

  it('deletes the earlier photo of the same invite when it is replaced', async () => {
    mocks.replacePendingUpload.mockResolvedValue({ replacedKey: 'old-key.jpg' });
    await POST(request({ token: 't', file: new File([JPEG], 'a.jpg') }));
    expect(mocks.removeStudentIds).toHaveBeenCalledWith(['old-key.jpg']);
  });

  it('removes the just-uploaded object when it cannot be recorded, so no unowned photo is left', async () => {
    mocks.replacePendingUpload.mockRejectedValue(new Error('db down'));
    const res = await POST(request({ token: 't', file: new File([JPEG], 'a.jpg') }));
    expect(res.status).toBe(500);
    const [key] = mocks.putStudentId.mock.calls[0];
    expect(mocks.removeStudentIds).toHaveBeenCalledWith([key]);
    expect(mocks.deleteUploadRowByKey).toHaveBeenCalledWith(key);
  });

  it('rate limits per IP', async () => {
    mocks.rateLimit.mockReturnValue({ allowed: false, remaining: 0, resetInMs: 30_000 });
    const res = await POST(request({ token: 't', file: new File([JPEG], 'a.jpg') }));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
    expect(mocks.findInviteByTokenHash).not.toHaveBeenCalled();
  });
});
