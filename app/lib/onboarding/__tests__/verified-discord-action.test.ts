import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ readVerifiedDiscord: vi.fn() }));
vi.mock('@/app/lib/onboarding/discord-session', () => ({ readVerifiedDiscord: mocks.readVerifiedDiscord }));
vi.mock('@/app/lib/db/onboarding', () => ({}));
vi.mock('@/app/lib/onboarding/wizard/submission-pipeline', () => ({ processOnboardingSubmission: vi.fn() }));

import { getVerifiedDiscordForInvite } from '../wizard-actions';

beforeEach(() => mocks.readVerifiedDiscord.mockReset());

describe('getVerifiedDiscordForInvite', () => {
  it('returns only the username and guild state from the signed cookie (never the Discord id)', async () => {
    mocks.readVerifiedDiscord.mockResolvedValue({
      discordUserId: '123456789012345678',
      discordUsername: 'alexchen',
      inGuild: true,
      inviteHash: 'h',
    });
    const result = await getVerifiedDiscordForInvite('tok');
    expect(result).toEqual({ username: 'alexchen', inGuild: true });
    expect(mocks.readVerifiedDiscord).toHaveBeenCalledWith('tok');
  });

  it('returns null when there is no valid cookie for that invite', async () => {
    mocks.readVerifiedDiscord.mockResolvedValue(null);
    await expect(getVerifiedDiscordForInvite('tok')).resolves.toBeNull();
  });

  it('reports a verification that is not in the server as inGuild false', async () => {
    mocks.readVerifiedDiscord.mockResolvedValue({ discordUserId: '1', discordUsername: 'x', inGuild: false, inviteHash: 'h' });
    await expect(getVerifiedDiscordForInvite('tok')).resolves.toEqual({ username: 'x', inGuild: false });
  });
});
