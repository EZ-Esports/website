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

describe('PlayerOnboardingWizard prefills the name the manager typed on the invite', () => {
  const step1 = (draft: InviteData['submissionDraft']) =>
    renderToStaticMarkup(
      <PlayerOnboardingWizard
        token="t"
        inviteData={{ ...invite('player'), submissionDraft: draft }}
        discord={null}
        resumeAtDiscord={false}
      />
    );

  it('fills the legal first and last name inputs from the invite, with no extra notice', () => {
    const html = step1(null);
    expect(html).toMatch(/<input[^>]*value="Sam"/);
    expect(html).toMatch(/<input[^>]*value="Miller"/);
  });

  it('keeps what the student already saved over the invite name (the fields stay editable)', () => {
    const html = step1({ legalFirstName: 'Samuel', legalLastName: 'Miller-Jones' } as InviteData['submissionDraft']);
    expect(html).toMatch(/<input[^>]*value="Samuel"/);
    expect(html).toMatch(/<input[^>]*value="Miller-Jones"/);
    expect(html).not.toMatch(/<input[^>]*value="Sam"/);
    expect(html).not.toMatch(/<input[^>]*readOnly|<input[^>]*disabled[^>]*value="Samuel"/);
  });
});

describe('stepForRejection', () => {
  it('sends a missing manager password to step 1 and Discord problems to step 2', () => {
    expect(stepForRejection('manager_password_required')).toBe(1);
    for (const code of ['discord_required', 'discord_not_in_guild', 'discord_already_linked']) {
      expect(stepForRejection(code)).toBe(2);
    }
  });
});
