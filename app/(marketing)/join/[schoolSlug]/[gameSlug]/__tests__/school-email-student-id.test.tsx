// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('@/app/lib/onboarding/wizard-actions', () => ({
  submitPlayerOnboarding: vi.fn(),
  saveOnboardingDraft: vi.fn(),
}));

// jsdom never decodes images, so the real compressor would wait for an onload that never comes.
vi.mock('@/app/lib/image-compression', () => ({ compressImage: async (file: File) => file }));

import { useWizardDraft } from '../hooks/useWizardDraft';
import { stepForRejection, type InviteData } from '../types';

const invite = (role: 'player' | 'manager', extra: Partial<InviteData> = {}): InviteData => ({
  inviteId: 'i1',
  role,
  intendedFirstName: 'Sam',
  intendedLastName: 'Miller',
  schoolId: 's1',
  schoolName: 'Stuyvesant',
  schoolSlug: 'stuyvesant',
  gameId: null,
  gameName: 'Valorant',
  gameSlug: 'valorant',
  submissionDraft: null,
  expiresAt: new Date(),
  ...extra,
});

function fill(result: { current: ReturnType<typeof useWizardDraft> }, schoolEmail: string, email = 'sam@gmail.com') {
  act(() => {
    result.current.setEmail(email);
    result.current.setSchoolEmail(schoolEmail);
    result.current.setGraduationYear(2027);
  });
}

describe.each(['player', 'manager'] as const)('step 1 school email and student ID (%s)', (role) => {
  const setup = (extra: Partial<InviteData> = {}) =>
    renderHook(() => {
      const draft = useWizardDraft('t', invite(role, extra), { discordUsername: null });
      return draft;
    });

  function validate(result: { current: ReturnType<typeof useWizardDraft> }) {
    let ok = true;
    act(() => {
      if (role === 'manager') result.current.setPassword('longenough1');
    });
    act(() => {
      ok = result.current.validateStep1();
    });
    return ok;
  }

  it('blocks a school email on the wrong domain, with a specific message', () => {
    const { result } = setup({ studentIdUploaded: true });
    fill(result, 'sam@nycstudents.net.evil.com');
    expect(validate(result)).toBe(false);
    expect(result.current.errorMessage).toMatch(/must end in @nycstudents\.net/);
  });

  it('blocks a school email equal to the personal email', () => {
    const { result } = setup({ studentIdUploaded: true });
    fill(result, 'sam@nycstudents.net', 'Sam@nycstudents.net');
    expect(validate(result)).toBe(false);
    expect(result.current.errorMessage).toMatch(/different/);
  });

  it('blocks continuing without an uploaded student ID', () => {
    const { result } = setup({ studentIdUploaded: false });
    fill(result, 'sam@nycstudents.net');
    expect(validate(result)).toBe(false);
    expect(result.current.errorMessage).toMatch(/student ID/);
  });

  it('passes with a valid school email and an uploaded ID (including one resumed from a refresh)', () => {
    const { result } = setup({ studentIdUploaded: true });
    fill(result, ' SAM@nycstudents.net ');
    expect(validate(result)).toBe(true);
  });

  it('restores a drafted school email and puts it back into the saved draft payload', () => {
    const { result } = setup({ submissionDraft: { schoolEmail: 'sam@nycstudents.net' } });
    expect(result.current.schoolEmail).toBe('sam@nycstudents.net');
    expect(result.current.buildCurrentPayload().schoolEmail).toBe('sam@nycstudents.net');
    // The photo is never part of a draft.
    expect(Object.keys(result.current.buildCurrentPayload()).join(',')).not.toMatch(/studentId/i);
  });
});

describe('student ID upload from the wizard', () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], 'id.jpg', { type: 'image/jpeg' });

  it('posts the invite token and file to the upload route and records success', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 201 }));
    const { result } = renderHook(() => useWizardDraft('tok', invite('player'), {}));
    await act(async () => {
      await result.current.uploadStudentId(jpeg());
    });
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe('/api/onboarding/student-id');
    const body = (init as RequestInit).body as FormData;
    expect(body.get('token')).toBe('tok');
    expect(body.get('file')).toBeInstanceOf(File);
    expect(result.current.studentIdUploaded).toBe(true);
    expect(result.current.studentIdError).toBeNull();
  });

  it('shows the server message and stays not-uploaded when the upload fails', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Please upload a JPEG, PNG or WebP photo of your student ID.' }), { status: 400 }));
    const { result } = renderHook(() => useWizardDraft('tok', invite('player'), {}));
    await act(async () => {
      await result.current.uploadStudentId(jpeg());
    });
    expect(result.current.studentIdUploaded).toBe(false);
    expect(result.current.studentIdError).toMatch(/JPEG, PNG or WebP/);
  });

  it('refuses a non-image before any request is made', async () => {
    const { result } = renderHook(() => useWizardDraft('tok', invite('player'), {}));
    await act(async () => {
      await result.current.uploadStudentId(new File(['%PDF-'], 'id.pdf', { type: 'application/pdf' }));
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.current.studentIdError).toMatch(/JPEG, PNG or WebP/);
  });
});

describe('server rejections send the person back to step 1', () => {
  it.each(['school_email_invalid', 'school_email_already_used', 'student_id_required'])('%s -> step 1', (code) => {
    expect(stepForRejection(code)).toBe(1);
  });
});
