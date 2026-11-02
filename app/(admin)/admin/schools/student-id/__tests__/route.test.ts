import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Permissions } from '@/app/lib/roles';

const mocks = vi.hoisted(() => ({
  getStaffWithPermission: vi.fn(),
  findStudentIdKeyForMember: vi.fn(),
  signStudentIdUrl: vi.fn(),
  isLocal: vi.fn(),
  readLocal: vi.fn(),
  auditInsert: vi.fn(),
}));

vi.mock('@/app/lib/auth', () => ({ getStaffWithPermission: mocks.getStaffWithPermission }));
vi.mock('@/app/lib/db/student-ids', () => ({ findStudentIdKeyForMember: mocks.findStudentIdKeyForMember }));
vi.mock('@/app/lib/onboarding/student-id-storage', () => ({
  signStudentIdUrl: mocks.signStudentIdUrl,
  isLocalStudentIdStorage: mocks.isLocal,
  readLocalStudentId: mocks.readLocal,
}));
vi.mock('@/app/lib/db', () => ({ db: { insert: () => ({ values: mocks.auditInsert }) } }));

const { GET } = await import('../[memberId]/route');

const MEMBER = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const staff = { id: 'u1', email: 'staff@ezesports.org', permissions: 0n, isOwner: false, highestRolePosition: 1 };
const call = (memberId: string) =>
  GET(new NextRequest(`http://localhost/admin/schools/student-id/${memberId}`), { params: Promise.resolve({ memberId }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStaffWithPermission.mockResolvedValue(staff);
  mocks.findStudentIdKeyForMember.mockResolvedValue('3f2504e0-4f89-41d3-9a0c-0305e82c3302.jpg');
  mocks.signStudentIdUrl.mockResolvedValue('https://storage.example/sign/student-ids/x?token=abc');
  mocks.auditInsert.mockResolvedValue(undefined);
  mocks.isLocal.mockReturnValue(false);
});

describe('GET /admin/schools/student-id/[memberId]', () => {
  it('redirects authorized staff to a signed URL with no-store headers and audits the view', async () => {
    const res = await call(MEMBER);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://storage.example/sign/student-ids/x?token=abc');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({ event: 'student_id_viewed', userId: 'u1' }));
  });

  it('is open to roster staff or school-management staff, and to no one else', async () => {
    mocks.getStaffWithPermission.mockImplementation(async (perm: bigint) => (perm === Permissions.MANAGE_SCHOOLS ? staff : null));
    expect((await call(MEMBER)).status).toBe(303);
    mocks.getStaffWithPermission.mockImplementation(async (perm: bigint) => (perm === Permissions.MANAGE_ROSTERS ? staff : null));
    expect((await call(MEMBER)).status).toBe(303);
  });

  it('returns 403 and touches neither the database nor Storage for a non-staff or unauthorized caller', async () => {
    mocks.getStaffWithPermission.mockResolvedValue(null);
    const res = await call(MEMBER);
    expect(res.status).toBe(403);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.findStudentIdKeyForMember).not.toHaveBeenCalled();
    expect(mocks.signStudentIdUrl).not.toHaveBeenCalled();
  });

  it('rejects a malformed member id before any lookup', async () => {
    const res = await call('../../etc/passwd');
    expect(res.status).toBe(404);
    expect(mocks.findStudentIdKeyForMember).not.toHaveBeenCalled();
  });

  it('returns 404 when the member has no ID on file and 502 when signing fails', async () => {
    mocks.findStudentIdKeyForMember.mockResolvedValueOnce(null);
    expect((await call(MEMBER)).status).toBe(404);
    mocks.signStudentIdUrl.mockResolvedValueOnce(null);
    expect((await call(MEMBER)).status).toBe(502);
  });

  it('still opens the image when the audit write fails', async () => {
    mocks.auditInsert.mockRejectedValue(new Error('audit down'));
    expect((await call(MEMBER)).status).toBe(303);
  });

  describe('dev-only local driver', () => {
    beforeEach(() => {
      mocks.isLocal.mockReturnValue(true);
      mocks.readLocal.mockResolvedValue({ bytes: new Uint8Array([0xff, 0xd8, 0xff, 7]), contentType: 'image/jpeg' });
    });

    it('serves the stored bytes with hardened headers instead of redirecting, and audits the view', async () => {
      const res = await call(MEMBER);
      expect(res.status).toBe(200);
      expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual([0xff, 0xd8, 0xff, 7]);
      expect(res.headers.get('content-type')).toBe('image/jpeg');
      expect(res.headers.get('cache-control')).toBe('private, no-store');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('content-disposition')).toMatch(/^inline/);
      expect(res.headers.get('content-security-policy')).toMatch(/default-src 'none'/);
      expect(mocks.signStudentIdUrl).not.toHaveBeenCalled();
      expect(mocks.auditInsert).toHaveBeenCalledWith(expect.objectContaining({ event: 'student_id_viewed' }));
    });

    it('still returns 403 before any lookup or file read for unauthorized callers', async () => {
      mocks.getStaffWithPermission.mockResolvedValue(null);
      const res = await call(MEMBER);
      expect(res.status).toBe(403);
      expect(mocks.findStudentIdKeyForMember).not.toHaveBeenCalled();
      expect(mocks.readLocal).not.toHaveBeenCalled();
    });

    it('returns 404 when the file is missing', async () => {
      mocks.readLocal.mockResolvedValue(null);
      expect((await call(MEMBER)).status).toBe(404);
    });
  });
});
