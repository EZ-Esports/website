import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Permissions, hasPermission } from '@/app/lib/roles';
import { schoolManagers, playerInvites, playerIdentities, studentDemographics } from '@/app/lib/db/schema';
import { ManualRiotIdAdapter, deriveTrackerUrl, RIOT_ID_REGEX } from '../adapters/riot-manual';
import { DiscordRestAdapter } from '../adapters/discord-rest';

describe('Milestone 1: Permissions & Schema', () => {
  it('defines VIEW_STUDENT_DEMOGRAPHICS permission bitmask', () => {
    expect(Permissions.VIEW_STUDENT_DEMOGRAPHICS).toBe(BigInt(1) << BigInt(12));
  });

  it('correctly checks VIEW_STUDENT_DEMOGRAPHICS permission and administrator override', () => {
    const demogPerm = Permissions.VIEW_STUDENT_DEMOGRAPHICS;
    const generalPerm = Permissions.MANAGE_NEWS;

    expect(hasPermission(demogPerm, false, Permissions.VIEW_STUDENT_DEMOGRAPHICS)).toBe(true);
    expect(hasPermission(generalPerm, false, Permissions.VIEW_STUDENT_DEMOGRAPHICS)).toBe(false);
    expect(hasPermission(Permissions.ADMINISTRATOR, false, Permissions.VIEW_STUDENT_DEMOGRAPHICS)).toBe(true);
    expect(hasPermission(BigInt(0), true, Permissions.VIEW_STUDENT_DEMOGRAPHICS)).toBe(true);
  });

  it('defines schoolManagers schema columns correctly', () => {
    expect(schoolManagers.id).toBeDefined();
    expect(schoolManagers.schoolId).toBeDefined();
    expect(schoolManagers.userId).toBeDefined();
    expect(schoolManagers.managedGames).toBeDefined();
    expect(schoolManagers.academicYear).toBeDefined();
    expect(schoolManagers.isPrimaryContact).toBeDefined();
    expect(schoolManagers.isActive).toBeDefined();
    expect(schoolManagers.createdAt).toBeDefined();
    expect(schoolManagers.updatedAt).toBeDefined();
  });

  it('defines playerInvites schema columns correctly', () => {
    expect(playerInvites.id).toBeDefined();
    expect(playerInvites.schoolId).toBeDefined();
    expect(playerInvites.gameId).toBeDefined();
    expect(playerInvites.tokenHash).toBeDefined();
    expect(playerInvites.intendedFirstName).toBeDefined();
    expect(playerInvites.intendedLastName).toBeDefined();
    expect(playerInvites.invitedByUserId).toBeDefined();
    expect(playerInvites.status).toBeDefined();
    expect(playerInvites.expiresAt).toBeDefined();
    expect(playerInvites.submittedAt).toBeDefined();
    expect(playerInvites.reviewedAt).toBeDefined();
    expect(playerInvites.rejectionReason).toBeDefined();
    expect(playerInvites.createdAt).toBeDefined();
  });

  it('defines playerIdentities schema columns correctly', () => {
    expect(playerIdentities.id).toBeDefined();
    expect(playerIdentities.memberId).toBeDefined();
    expect(playerIdentities.provider).toBeDefined();
    expect(playerIdentities.providerUserId).toBeDefined();
    expect(playerIdentities.providerUsername).toBeDefined();
    expect(playerIdentities.inGuild).toBeDefined();
    expect(playerIdentities.lastVerifiedAt).toBeDefined();
    expect(playerIdentities.createdAt).toBeDefined();
  });

  it('defines studentDemographics schema columns correctly', () => {
    expect(studentDemographics.id).toBeDefined();
    expect(studentDemographics.memberId).toBeDefined();
    expect(studentDemographics.legalFirstName).toBeDefined();
    expect(studentDemographics.legalLastName).toBeDefined();
    expect(studentDemographics.birthDate).toBeDefined();
    expect(studentDemographics.gender).toBeDefined();
    expect(studentDemographics.race).toBeDefined();
    expect(studentDemographics.ethnicity).toBeDefined();
    expect(studentDemographics.countryOfBirth).toBeDefined();
    expect(studentDemographics.parentsCountryOfBirth).toBeDefined();
    expect(studentDemographics.primaryLanguageAtHome).toBeDefined();
    expect(studentDemographics.isFreeOrReducedLunch).toBeDefined();
    expect(studentDemographics.isFirstGenCollege).toBeDefined();
    expect(studentDemographics.doePetitionConsent).toBeDefined();
    expect(studentDemographics.surveyDetails).toBeDefined();
    expect(studentDemographics.createdAt).toBeDefined();
  });
});

describe('ManualRiotIdAdapter', () => {
  const adapter = new ManualRiotIdAdapter();

  it('validates and parses a valid Riot ID', async () => {
    const result = await adapter.resolveIdentity('valorant', 'Demon1#LFT1');
    expect(result).toEqual({
      gameId: 'Demon1#LFT1',
      displayName: 'Demon1',
      rawIdentifier: 'Demon1#LFT1',
      isVerified: false,
      trackerUrl: 'https://tracker.gg/valorant/profile/riot/Demon1%23LFT1/overview',
    });
  });

  it('trims leading/trailing whitespace before parsing', async () => {
    const result = await adapter.resolveIdentity('valorant', '  TenZ#0001  ');
    expect(result.displayName).toBe('TenZ');
    expect(result.rawIdentifier).toBe('TenZ#0001');
    expect(result.trackerUrl).toBe('https://tracker.gg/valorant/profile/riot/TenZ%230001/overview');
  });

  it('derives correct tracker URL for League of Legends', async () => {
    const result = await adapter.resolveIdentity('league-of-legends', 'Faker#KR1');
    expect(result.trackerUrl).toBe('https://tracker.gg/lol/profile/riot/Faker%23KR1/overview');
    expect(deriveTrackerUrl('valorant', 'Demon1#LFT1')).toBe('https://tracker.gg/valorant/profile/riot/Demon1%23LFT1/overview');
    expect(deriveTrackerUrl('lol', 'Faker#KR1')).toBe('https://tracker.gg/lol/profile/riot/Faker%23KR1/overview');
  });

  it('supports configurable isVerified in constructor', async () => {
    const verifiedAdapter = new ManualRiotIdAdapter({ isVerified: true });
    const res = await verifiedAdapter.resolveIdentity('valorant', 'Demon1#LFT1');
    expect(res.isVerified).toBe(true);
  });

  it('rejects invalid Riot ID formats with descriptive errors', async () => {
    const invalidIds = [
      '',
      '   ',
      'NoTagHere',
      'AB#123', // name too short (< 3 chars)
      'NameWayTooLongForRiotAccount#1234', // name > 16 chars
      'Player#12', // tag too short (< 3 chars)
      'Player#123456', // tag too long (> 5 chars)
      'Player#12!', // invalid special character in tag
    ];

    for (const invalidId of invalidIds) {
      await expect(adapter.resolveIdentity('valorant', invalidId)).rejects.toThrow(
        /Invalid Riot ID format/
      );
    }
  });

  it('RIOT_ID_REGEX correctly tests valid and invalid formats', () => {
    expect(RIOT_ID_REGEX.test('Demon1#LFT1')).toBe(true);
    expect(RIOT_ID_REGEX.test('abc#123')).toBe(true);
    expect(RIOT_ID_REGEX.test('1234567890123456#abcde')).toBe(true);

    expect(RIOT_ID_REGEX.test('ab#123')).toBe(false);
    expect(RIOT_ID_REGEX.test('12345678901234567#123')).toBe(false);
    expect(RIOT_ID_REGEX.test('abc#12')).toBe(false);
    expect(RIOT_ID_REGEX.test('abc#123456')).toBe(false);
  });
});

describe('DiscordRestAdapter', () => {
  describe('Mock / Development fallback mode (DISCORD_BOT_TOKEN empty)', () => {
    const mockAdapter = new DiscordRestAdapter({
      botToken: '',
      isMock: true,
      mockInGuild: true,
    });

    it('returns joined: true when adding member in mock mode', async () => {
      const res = await mockAdapter.addMemberToGuild('123456789', 'mock_access_token');
      expect(res).toEqual({ joined: true, alreadyMember: false });
    });

    it('returns configured mock guild status', async () => {
      expect(await mockAdapter.isMemberInGuild('123456789')).toBe(true);

      const notInGuildAdapter = new DiscordRestAdapter({
        isMock: true,
        mockInGuild: false,
      });
      expect(await notInGuildAdapter.isMemberInGuild('123456789')).toBe(false);
    });

    it('syncMemberRoles succeeds without throwing in mock mode', async () => {
      await expect(mockAdapter.syncMemberRoles('123456789', ['role1', 'role2'])).resolves.toBeUndefined();
    });
  });

  describe('Real REST API calls with custom fetch mock', () => {
    let mockFetch: ReturnType<typeof vi.fn>;
    let restAdapter: DiscordRestAdapter;

    beforeEach(() => {
      mockFetch = vi.fn();
      restAdapter = new DiscordRestAdapter({
        botToken: 'test_bot_token',
        guildId: 'test_guild_id',
        isMock: false,
        fetchFn: mockFetch as unknown as typeof fetch,
      });
    });

    it('handles 201 Created when adding a new member to the guild', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 201 }));

      const res = await restAdapter.addMemberToGuild('user123', 'oauth_token');
      expect(res).toEqual({ joined: true, alreadyMember: false });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/guilds/test_guild_id/members/user123',
        {
          method: 'PUT',
          headers: {
            Authorization: 'Bot test_bot_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ access_token: 'oauth_token' }),
        }
      );
    });

    it('handles 204 No Content when member is already in the guild', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      const res = await restAdapter.addMemberToGuild('user123', 'oauth_token');
      expect(res).toEqual({ joined: false, alreadyMember: true });
    });

    it('throws error when Discord returns error code on adding member', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Maximum number of guilds reached (100)' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(restAdapter.addMemberToGuild('user123', 'oauth_token')).rejects.toThrow(
        /Discord API error adding member \(400\): Maximum number of guilds reached \(100\)/
      );
    });

    it('checks guild membership returns true on 200 OK', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: 'user123' } }), { status: 200 }));

      const inGuild = await restAdapter.isMemberInGuild('user123');
      expect(inGuild).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/guilds/test_guild_id/members/user123',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bot test_bot_token',
          },
        }
      );
    });

    it('checks guild membership returns false on 404 Not Found', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

      const inGuild = await restAdapter.isMemberInGuild('user123');
      expect(inGuild).toBe(false);
    });

    it('throws error on unexpected Discord error when checking membership', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500, statusText: 'Server Error' }));

      await expect(restAdapter.isMemberInGuild('user123')).rejects.toThrow(
        /Discord API error checking guild membership \(500\)/
      );
    });

    it('syncMemberRoles sends PATCH request with role IDs', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      await restAdapter.syncMemberRoles('user123', ['role_a', 'role_b']);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/guilds/test_guild_id/members/user123',
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bot test_bot_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ roles: ['role_a', 'role_b'] }),
        }
      );
    });

    it('throws when guildId is not configured on non-mock instance', async () => {
      const unconfigured = new DiscordRestAdapter({
        botToken: 'bot_token',
        guildId: '',
        isMock: false,
      });

      await expect(unconfigured.isMemberInGuild('user123')).rejects.toThrow(
        'DISCORD_GUILD_ID is not configured'
      );
    });
  });
});
