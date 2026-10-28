import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/app/lib/onboarding/wizard-actions', () => ({
  submitPlayerOnboarding: vi.fn(),
  saveOnboardingDraft: vi.fn(),
}));

import PlayerOnboardingWizard, { MANAGER_PASSWORD_REENTRY_NOTE } from '../PlayerOnboardingWizard';
import { stepForRejection, type InviteData } from '../types';

const invite = (role: 'player' | 'manager'): InviteData => ({
  inviteId: 'i1',
  role,
  intendedFirstName: 'Sam',
  intendedLastName: 'Miller',
  schoolId: 's1',
  schoolName: 'Stuyvesant',
  schoolSlug: 'stuyvesant',
  gameId: null,
  gameName: role === 'manager' ? 'School Manager' : 'Valorant',
  gameSlug: role === 'manager' ? 'manager' : 'valorant',
  submissionDraft: null,
  expiresAt: new Date(),
});

const render = (role: 'player' | 'manager', resumeAtDiscord: boolean) =>
  renderToStaticMarkup(
    <PlayerOnboardingWizard
      token="t"
      inviteData={invite(role)}
      discord={{ username: 'coach_sam', inGuild: true }}
      resumeAtDiscord={resumeAtDiscord}
    />
  );

describe('PlayerOnboardingWizard resume after Discord', () => {
  it('sends a returning manager back to step 1 with the password note, because the password is not kept', () => {
    const html = render('manager', true);
    expect(html).toContain('Step 1 of 5');
    expect(html).toContain(MANAGER_PASSWORD_REENTRY_NOTE);
    expect(html).toContain('Please re-enter your password. It is not kept while you connect Discord.');
  });

  it('resumes a returning player at the Discord step', () => {
    const html = render('player', true);
    expect(html).toContain('Step 2 of 5');
    expect(html).not.toContain(MANAGER_PASSWORD_REENTRY_NOTE);
  });

  it('does not show the password note to a manager who has not been through Discord', () => {
    const html = render('manager', false);
    expect(html).toContain('Step 1 of 5');
    expect(html).not.toContain(MANAGER_PASSWORD_REENTRY_NOTE);
  });
});

describe('stepForRejection', () => {
  it('sends a missing manager password to step 1 and Discord problems to step 2', () => {
    expect(stepForRejection('manager_password_required')).toBe(1);
    for (const code of ['discord_required', 'discord_not_in_guild', 'discord_already_linked']) {
      expect(stepForRejection(code)).toBe(2);
    }
  });

  it('routes offensive content to the step that holds the offending field', () => {
    const cases: Array<[string, number]> = [
      ['legalFirstName', 1],
      ['legalLastName', 1],
      ['riotId', 3],
      ['countryOfBirth', 4],
      ['primaryLanguageAtHome', 4],
      ['feedback', 4],
      ['participantLegalName', 5],
      ['guardianFullName', 5],
      ['guardianRelationship', 5],
      ['guardianSignature', 5],
    ];
    for (const [field, step] of cases) {
      expect(stepForRejection('offensive_content', field), field).toBe(step);
    }
  });

  it('falls back to step 1 for offensive content with no or an unknown field', () => {
    expect(stepForRejection('offensive_content')).toBe(1);
    expect(stepForRejection('offensive_content', 'mystery')).toBe(1);
  });

  it('sends a missing Code of Conduct to step 4 and a missing Terms of Service to step 5', () => {
    expect(stepForRejection('code_of_conduct_required')).toBe(4);
    expect(stepForRejection('terms_required')).toBe(5);
  });
});
