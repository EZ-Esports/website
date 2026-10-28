// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  submitPlayerOnboarding: vi.fn(),
  saveOnboardingDraft: vi.fn(),
  getVerifiedDiscordForInvite: vi.fn(),
}));

vi.mock('@/app/lib/onboarding/wizard-actions', () => ({
  submitPlayerOnboarding: mocks.submitPlayerOnboarding,
  saveOnboardingDraft: mocks.saveOnboardingDraft,
  getVerifiedDiscordForInvite: mocks.getVerifiedDiscordForInvite,
}));

import PlayerOnboardingWizard from '../PlayerOnboardingWizard';
import { stepForRejection, type InviteData } from '../types';

const GAMES = [
  { id: 'g-val', slug: 'valorant', displayName: 'VALORANT' },
  { id: 'g-lol', slug: 'league-of-legends', displayName: 'League of Legends' },
];

const managerInvite = (draft: Record<string, any> | null = null): InviteData => ({
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
  submissionDraft: draft,
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

beforeEach(() => {
  mocks.submitPlayerOnboarding.mockReset();
  mocks.saveOnboardingDraft.mockReset().mockResolvedValue({ success: true });
  mocks.getVerifiedDiscordForInvite.mockReset().mockResolvedValue(null);
});

function fillStepOne() {
  fireEvent.change(screen.getByLabelText(/manager email/i), { target: { value: 'sam@school.edu' } });
  fireEvent.change(screen.getByLabelText(/portal account password/i), { target: { value: 'longenough1' } });
  fireEvent.change(screen.getByLabelText(/graduation year/i), { target: { value: '2027' } });
}

describe('manager "I also play in this league"', () => {
  it('is unchecked by default and a manager who does not play is not asked for games', () => {
    render(<PlayerOnboardingWizard token="tok" inviteData={managerInvite()} />);
    const box = screen.getByRole('checkbox', { name: /i also play in this league/i });
    expect(box).not.toBeChecked();
    expect(screen.queryByRole('group', { name: /games you play/i })).toBeNull();
    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: /Step 2/ })).toBeInTheDocument();
  });

  it('is never offered on a player invite', () => {
    render(<PlayerOnboardingWizard token="tok" inviteData={playerInvite()} />);
    expect(screen.queryByRole('checkbox', { name: /i also play in this league/i })).toBeNull();
  });

  it('requires at least one game before leaving step 1', () => {
    render(<PlayerOnboardingWizard token="tok" inviteData={managerInvite()} />);
    fillStepOne();
    fireEvent.click(screen.getByRole('checkbox', { name: /i also play in this league/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/choose at least one game you will play/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Step 1/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'VALORANT' }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: /Step 2/ })).toBeInTheDocument();
  });

  it('restores the choice from a saved draft and ignores game ids that are not offered', () => {
    render(
      <PlayerOnboardingWizard
        token="tok"
        inviteData={managerInvite({ alsoPlays: true, playGameIds: ['g-lol', 'bogus'] })}
      />
    );
    expect(screen.getByRole('checkbox', { name: /i also play in this league/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'League of Legends' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'VALORANT' })).not.toBeChecked();
  });

  it('saves the choice in the draft so it survives a Discord round trip', async () => {
    render(<PlayerOnboardingWizard token="tok" inviteData={managerInvite()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /i also play in this league/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'VALORANT' }));
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => expect(mocks.saveOnboardingDraft).toHaveBeenCalled());
    const sent = mocks.saveOnboardingDraft.mock.calls[0][0].draftData;
    expect(sent).toMatchObject({ alsoPlays: true, playGameIds: ['g-val'] });
  });

  it('maps a play_games_required rejection back to step 1', () => {
    expect(stepForRejection('play_games_required')).toBe(1);
  });
});
