// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  submitPlayerOnboarding: vi.fn(),
  saveOnboardingDraft: vi.fn(),
  getVerifiedDiscordForInvite: vi.fn(),
  getOnboardingFormState: vi.fn(),
  issueOnboardingFormLink: vi.fn(),
}));

vi.mock('@/app/lib/onboarding/wizard-actions', () => ({
  submitPlayerOnboarding: mocks.submitPlayerOnboarding,
  saveOnboardingDraft: mocks.saveOnboardingDraft,
  getVerifiedDiscordForInvite: mocks.getVerifiedDiscordForInvite,
}));
vi.mock('@/app/lib/onboarding/google-form-actions', () => ({
  getOnboardingFormState: mocks.getOnboardingFormState,
  issueOnboardingFormLink: mocks.issueOnboardingFormLink,
}));

import PlayerOnboardingWizard from '../PlayerOnboardingWizard';
import type { InviteData } from '../types';

const GAMES = [{ id: 'g-val', slug: 'valorant', displayName: 'VALORANT' }];

const managerInvite = (): InviteData => ({
  inviteId: 'invite-1',
  role: 'manager',
  intendedFirstName: 'Sam',
  intendedLastName: 'Miller',
  schoolId: 's1',
  schoolName: 'Stuyvesant',
  schoolSlug: 'stuyvesant',
  gameId: null,
  gameName: 'School Manager',
  gameSlug: 'manager',
  submissionDraft: null,
  expiresAt: new Date(),
  playableGames: GAMES,
});

const playerInvite = (): InviteData => ({
  ...managerInvite(),
  role: 'player',
  gameId: 'g-val',
  gameName: 'VALORANT',
  gameSlug: 'valorant',
  playableGames: undefined,
});

const next = () => fireEvent.click(screen.getByRole('button', { name: /continue/i }));

/** Walks an adult through steps 1-5 so the next press of the last button submits. */
function walkToLastStep(kind: 'manager' | 'player') {
  if (kind === 'manager') {
    fireEvent.change(screen.getByLabelText(/manager email/i), { target: { value: 'sam@school.edu' } });
    fireEvent.change(screen.getByLabelText(/portal account password/i), { target: { value: 'longenough1' } });
    fireEvent.change(screen.getByLabelText(/graduation year/i), { target: { value: '2027' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /i also play in this league/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'VALORANT' }));
  } else {
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'sam@school.edu' } });
    fireEvent.change(screen.getByLabelText(/graduation year/i), { target: { value: '2027' } });
  }
  next(); // 1 -> 2 (Discord is connected through the prop)
  next(); // 2 -> 3
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Demon1#NA1' } });
  fireEvent.click(screen.getByRole('checkbox'));
  next(); // 3 -> 4
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1980-01-01' } });
  fireEvent.click(screen.getByRole('checkbox'));
  next(); // 4 -> 5
  fireEvent.click(screen.getByRole('checkbox'));
}

const submit = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /complete onboarding/i }));
  });
};

const renderWizard = (
  invite: InviteData,
  onboardingForm: { enabled: boolean; completed: boolean }
) =>
  render(
    <PlayerOnboardingWizard
      token="tok"
      inviteData={invite}
      discord={{ username: 'coach_sam', inGuild: true }}
      onboardingForm={onboardingForm}
    />
  );

beforeEach(() => {
  mocks.submitPlayerOnboarding.mockReset();
  mocks.saveOnboardingDraft.mockReset().mockResolvedValue({ success: true });
  mocks.getVerifiedDiscordForInvite.mockReset().mockResolvedValue(null);
  mocks.getOnboardingFormState.mockReset().mockResolvedValue({ enabled: true, completed: false });
  mocks.issueOnboardingFormLink.mockReset().mockResolvedValue({ ok: false, error: 'unused' });
});

describe('wizard without the form step at page load', () => {
  it('has five steps and submits from step 5', async () => {
    mocks.submitPlayerOnboarding.mockResolvedValue({ success: true, role: 'player', status: 'submitted', memberId: 'm', inviteId: 'i' });
    renderWizard(playerInvite(), { enabled: false, completed: false });
    walkToLastStep('player');
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    await submit();
    expect(mocks.submitPlayerOnboarding).toHaveBeenCalledTimes(1);
  });

  it.each(['player', 'manager'] as const)(
    'reveals step 6 when the server answers onboarding_form_required (%s), instead of dead-ending',
    async (kind) => {
      mocks.submitPlayerOnboarding.mockResolvedValue({
        success: false,
        code: 'onboarding_form_required',
        error: 'We have not received your onboarding form yet.',
      });
      renderWizard(kind === 'manager' ? managerInvite() : playerInvite(), { enabled: false, completed: false });
      walkToLastStep(kind);
      await submit();

      expect(await screen.findByText('Step 6 of 6')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Onboarding Form/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /open the form/i })).toBeInTheDocument();
      expect(screen.getByText(/have not received your onboarding form/i)).toBeInTheDocument();
      // Back works, and Continue from step 5 now leads on to the form step.
      fireEvent.click(screen.getByRole('button', { name: /back/i }));
      expect(screen.getByText('Step 5 of 6')).toBeInTheDocument();
    }
  );

  it('lets the student finish once the form is recorded: the revealed step unlocks the submission', async () => {
    mocks.submitPlayerOnboarding
      .mockResolvedValueOnce({ success: false, code: 'onboarding_form_required', error: 'No form yet.' })
      .mockResolvedValueOnce({ success: true, role: 'player', status: 'submitted', memberId: 'm', inviteId: 'i' });
    renderWizard(playerInvite(), { enabled: false, completed: false });
    walkToLastStep('player');
    await submit();
    await screen.findByText('Step 6 of 6');

    mocks.getOnboardingFormState.mockResolvedValue({ enabled: true, completed: true });
    fireEvent.click(await screen.findByRole('button', { name: /check now|open the form/i }));
    // The mount-time check already saw the earlier "not completed"; a focus event re-checks.
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(screen.getByText(/we received your form/i)).toBeInTheDocument());

    await submit();
    expect(mocks.submitPlayerOnboarding).toHaveBeenCalledTimes(2);
  });
});

describe('stale "form required" message', () => {
  it('is removed as soon as the completion check succeeds, so red and green never show together', async () => {
    const message = 'We have not received your onboarding form yet.';
    mocks.submitPlayerOnboarding.mockResolvedValue({ success: false, code: 'onboarding_form_required', error: message });
    renderWizard(playerInvite(), { enabled: false, completed: false });
    walkToLastStep('player');
    await submit();
    await screen.findByText('Step 6 of 6');
    expect(screen.getByText(message)).toBeInTheDocument();

    mocks.getOnboardingFormState.mockResolvedValue({ enabled: true, completed: true });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(screen.getByText(/we received your form/i)).toBeInTheDocument());
    expect(screen.queryByText(message)).toBeNull();
  });
});

describe('wizard with the form step on', () => {
  it('shows six steps for a manager who also plays and blocks submission until the form is recorded', async () => {
    renderWizard(managerInvite(), { enabled: true, completed: false });
    walkToLastStep('manager');
    expect(screen.getByText('Step 5 of 6')).toBeInTheDocument();
    next(); // 5 -> 6
    expect(screen.getByText('Step 6 of 6')).toBeInTheDocument();

    await submit();
    expect(mocks.submitPlayerOnboarding).not.toHaveBeenCalled();
    expect(screen.getByText(/please finish the onboarding form/i)).toBeInTheDocument();
  });

  it('sends alsoPlays and the chosen games when the recorded form lets a manager submit', async () => {
    mocks.submitPlayerOnboarding.mockResolvedValue({
      success: true, role: 'manager', status: 'accepted', memberId: 'm', inviteId: 'i',
      playerApplicationsCreated: 1, playerApplicationsExisting: 0,
    });
    renderWizard(managerInvite(), { enabled: true, completed: true });
    walkToLastStep('manager');
    next();
    expect(await screen.findByText(/we received your form/i)).toBeInTheDocument();
    await submit();
    expect(mocks.submitPlayerOnboarding).toHaveBeenCalledTimes(1);
    expect(mocks.submitPlayerOnboarding.mock.calls[0][0].submission).toMatchObject({
      alsoPlays: true,
      playGameIds: ['g-val'],
    });
  });

  it('puts a manager who also plays back on step 6 if the server loses the completion', async () => {
    mocks.submitPlayerOnboarding.mockResolvedValue({ success: false, code: 'onboarding_form_required', error: 'Not received.' });
    renderWizard(managerInvite(), { enabled: true, completed: true });
    walkToLastStep('manager');
    next();
    await submit();
    expect(await screen.findByText('Step 6 of 6')).toBeInTheDocument();
    expect(screen.queryByText(/we received your form/i)).toBeNull();
  });
});
