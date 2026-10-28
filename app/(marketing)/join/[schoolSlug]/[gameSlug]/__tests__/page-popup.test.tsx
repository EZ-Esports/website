import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  validateInviteToken: vi.fn(),
  readVerifiedDiscord: vi.fn(),
}));
vi.mock('@/app/lib/onboarding/wizard-actions', () => ({
  validateInviteToken: mocks.validateInviteToken,
  submitPlayerOnboarding: vi.fn(),
  saveOnboardingDraft: vi.fn(),
  getVerifiedDiscordForInvite: vi.fn(),
}));
vi.mock('@/app/lib/onboarding/discord-session', () => ({ readVerifiedDiscord: mocks.readVerifiedDiscord }));

import Page from '../page';
import { DISCORD_FAILURE_MESSAGES } from '@/app/lib/onboarding/adapters/discord-rest';
import { DiscordPopupDone } from '../components/DiscordPopupDone';
import PlayerOnboardingWizard from '../PlayerOnboardingWizard';

const valid = {
  valid: true,
  status: 'pending',
  inviteId: 'invite-1',
  role: 'player',
  isManager: false,
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
};

const render = (sp: Record<string, string>) =>
  Page({
    params: Promise.resolve({ schoolSlug: 'stuyvesant', gameSlug: 'valorant' }),
    searchParams: Promise.resolve({ token: 'tok', ...sp }),
  }) as Promise<React.ReactElement<Record<string, unknown>>>;

beforeEach(() => {
  mocks.validateInviteToken.mockReset().mockResolvedValue(valid);
  mocks.readVerifiedDiscord.mockReset().mockResolvedValue(null);
});

describe('join page popup branch', () => {
  it('renders the close-this-tab page instead of the wizard when popup is set and Discord is verified', async () => {
    mocks.readVerifiedDiscord.mockResolvedValue({ discordUsername: 'alex', inGuild: true });
    const el = await render({ discord: 'connected', popup: '1' });
    expect(el.type).toBe(DiscordPopupDone);
    expect(el.props).toMatchObject({ inviteId: 'invite-1', status: 'connected', message: null });
  });

  it('shows the readable error for a failed popup flow', async () => {
    const el = await render({ discord_error: 'consent_denied', popup: '1' });
    expect(el.type).toBe(DiscordPopupDone);
    expect(el.props.status).toBe('error');
    expect(el.props.message).toBe(DISCORD_FAILURE_MESSAGES.consent_denied);
  });

  it('trusts the cookie, not the URL: ?discord=connected without a verified cookie is an error', async () => {
    const el = await render({ discord: 'connected', popup: '1' });
    expect(el.props.status).toBe('error');
  });

  it('still validates the invite first: a bad invite shows the normal explanation, not the popup page', async () => {
    mocks.validateInviteToken.mockResolvedValue({ valid: false, status: 'expired', message: 'x' });
    const el = await render({ popup: '1' });
    expect(el.type).not.toBe(DiscordPopupDone);
  });

  it('without popup the wizard renders exactly as before', async () => {
    mocks.readVerifiedDiscord.mockResolvedValue({ discordUsername: 'alex', inGuild: true });
    const el = await render({ discord: 'connected' });
    const wizard = (el.props.children as React.ReactElement<Record<string, unknown>>);
    expect(wizard.type).toBe(PlayerOnboardingWizard);
    expect(wizard.props).toMatchObject({ resumeAtDiscord: true, discord: { username: 'alex', inGuild: true } });
  });
});
