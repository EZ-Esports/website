import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { buildStaffApplicationDetails, type StaffApplicationFormData } from '@/app/lib/staff-application-form';

const mocks = vi.hoisted(() => ({
  insertValues: vi.fn(),
  selectRows: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  bucket: vi.fn(),
  rateLimit: vi.fn(),
  getStaffForAdminSection: vi.fn(),
}));

vi.mock('@/app/lib/db', () => ({
  db: {
    insert: () => ({ values: mocks.insertValues }),
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.selectRows }) }) }),
  },
}));

vi.mock('@/app/lib/supabase/service', () => ({
  createServiceClient: () => ({
    storage: {
      from: (bucket: string) => {
        mocks.bucket(bucket);
        return { upload: mocks.upload, remove: mocks.remove, createSignedUrl: mocks.createSignedUrl };
      },
    },
  }),
}));

vi.mock('@/app/lib/rate-limit', () => ({
  rateLimit: mocks.rateLimit,
  getClientIp: () => '203.0.113.7',
}));

vi.mock('@/app/lib/auth', () => ({
  getStaffForAdminSection: mocks.getStaffForAdminSection,
}));

const { POST } = await import('@/app/api/apply/staff/route');
const { GET } = await import('@/app/(admin)/admin/applications/staff/[id]/resume/route');

const form: StaffApplicationFormData = {
  name: 'Jane Smith',
  preferredFirstName: 'Janie',
  email: 'jane@example.com',
  phone: '(555) 555-5555',
  discordTag: 'janesmith',
  role: 'Marketing Division',
  message: 'I want to help run events.',
  linkedin: 'linkedin.com/in/janesmith',
  workSamples: '',
  availability: '10hrs',
  agreedToTerms: true,
  agreedToPrivacy: true,
  acknowledgedUnpaidVolunteer: true,
};

const pdf = () => new File([new TextEncoder().encode('%PDF-1.7\n...')], 'resume.pdf', { type: 'application/pdf' });

function submission(overrides: { details?: unknown; resume?: File | null; fields?: Record<string, string> } = {}) {
  const body = new FormData();
  const fields = {
    name: form.name,
    preferredFirstName: form.preferredFirstName,
    email: form.email,
    phone: form.phone,
    discordTag: form.discordTag,
    role: form.role,
    ...overrides.fields,
  };
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  body.set('details', JSON.stringify(overrides.details ?? buildStaffApplicationDetails(form)));
  const resume = overrides.resume === undefined ? pdf() : overrides.resume;
  if (resume) body.set('resume', resume, resume.name);
  return new NextRequest('http://localhost/api/apply/staff', { method: 'POST', body });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockReturnValue({ allowed: true, resetInMs: 0 });
  mocks.upload.mockResolvedValue({ data: { path: 'x' }, error: null });
  mocks.remove.mockResolvedValue({ data: [], error: null });
  mocks.insertValues.mockResolvedValue(undefined);
});

describe('POST /api/apply/staff', () => {
  it('stores the PDF in the private bucket under a random UUID key and saves only the key', async () => {
    const res = await POST(submission());
    expect(res.status).toBe(201);

    expect(mocks.bucket).toHaveBeenCalledWith('staff-resumes');
    const [key, , options] = mocks.upload.mock.calls[0];
    expect(key).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(options).toMatchObject({ contentType: 'application/pdf', upsert: false });

    const row = mocks.insertValues.mock.calls[0][0];
    expect(row.resumeStorageKey).toBe(key);
    expect(row.details.version).toBe(3);
    expect(row.details.linkedin).toBe('https://linkedin.com/in/janesmith');
    expect(row.details.consent.acknowledgedUnpaidVolunteer).toBe(true);
  });

  it('rejects a missing resume without uploading or inserting', async () => {
    const res = await POST(submission({ resume: null }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Please attach your resume as a PDF.' });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it('rejects a file that claims to be a PDF but lacks the %PDF- header', async () => {
    const fake = new File(['<html>not a pdf</html>'], 'resume.pdf', { type: 'application/pdf' });
    const res = await POST(submission({ resume: fake }));
    expect(res.status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('rejects a missing unpaid-volunteer acknowledgement before touching storage', async () => {
    const details = buildStaffApplicationDetails({ ...form, acknowledgedUnpaidVolunteer: false });
    const res = await POST(submission({ details }));
    expect(res.status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('rejects an invalid LinkedIn URL', async () => {
    const details = buildStaffApplicationDetails({ ...form, linkedin: 'not a link' });
    const res = await POST(submission({ details }));
    expect(res.status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('refuses an oversized body by its declared length', async () => {
    const req = new NextRequest('http://localhost/api/apply/staff', {
      method: 'POST',
      body: 'x',
      headers: { 'content-length': String(10 * 1024 * 1024) },
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it('still honours the rate limit', async () => {
    mocks.rateLimit.mockReturnValue({ allowed: false, resetInMs: 5000 });
    const res = await POST(submission());
    expect(res.status).toBe(429);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('removes the uploaded resume if the row cannot be saved', async () => {
    mocks.insertValues.mockRejectedValue(new Error('db down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(submission());
    expect(res.status).toBe(500);
    const [key] = mocks.upload.mock.calls[0];
    expect(mocks.remove).toHaveBeenCalledWith([key]);
    errorSpy.mockRestore();
  });
});

describe('GET /admin/applications/staff/[id]/resume', () => {
  const id = '0b6f8a2e-4f1c-4a8e-9a53-0d1b2c3d4e5f';
  const call = (appId = id) =>
    GET(new NextRequest(`http://localhost/admin/applications/staff/${appId}/resume`), {
      params: Promise.resolve({ id: appId }),
    });

  it('denies staff without Applications access before reading anything', async () => {
    mocks.getStaffForAdminSection.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(403);
    expect(mocks.getStaffForAdminSection).toHaveBeenCalledWith('/admin/applications');
    expect(mocks.selectRows).not.toHaveBeenCalled();
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it('redirects to a short-lived signed URL for the stored key', async () => {
    mocks.getStaffForAdminSection.mockResolvedValue({ id: 'staff-1' });
    mocks.selectRows.mockResolvedValue([{ resumeStorageKey: 'abc.pdf' }]);
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.example/signed?token=t' }, error: null });

    const res = await call();
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://storage.example/signed?token=t');
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(mocks.bucket).toHaveBeenCalledWith('staff-resumes');
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('abc.pdf', 60);
  });

  it('404s for a malformed id or an application without a resume', async () => {
    mocks.getStaffForAdminSection.mockResolvedValue({ id: 'staff-1' });
    expect((await call('not-a-uuid')).status).toBe(404);

    mocks.selectRows.mockResolvedValue([{ resumeStorageKey: null }]);
    expect((await call()).status).toBe(404);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });
});
