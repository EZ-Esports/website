import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

const mocks = vi.hoisted(() => ({
  findInviteForSubmission: vi.fn(),
  runOnboardingTransaction: vi.fn(),
  upsertMemberRecord: vi.fn(async () => 'member-1'),
  replaceUnreviewedContentOverrides: vi.fn(async () => undefined),
}));

// Pure validation plus a pre-transaction early exit: no database is touched by these tests.
vi.mock('@/app/lib/db/onboarding', () => ({
  findDiscordIdentityOwner: vi.fn(),
  findInviteForSubmission: mocks.findInviteForSubmission,
  findInviteByTokenHash: vi.fn(),
  findInviteForValidation: vi.fn(),
  findStaffUserIdByEmail: vi.fn(),
  insertOnboardingConsent: vi.fn(),
  markManagerInviteAccepted: vi.fn(),
  markPlayerInviteSubmitted: vi.fn(),
  runOnboardingTransaction: mocks.runOnboardingTransaction,
  updateInviteDraft: vi.fn(),
  upsertMemberRecord: mocks.upsertMemberRecord,
  replaceUnreviewedContentOverrides: mocks.replaceUnreviewedContentOverrides,
  upsertPlayerIdentities: vi.fn(),
  upsertSchoolManager: vi.fn(),
  upsertStudentDemographics: vi.fn(),
}));
vi.mock('@/app/lib/db', () => ({ db: {} }));
vi.mock('@/app/lib/cache', () => ({
  updateCacheTags: vi.fn(),
  CACHE_TAGS: { PLAYERS: 'players', MEMBERS: 'members', SCHOOLS: 'schools' },
}));

import {
  processOnboardingSubmission,
  validateSubmissionInputs,
} from '@/app/lib/onboarding/wizard/submission-pipeline';
import { OnboardingRejection } from '@/app/lib/onboarding/rejection';
import type { PlayerOnboardingSubmission } from '@/app/lib/onboarding/wizard-actions';

const NOW = new Date('2026-10-28T12:00:00Z');

/** An adult student who passes every check. Each test overrides only the field it is about. */
function cleanSubmission(overrides: Partial<PlayerOnboardingSubmission> = {}): PlayerOnboardingSubmission {
  return {
    email: 'student@school.edu',
    legalFirstName: 'Riley',
    legalLastName: 'Chen',
    graduationYear: 2027,
    riotId: 'Demon1#LFT1',
    birthDate: '2005-05-01',
    codeOfConductAccepted: true,
    countryOfBirth: 'China',
    primaryLanguageAtHome: 'Mandarin',
    surveyDetails: { feedback: 'Available after school on weekdays.' },
    consent: { tosAcknowledged: true },
    ...overrides,
  };
}

function expectOffensive(submission: PlayerOnboardingSubmission, field: string) {
  let caught: unknown;
  try {
    validateSubmissionInputs(submission, NOW);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(OnboardingRejection);
  const rejection = caught as OnboardingRejection;
  expect(rejection.code).toBe('offensive_content');
  expect(rejection.field).toBe(field);
  // The message names the field, never the offending word.
  expect(rejection.message).toContain('Please remove offensive language');
  expect(rejection.message).not.toMatch(/bullshit|dumbass|fuck|puta|hancock/i);
}

describe('validateSubmissionInputs: offensive content', () => {
  it('accepts a clean submission', () => {
    expect(() => validateSubmissionInputs(cleanSubmission(), NOW)).not.toThrow();
  });

  it('accepts real surnames that look like terms', () => {
    const result = validateSubmissionInputs(
      cleanSubmission({ legalFirstName: 'Dickson', legalLastName: 'Hancock', riotId: 'Cockburn#NA1' }),
      NOW
    );
    expect(result.legalLastName).toBe('Hancock');
  });

  it('accepts a legal given name that is a real word or name, such as Dick', () => {
    expect(() =>
      validateSubmissionInputs(cleanSubmission({ legalFirstName: 'Dick' }), NOW)
    ).not.toThrow();
  });

  it('rejects an offensive legal first name', () => {
    expectOffensive(cleanSubmission({ legalFirstName: 'Bullshit' }), 'legalFirstName');
  });

  it('rejects an offensive legal last name', () => {
    expectOffensive(cleanSubmission({ legalLastName: 'Dumbass' }), 'legalLastName');
  });

  it('rejects an offensive Riot ID, with leetspeak', () => {
    expectOffensive(cleanSubmission({ riotId: 'Dumb@ss#NA1' }), 'riotId');
  });

  it('rejects an offensive feedback answer, with separators', () => {
    expectOffensive(
      cleanSubmission({ surveyDetails: { feedback: 'this league is b.u.l.l.s.h.i.t' } }),
      'feedback'
    );
  });

  it('rejects offensive country of birth and home language', () => {
    expectOffensive(cleanSubmission({ countryOfBirth: 'Merde' }), 'countryOfBirth');
    expectOffensive(cleanSubmission({ primaryLanguageAtHome: 'puta' }), 'primaryLanguageAtHome');
  });

  it('rejects offensive consent name fields for a minor', () => {
    expectOffensive(
      cleanSubmission({
        birthDate: '2011-05-01',
        consent: { tosAcknowledged: true, guardianFullName: 'Fuck Off' },
      }),
      'guardianFullName'
    );
  });

  it('rejects an offensive participant name on the consent form for a minor', () => {
    expectOffensive(
      minorSubmission({ consent: { tosAcknowledged: true, participantLegalName: 'Bullshit Chen' } }),
      'participantLegalName'
    );
  });

  it('does not screen the consent participant name for an adult, who does not see that field', () => {
    // An adult's participant name is their legal name, already screened (and overridable) in Step 1.
    const result = validateSubmissionInputs(
      cleanSubmission({ consent: { tosAcknowledged: true, participantLegalName: 'Bullshit Chen' } }),
      NOW
    );
    expect(result.legalFirstName).toBe('Riley');
  });

  it('accepts common given names and surnames that were once false positives', () => {
    const result = validateSubmissionInputs(
      cleanSubmission({ legalFirstName: 'Amina', legalLastName: 'Lund', riotId: 'Randi#NA1' }),
      NOW
    );
    expect(result.legalFirstName).toBe('Amina');
    expect(result.legalLastName).toBe('Lund');
  });

  it('does not screen guardian fields for an adult, since the form does not show them', () => {
    expect(() =>
      validateSubmissionInputs(
        cleanSubmission({
          consent: {
            tosAcknowledged: true,
            guardianFullName: 'Fuck Off',
            guardianRelationship: 'Bullshit',
            guardianSignature: 'Dumbass',
          },
        }),
        NOW
      )
    ).not.toThrow();
  });

  it('screens guardian fields for a minor, where the form shows them', () => {
    expectOffensive(
      cleanSubmission({
        birthDate: '2011-05-01',
        consent: { tosAcknowledged: true, guardianRelationship: 'bullshit' },
      }),
      'guardianRelationship'
    );
  });

  it('rejects a non-string value in a free-text or consent field as a plain error, not a student rejection', () => {
    const cases: PlayerOnboardingSubmission[] = [
      cleanSubmission({ surveyDetails: { feedback: ['fuck'] as unknown as string } }),
      cleanSubmission({ surveyDetails: { feedback: 42 as unknown as string } }),
      cleanSubmission({ countryOfBirth: { en: 'fuck' } as unknown as string }),
      cleanSubmission({
        birthDate: '2011-05-01',
        consent: { tosAcknowledged: true, guardianFullName: ['x'] as unknown as string },
      }),
    ];
    for (const submission of cases) {
      let caught: unknown;
      try {
        validateSubmissionInputs(submission, NOW);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(caught).not.toBeInstanceOf(OnboardingRejection);
    }
  });

  it('accepts a clean non-English name', () => {
    expect(() =>
      validateSubmissionInputs(cleanSubmission({ legalFirstName: 'Öztürk', legalLastName: 'Schröder' }), NOW)
    ).not.toThrow();
  });
});

describe('processOnboardingSubmission: offensive content is rejected before any write', () => {
  beforeEach(() => {
    mocks.runOnboardingTransaction.mockReset();
    mocks.findInviteForSubmission.mockReset();
  });

  function invite(isManager: boolean) {
    mocks.findInviteForSubmission.mockResolvedValue({
      invite: {
        id: 'invite-1',
        schoolId: 'school-1',
        status: 'pending',
        expiresAt: null,
        submissionDraft: null,
      },
      isManager,
      gameSlug: isManager ? 'manager' : 'valorant',
    });
  }

  for (const isManager of [false, true]) {
    const role = isManager ? 'manager' : 'player';

    it(`rejects an offensive name on the ${role} path with a coded result`, async () => {
      invite(isManager);
      const err = await processOnboardingSubmission({
        token: 'token-value',
        submission: cleanSubmission({ legalFirstName: 'Fuck', password: 'correct horse battery' }),
      }).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(OnboardingRejection);
      expect((err as OnboardingRejection).code).toBe('offensive_content');
      expect((err as OnboardingRejection).field).toBe('legalFirstName');
      expect(mocks.runOnboardingTransaction).not.toHaveBeenCalled();
    });

    it(`rejects an unaccepted code of conduct on the ${role} path`, async () => {
      invite(isManager);
      await expect(
        processOnboardingSubmission({
          token: 'token-value',
          submission: cleanSubmission({ codeOfConductAccepted: false, password: 'correct horse battery' }),
        })
      ).rejects.toMatchObject({ code: 'code_of_conduct_required' });
      expect(mocks.runOnboardingTransaction).not.toHaveBeenCalled();
    });

    it(`rejects an unchecked Terms of Service box with a rejection code on the ${role} path`, async () => {
      invite(isManager);
      await expect(
        processOnboardingSubmission({
          token: 'token-value',
          submission: cleanSubmission({ consent: { tosAcknowledged: false }, password: 'correct horse battery' }),
        })
      ).rejects.toMatchObject({ code: 'terms_required', message: expect.stringMatching(/Terms of Service/) });
      expect(mocks.runOnboardingTransaction).not.toHaveBeenCalled();
    });
  }
});

/** A minor's submission with every consent field filled in, so only the screened fields decide the outcome. */
function minorSubmission(overrides: Partial<PlayerOnboardingSubmission> = {}): PlayerOnboardingSubmission {
  return cleanSubmission({
    birthDate: '2011-05-01',
    consent: {
      tosAcknowledged: true,
      participantLegalName: 'Riley Chen',
      guardianFullName: 'Pat Chen',
      guardianRelationship: 'Parent',
      guardianEmail: 'pat@example.com',
      guardianSignature: 'Pat Chen',
    },
    ...overrides,
  });
}

describe('content overrides: confirmed flagged fields', () => {
  const TOKEN = 'invite-token';
  const tokenHash = createHash('sha256').update(TOKEN).digest('hex');
  const verifiedDiscord = { discordUserId: '1234', discordUsername: 'riley', inGuild: true, inviteHash: tokenHash };

  beforeEach(() => {
    mocks.findInviteForSubmission.mockReset();
    mocks.runOnboardingTransaction.mockReset();
    mocks.replaceUnreviewedContentOverrides.mockClear();
    mocks.findInviteForSubmission.mockResolvedValue({
      invite: { id: 'invite-1', schoolId: 'school-1', status: 'pending', expiresAt: null, submissionDraft: null },
      isManager: false,
      gameSlug: 'valorant',
    });
  });

  it('(a) accepts a flagged field the student confirmed, and records it with the member in the transaction', async () => {
    mocks.runOnboardingTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb({}));

    const result = await processOnboardingSubmission({
      token: TOKEN,
      submission: cleanSubmission({ legalFirstName: 'Bullshit', contentOverrides: ['legalFirstName'] }),
      verifiedDiscord,
    });

    expect(result).toMatchObject({ success: true, memberId: 'member-1' });
    expect(mocks.replaceUnreviewedContentOverrides).toHaveBeenCalledTimes(1);
    expect(mocks.replaceUnreviewedContentOverrides).toHaveBeenCalledWith(expect.anything(), 'member-1', [
      { field: 'legalFirstName', submittedValue: 'Bullshit' },
    ]);
  });

  it('(b) still rejects a flagged field with no confirmation, and writes nothing', async () => {
    mocks.runOnboardingTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb({}));

    const err = await processOnboardingSubmission({
      token: TOKEN,
      submission: cleanSubmission({ legalFirstName: 'Bullshit' }),
      verifiedDiscord,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(OnboardingRejection);
    expect((err as OnboardingRejection).code).toBe('offensive_content');
    expect((err as OnboardingRejection).field).toBe('legalFirstName');
    expect(mocks.runOnboardingTransaction).not.toHaveBeenCalled();
  });

  it('(b) with two flagged fields, confirming one still rejects on the other', () => {
    let caught: unknown;
    try {
      validateSubmissionInputs(
        cleanSubmission({
          legalFirstName: 'Bullshit',
          surveyDetails: { feedback: 'this is dumbass' },
          contentOverrides: ['legalFirstName'],
        }),
        NOW
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OnboardingRejection);
    expect((caught as OnboardingRejection).field).toBe('feedback');
  });

  it('(c) ignores an override for a field that is not flagged, so nothing is recorded for it', () => {
    const result = validateSubmissionInputs(
      cleanSubmission({ legalFirstName: 'Riley', contentOverrides: ['legalFirstName', 'feedback'] }),
      NOW
    );
    expect(result.contentOverrides).toEqual([]);
  });

  it('(c) ignores non-string entries in the override list', () => {
    const result = validateSubmissionInputs(
      cleanSubmission({ contentOverrides: [42, null, { field: 'legalFirstName' }] as unknown as string[] }),
      NOW
    );
    expect(result.contentOverrides).toEqual([]);
  });

  it('(d) accepts an overridden flagged guardian field for a minor and returns it for recording', () => {
    const result = validateSubmissionInputs(
      minorSubmission({
        consent: {
          tosAcknowledged: true,
          participantLegalName: 'Riley Chen',
          guardianFullName: 'Pat Chen',
          guardianRelationship: 'bullshit',
          guardianEmail: 'pat@example.com',
          guardianSignature: 'Pat Chen',
        },
        contentOverrides: ['guardianRelationship'],
      }),
      NOW
    );
    expect(result.contentOverrides).toEqual([{ field: 'guardianRelationship', submittedValue: 'bullshit' }]);
  });

  it('(d) does not record an override for a minor guardian field that is clean', () => {
    const result = validateSubmissionInputs(minorSubmission({ contentOverrides: ['guardianFullName'] }), NOW);
    expect(result.contentOverrides).toEqual([]);
  });

  it('(d) does not screen guardian fields for an adult, so an override for one is ignored', () => {
    const result = validateSubmissionInputs(
      cleanSubmission({
        consent: { tosAcknowledged: true, guardianFullName: 'Fuck Off' },
        contentOverrides: ['guardianFullName'],
      }),
      NOW
    );
    expect(result.contentOverrides).toEqual([]);
  });
});
