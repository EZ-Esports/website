import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import * as schema from '@/app/lib/db/schema';
import { CONSENT_FORM_VERSION } from '@/app/lib/onboarding/consent';
import { Permissions } from '@/app/lib/roles';
import { ForbiddenPiiAccessError } from '@/app/lib/db/queries';

// --- HOISTED MOCKS ---
const mocks = vi.hoisted(() => {
  const mockUpdateCacheTags = vi.fn();

  const state = {
    schoolsStore: [] as any[],
    gamesStore: [] as any[],
    playerInvitesStore: [] as any[],
    managerInvitesStore: [] as any[],
    membersStore: [] as any[],
    playerIdentitiesStore: [] as any[],
    studentDemographicsStore: [] as any[],
    schoolManagersStore: [] as any[],
    staffMembersStore: [] as any[],
    onboardingConsentsStore: [] as any[],
    onboardingContentFlagsStore: [] as any[],
    /** When set, inserting an onboarding_content_flags row throws it (simulates a missing table). */
    flagsInsertError: null as any,
  };

  function extractConditions(clause: any): Array<{ col: string; op: 'eq' | 'in' | 'isNull'; val?: any }> {
    if (!clause) return [];
    if (clause.queryChunks) {
      const conditions: Array<{ col: string; op: 'eq' | 'in' | 'isNull'; val?: any }> = [];
      const chunks = clause.queryChunks;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk && chunk.queryChunks) {
          conditions.push(...extractConditions(chunk));
        } else if (chunk && typeof chunk === 'object' && 'name' in chunk) {
          const colName = chunk.name;
          for (let j = i + 1; j < chunks.length; j++) {
            const next = chunks[j];
            if (!next) continue;
            const nextStr = typeof next === 'object' && next.value ? String(next.value) : String(next);
            if (nextStr.includes('=') && !nextStr.includes('!=')) {
              const valChunk = chunks[j + 1];
              const val = valChunk?.value !== undefined ? valChunk.value : valChunk;
              conditions.push({ col: colName, op: 'eq', val });
              break;
            } else if (nextStr.includes(' in')) {
              const valChunk = chunks[j + 1];
              let vals: any[] = [];
              if (Array.isArray(valChunk)) {
                vals = valChunk.map((p: any) => (p?.value !== undefined ? p.value : p));
              } else if (valChunk?.queryChunks) {
                vals = valChunk.queryChunks.map((p: any) => (p?.value !== undefined ? p.value : p));
              } else if (valChunk?.value && Array.isArray(valChunk.value)) {
                vals = valChunk.value.map((p: any) => (p?.value !== undefined ? p.value : p));
              }
              conditions.push({ col: colName, op: 'in', val: vals });
              break;
            } else if (nextStr.includes('is null')) {
              conditions.push({ col: colName, op: 'isNull' });
              break;
            }
          }
        }
      }
      return conditions;
    }
    return [];
  }

  function matchesRow(row: any, cond: { col: string; op: string; val?: any }): boolean {
    const camelCol = cond.col.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
    const actualVal = row[camelCol] !== undefined ? row[camelCol] : row[cond.col];
    if (cond.op === 'eq') {
      return actualVal === cond.val;
    }
    if (cond.op === 'in') {
      return Array.isArray(cond.val) && cond.val.includes(actualVal);
    }
    if (cond.op === 'isNull') {
      return actualVal === null || actualVal === undefined;
    }
    return true;
  }

  function getStore(tbl: any): any[] | null {
    if (tbl === schema.schools) return state.schoolsStore;
    if (tbl === schema.games) return state.gamesStore;
    if (tbl === schema.playerInvites) return state.playerInvitesStore;
    if (tbl === schema.managerInvites) return state.managerInvitesStore;
    if (tbl === schema.members) return state.membersStore;
    if (tbl === schema.playerIdentities) return state.playerIdentitiesStore;
    if (tbl === schema.studentDemographics) return state.studentDemographicsStore;
    if (tbl === schema.schoolManagers) return state.schoolManagersStore;
    if (tbl === schema.staffMembers) return state.staffMembersStore;
    if (tbl === schema.onboardingConsents) return state.onboardingConsentsStore;
    if (tbl === schema.onboardingContentFlags) return state.onboardingContentFlagsStore;
    return null;
  }

  const mockDb: any = {
    select: vi.fn((_fields?: any) => {
      let currentTable: any = null;
      const joins: Array<{ table: any; on: any }> = [];
      let whereClause: any = null;

      const builder = {
        from: vi.fn((tbl: any) => {
          currentTable = tbl;
          return builder;
        }),
        innerJoin: vi.fn((tbl: any, on: any) => {
          joins.push({ table: tbl, on });
          return builder;
        }),
        leftJoin: vi.fn((tbl: any, on: any) => {
          joins.push({ table: tbl, on });
          return builder;
        }),
        where: vi.fn((clause: any) => {
          whereClause = clause;
          return builder;
        }),
        orderBy: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        then: (resolve: (val: any) => void) => {
          resolve(executeSelect());
        },
      };

      function executeSelect(): any[] {
        const store = getStore(currentTable);
        if (!store) return [];

        const conds = extractConditions(whereClause);

        // Player Invites join Schools & Games
        if (currentTable === schema.playerInvites) {
          const matchingInvites = store.filter((inv) => conds.every((c) => matchesRow(inv, c)));
          if (joins.length > 0) {
            return matchingInvites.map((inv) => {
              const school = state.schoolsStore.find((s) => s.id === inv.schoolId);
              const game = state.gamesStore.find((g) => g.id === inv.gameId);
              return {
                invite: inv,
                schoolId: school?.id ?? inv.schoolId,
                schoolName: school?.name ?? 'Stuyvesant High School',
                schoolSlug: school?.slug ?? 'stuyvesant',
                gameId: game?.id ?? inv.gameId,
                gameName: game?.displayName ?? 'VALORANT',
                gameSlug: game?.slug ?? 'valorant',
              };
            });
          }
          return matchingInvites;
        }

        // Manager invites join Schools only (no game).
        if (currentTable === schema.managerInvites) {
          const matchingInvites = store.filter((inv) => conds.every((c) => matchesRow(inv, c)));
          if (joins.length > 0) {
            return matchingInvites.map((inv) => {
              const school = state.schoolsStore.find((s) => s.id === inv.schoolId);
              return {
                invite: inv,
                schoolId: school?.id ?? inv.schoolId,
                schoolName: school?.name ?? 'Stuyvesant High School',
                schoolSlug: school?.slug ?? 'stuyvesant',
              };
            });
          }
          return matchingInvites;
        }

        // Standard filter for schools, games, members, playerIdentities, studentDemographics
        return store.filter((item) => conds.every((c) => matchesRow(item, c)));
      }

      return builder;
    }),

    insert: vi.fn((tbl: any) => {
      const store = getStore(tbl);
      return {
        values: vi.fn((data: any) => {
          if (tbl === schema.onboardingContentFlags && state.flagsInsertError) throw state.flagsInsertError;
          const record = {
            id: data.id || `gen-${Math.random().toString(36).substring(2, 9)}`,
            createdAt: new Date(),
            ...data,
          };
          if (store) store.push(record);

          return {
            returning: vi.fn(() => Promise.resolve([record])),
            then: (resolve: (v: any) => void) => resolve([record]),
          };
        }),
      };
    }),

    update: vi.fn((tbl: any) => {
      const store = getStore(tbl);
      let setValues: any = {};

      return {
        set: vi.fn((vals: any) => {
          setValues = vals;
          return {
            where: vi.fn((clause: any) => {
              const conds = extractConditions(clause);
              const updatedRecords: any[] = [];
              if (store) {
                for (let i = 0; i < store.length; i++) {
                  if (conds.every((c) => matchesRow(store[i], c))) {
                    store[i] = { ...store[i], ...setValues };
                    updatedRecords.push(store[i]);
                  }
                }
              }
              return {
                returning: vi.fn(() => Promise.resolve(updatedRecords)),
                then: (resolve: (v: any) => void) => resolve(updatedRecords),
              };
            }),
          };
        }),
      };
    }),

    transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return cb(mockDb);
    }),
  };

  return {
    mockUpdateCacheTags,
    mockDb,
    state,
  };
});

// --- MODULE MOCKS ---
afterEach(() => {
  vi.unstubAllEnvs();
});

vi.mock('@/app/lib/db', () => ({
  db: mocks.mockDb,
}));

// Discord identity normally comes from the signed OAuth cookie (needs a request context).
// Default: every invite token has a verified Discord account; `override` replaces it per test.
const discordSession = vi.hoisted(() => ({ override: undefined as any }));
vi.mock('@/app/lib/onboarding/discord-session', () => ({
  readVerifiedDiscord: async (token: string) => {
    if (discordSession.override !== undefined) return discordSession.override;
    const { createHash } = await import('node:crypto');
    return {
      discordUserId: '123456789012345678',
      discordUsername: 'alexchen',
      inGuild: true,
      inviteHash: createHash('sha256').update(token.trim()).digest('hex'),
    };
  },
}));

// Fake Supabase admin client so tests can assert whether an auth user was (not) created.
const authMock = vi.hoisted(() => ({ createUser: vi.fn(), listUsers: vi.fn() }));
vi.mock('@/app/lib/supabase/service', () => ({
  createServiceClient: () => ({ auth: { admin: authMock } }),
}));

vi.mock('@/app/lib/cache', () => ({
  CACHE_TAGS: {
    ROSTERS: 'rosters',
    PLAYERS: 'players',
    MEMBERS: 'members',
    TEAMS: 'teams',
    SCHOOLS: 'schools',
  },
  updateCacheTags: mocks.mockUpdateCacheTags,
}));

// Import implementations under test
import {
  validateInviteToken,
  saveOnboardingDraft,
  submitPlayerOnboarding,
  type PlayerOnboardingSubmission,
} from '@/app/lib/onboarding/wizard-actions';
import { getStudentDemographics } from '@/app/lib/db/queries';

/** Success-path wrapper: expected rejections come back as `{success:false}`; surface them as errors here. */
async function submitOk(params: Parameters<typeof submitPlayerOnboarding>[0]) {
  const result = await submitPlayerOnboarding(params);
  if (!result.success) throw new Error(result.error);
  return result;
}

describe('Milestone 4: Player Onboarding Wizard & Server Actions', () => {
  const schoolId = 'school-stuy-uuid';
  const gameId = 'game-val-uuid';
  const rawToken = 'valid_test_token_12345';
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  beforeEach(() => {
    vi.clearAllMocks();
    discordSession.override = undefined;

    mocks.state.schoolsStore = [
      {
        id: schoolId,
        name: 'Stuyvesant High School',
        slug: 'stuyvesant',
      },
    ];

    mocks.state.gamesStore = [
      {
        id: gameId,
        name: 'Valorant',
        displayName: 'VALORANT',
        slug: 'valorant',
      },
    ];

    mocks.state.managerInvitesStore = [];
    mocks.state.playerInvitesStore = [
      {
        id: 'invite-pending-1',
        schoolId,
        gameId,
        tokenHash,
        intendedFirstName: 'Alex',
        intendedLastName: 'Chen',
        invitedByUserId: 'manager-user-1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days in future
        submissionDraft: null,
        memberId: null,
      },
    ];

    mocks.state.membersStore = [];
    mocks.state.playerIdentitiesStore = [];
    mocks.state.studentDemographicsStore = [];
    mocks.state.schoolManagersStore = [];
    mocks.state.staffMembersStore = [];
    mocks.state.onboardingConsentsStore = [];
  });

  describe('1. Token Hashing & Verification', () => {
    it('successfully validates a valid pending invite token with correct metadata', async () => {
      const result = await validateInviteToken({
        schoolSlug: 'stuyvesant',
        gameSlug: 'valorant',
        token: rawToken,
      });

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.status).toBe('pending');
        expect(result.intendedFirstName).toBe('Alex');
        expect(result.intendedLastName).toBe('Chen');
        expect(result.schoolName).toBe('Stuyvesant High School');
        expect(result.schoolSlug).toBe('stuyvesant');
        expect(result.gameName).toBe('VALORANT');
        expect(result.gameSlug).toBe('valorant');
        expect(result.inviteId).toBe('invite-pending-1');
      }
    });

    it('rejects an empty or whitespace token as invalid', async () => {
      const result = await validateInviteToken({
        schoolSlug: 'stuyvesant',
        gameSlug: 'valorant',
        token: '   ',
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe('invalid');
      if (!result.valid) {
        expect(result.message).toContain('Invalid or non-existent invite link');
      }
    });

    it('returns invalid status if token hash does not match any invite', async () => {
      const result = await validateInviteToken({
        schoolSlug: 'stuyvesant',
        gameSlug: 'valorant',
        token: 'completely_nonexistent_token',
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe('invalid');
      if (!result.valid) {
        expect(result.message).toContain('Invalid or non-existent invite link');
      }
    });

    it('rejects token if URL schoolSlug does not match the invite school', async () => {
      const result = await validateInviteToken({
        schoolSlug: 'bronx-science',
        gameSlug: 'valorant',
        token: rawToken,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe('invalid');
      if (!result.valid) {
        expect(result.message).toContain('requested school');
      }
    });

    it('rejects token if URL gameSlug does not match the invite game', async () => {
      const result = await validateInviteToken({
        schoolSlug: 'stuyvesant',
        gameSlug: 'league-of-legends',
        token: rawToken,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe('invalid');
      if (!result.valid) {
        expect(result.message).toContain('requested game');
      }
    });
  });

  describe('2. Expired, Accepted, Rejected, and Submitted Invite Handling', () => {
    it('returns expired status when invite expiration timestamp has passed', async () => {
      const expiredToken = 'expired_tok_999';
      const expiredHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
      const expiredDate = new Date(Date.now() - 1000 * 60); // 1 minute ago

      mocks.state.playerInvitesStore.push({
        id: 'invite-expired-1',
        schoolId,
        gameId,
        tokenHash: expiredHash,
        intendedFirstName: 'Expired',
        intendedLastName: 'Student',
        invitedByUserId: 'manager-user-1',
        status: 'pending',
        expiresAt: expiredDate,
        submissionDraft: null,
      });

      const result = await validateInviteToken({
        schoolSlug: 'stuyvesant',
        gameSlug: 'valorant',
        token: expiredToken,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe('expired');
      if (result.status === 'expired') {
        expect(result.expiresAt).toEqual(expiredDate);
      }
    });

    it('returns accepted status when invite status is already accepted', async () => {
      mocks.state.playerInvitesStore[0].status = 'accepted';

      const result = await validateInviteToken({
        schoolSlug: 'stuyvesant',
        gameSlug: 'valorant',
        token: rawToken,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe('accepted');
      if (!result.valid) {
        expect(result.message).toContain('already accepted');
      }
    });

    it('returns rejected status with rejection reason when invite was rejected', async () => {
      mocks.state.playerInvitesStore[0].status = 'rejected';
      mocks.state.playerInvitesStore[0].rejectionReason = 'Unverified student account';

      const result = await validateInviteToken({
        schoolSlug: 'stuyvesant',
        gameSlug: 'valorant',
        token: rawToken,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.rejectionReason).toBe('Unverified student account');
      }
    });

    it('returns submitted status when invite is already submitted and pending review', async () => {
      mocks.state.playerInvitesStore[0].status = 'submitted';

      const result = await validateInviteToken({
        schoolSlug: 'stuyvesant',
        gameSlug: 'valorant',
        token: rawToken,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe('submitted');
      if (!result.valid) {
        expect(result.message).toContain('awaiting manager review');
      }
    });
  });

  describe('3. Draft Save & Retrieval', () => {
    it('saves draft data to pending invite and retrieves it upon validation', async () => {
      const draftData = {
        legalFirstName: 'Alexander',
        legalLastName: 'Chen',
        email: 'alex.chen@nycstudents.net',
        graduationYear: 2026,
        riotId: 'Demon1#LFT1',
        discordUsername: 'alexchen#0001',
      };

      const saveResult = await saveOnboardingDraft({
        token: rawToken,
        draftData,
      });

      expect(saveResult.success).toBe(true);
      expect(saveResult.savedAt).toBeDefined();

      // Retrieve via validateInviteToken
      const valResult = await validateInviteToken({
        schoolSlug: 'stuyvesant',
        gameSlug: 'valorant',
        token: rawToken,
      });

      expect(valResult.valid).toBe(true);
      if (valResult.valid) {
        // Legacy self-reported Discord keys are dropped, never read back or trusted.
        const { discordUsername: _legacy, ...expected } = draftData;
        expect(valResult.submissionDraft).toEqual(expected);
        expect(valResult.submissionDraft).not.toHaveProperty('discordUsername');
      }
    });

    it('drops every legacy Discord key from a draft on save', async () => {
      await saveOnboardingDraft({
        token: rawToken,
        draftData: {
          legalFirstName: 'Alexander',
          discordUsername: 'typed',
          discordUserId: '999',
          inGuild: true,
          discordJoinedConfirmed: true,
          discordConnected: true,
        },
      });
      const valResult = await validateInviteToken({
        schoolSlug: 'stuyvesant',
        gameSlug: 'valorant',
        token: rawToken,
      });
      expect(valResult.valid).toBe(true);
      if (valResult.valid) expect(valResult.submissionDraft).toEqual({ legalFirstName: 'Alexander' });
    });

    it('does not crash on, or trust, legacy Discord keys already stored in an existing draft', async () => {
      const row = mocks.state.playerInvitesStore.find((i) => i.tokenHash === tokenHash);
      row.submissionDraft = {
        legalFirstName: 'Alexander',
        discordUsername: 'old-handle',
        discordJoinedConfirmed: true,
        discordConnected: true,
      };
      const valResult = await validateInviteToken({
        schoolSlug: 'stuyvesant',
        gameSlug: 'valorant',
        token: rawToken,
      });
      expect(valResult.valid).toBe(true);
      if (valResult.valid) expect(valResult.submissionDraft).toEqual({ legalFirstName: 'Alexander' });
    });

    it('fails to save draft if token does not match an invite', async () => {
      await expect(
        saveOnboardingDraft({
          token: 'invalid_token_xyz',
          draftData: { test: true },
        })
      ).rejects.toThrow('Invalid or non-existent invite token');
    });

    it('fails to save draft if invite status is not pending', async () => {
      mocks.state.playerInvitesStore[0].status = 'submitted';

      await expect(
        saveOnboardingDraft({
          token: rawToken,
          draftData: { test: true },
        })
      ).rejects.toThrow('invite status is submitted');
    });
  });

  describe('4. Complete Onboarding Submission Transaction', () => {
    const validSubmission: PlayerOnboardingSubmission = {
      legalFirstName: 'Alex',
      legalLastName: 'Chen',
      email: 'alex.chen@nycstudents.net',
      graduationYear: 2026,
      riotId: 'Demon1#LFT1',
      birthDate: '2008-05-14',
      gender: 'Male',
      race: ['Asian'],
      ethnicity: ['East Asian'],
      countryOfBirth: 'United States',
      primaryLanguageAtHome: 'English',
      isFreeOrReducedLunch: true,
      isFirstGenCollege: false,
      doePetitionConsent: true,
      surveyDetails: {
        ping: '20-40ms',
        hoursPerWeek: '6-10 hrs',
        internetReliability: 'Fiber',
        careerInterests: ['Competitive Esports Player'],
        feedback: 'Excited for the upcoming season!',
      },
      codeOfConductAccepted: true,
      consent: { tosAcknowledged: true },
    };

    it('atomically creates member, Riot identity, Discord identity, demographics vault, and marks invite submitted', async () => {
      const result = await submitOk({
        token: rawToken,
        submission: validSubmission,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('submitted');
      expect(result.inviteId).toBe('invite-pending-1');
      expect(result.memberId).toBeDefined();

      // 1. Verify member record
      const member = mocks.state.membersStore.find((m) => m.id === result.memberId);
      expect(member).toBeDefined();
      expect(member.firstName).toBe('Alex');
      expect(member.lastName).toBe('Chen');
      expect(member.email).toBe('alex.chen@nycstudents.net');
      expect(member.discord).toBe('alexchen');
      expect(member.graduationYear).toBe(2026);
      expect(member.schoolId).toBe(schoolId);

      // 2. Verify Riot identity
      const riotIdentity = mocks.state.playerIdentitiesStore.find(
        (i) => i.memberId === result.memberId && i.provider === 'riot'
      );
      expect(riotIdentity).toBeDefined();
      expect(riotIdentity.providerUserId).toBe('Demon1#LFT1');
      expect(riotIdentity.providerUsername).toBe('Demon1#LFT1');
      expect(riotIdentity.inGuild).toBe(false);

      // 3. Verify Discord identity
      const discordIdentity = mocks.state.playerIdentitiesStore.find(
        (i) => i.memberId === result.memberId && i.provider === 'discord'
      );
      expect(discordIdentity).toBeDefined();
      // Identity comes from the verified OAuth cookie; client-supplied values are ignored.
      expect(discordIdentity.providerUserId).toBe('123456789012345678');
      expect(discordIdentity.providerUsername).toBe('alexchen');
      expect(discordIdentity.inGuild).toBe(true);

      // 4. Verify student demographics vault
      const demographics = mocks.state.studentDemographicsStore.find(
        (d) => d.memberId === result.memberId
      );
      expect(demographics).toBeDefined();
      expect(demographics.legalFirstName).toBe('Alex');
      expect(demographics.legalLastName).toBe('Chen');
      expect(demographics.birthDate).toEqual(new Date('2008-05-14'));
      expect(demographics.gender).toBe('Male');
      expect(demographics.race).toEqual(['Asian']);
      expect(demographics.isFreeOrReducedLunch).toBe(true);
      expect(demographics.doePetitionConsent).toBe(true);
      expect(demographics.surveyDetails?.ping).toBe('20-40ms');
      expect(demographics.surveyDetails?.careerInterests).toEqual(['Competitive Esports Player']);

      // 5. Verify invite updated to submitted
      const invite = mocks.state.playerInvitesStore.find((inv) => inv.id === 'invite-pending-1');
      expect(invite.status).toBe('submitted');
      expect(invite.memberId).toBe(result.memberId);
      expect(invite.submittedAt).toBeDefined();

      // 6. Verify cache invalidation was triggered
      expect(mocks.mockUpdateCacheTags).toHaveBeenCalledWith('players', 'members');
    });

    it('upserts existing member by email if student previously registered at school', async () => {
      // Seed existing member
      mocks.state.membersStore.push({
        id: 'existing-member-uuid',
        firstName: 'Alexander',
        lastName: 'Chen',
        email: 'alex.chen@nycstudents.net',
        discord: 'oldtag#1234',
        graduationYear: 2025,
        schoolId,
      });

      const result = await submitOk({
        token: rawToken,
        submission: validSubmission,
      });

      expect(result.memberId).toBe('existing-member-uuid');
      const updatedMember = mocks.state.membersStore.find((m) => m.id === 'existing-member-uuid');
      expect(updatedMember.discord).toBe('alexchen');
      expect(updatedMember.graduationYear).toBe(2026);
    });

    it('rejects submission with invalid Riot ID format', async () => {
      await expect(
        submitOk({
          token: rawToken,
          submission: {
            ...validSubmission,
            riotId: 'InvalidRiotIdNoHash',
          },
        })
      ).rejects.toThrow('Invalid Riot ID format');
    });

    it('rejects submission if code of conduct is not accepted', async () => {
      await expect(
        submitOk({
          token: rawToken,
          submission: {
            ...validSubmission,
            codeOfConductAccepted: false,
          },
        })
      ).rejects.toThrow('You must accept the EZ Esports code of conduct');
    });

    it('rejects submission if email is invalid', async () => {
      await expect(
        submitOk({
          token: rawToken,
          submission: {
            ...validSubmission,
            email: 'not-an-email',
          },
        })
      ).rejects.toThrow('valid email address is required');
    });

    it('rejects submission if birthdate is invalid', async () => {
      await expect(
        submitOk({
          token: rawToken,
          submission: {
            ...validSubmission,
            birthDate: 'invalid-date',
          },
        })
      ).rejects.toThrow('valid date of birth is required');
    });

    describe('consent (Terms of Service and guardian authorization)', () => {
      const guardianConsent = {
        tosAcknowledged: true,
        participantLegalName: 'Riley Chen',
        guardianFullName: 'Morgan Chen',
        guardianRelationship: 'Parent',
        guardianEmail: 'Morgan.Chen@example.com',
        guardianSignature: 'MC',
      };
      // 15 years old on any date this suite runs after 2026.
      const minorSubmission = () => ({
        ...validSubmission,
        birthDate: new Date(Date.UTC(new Date().getUTCFullYear() - 15, 0, 1)).toISOString().slice(0, 10),
      });

      it('records an adult ToS acknowledgment with a server-stamped date', async () => {
        const before = Date.now();
        const result = await submitOk({ token: rawToken, submission: validSubmission });
        const rows = mocks.state.onboardingConsentsStore;
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          memberId: result.memberId,
          inviteKind: 'player',
          inviteId: 'invite-pending-1',
          isMinor: false,
          tosAcknowledged: true,
          participantLegalName: 'Alex Chen',
          guardianFullName: null,
          guardianSignature: null,
        });
        expect(rows[0].formVersion).toBe(CONSENT_FORM_VERSION);
        expect(rows[0].signedAt.getTime()).toBeGreaterThanOrEqual(before);
      });

      it('rejects a submission with no consent object and persists nothing', async () => {
        await expect(
          submitOk({
            token: rawToken,
            submission: { ...validSubmission, consent: undefined as any },
          })
        ).rejects.toThrow('Terms of Service');
        expect(mocks.state.onboardingConsentsStore).toHaveLength(0);
        expect(mocks.state.membersStore).toHaveLength(0);
      });

      it('rejects a submission when the Terms of Service box is unchecked', async () => {
        await expect(
          submitOk({
            token: rawToken,
            submission: { ...validSubmission, consent: { tosAcknowledged: false } },
          })
        ).rejects.toThrow('Terms of Service');
      });

      it('rejects an under-18 submission without guardian authorization', async () => {
        await expect(
          submitOk({
            token: rawToken,
            submission: { ...minorSubmission(), consent: { tosAcknowledged: true } },
          })
        ).rejects.toThrow(/legal name/i);
        expect(mocks.state.onboardingConsentsStore).toHaveLength(0);
      });

      it('rejects an under-18 submission with an invalid guardian email', async () => {
        await expect(
          submitOk({
            token: rawToken,
            submission: { ...minorSubmission(), consent: { ...guardianConsent, guardianEmail: 'nope' } },
          })
        ).rejects.toThrow('guardian email');
      });

      it('stores the full guardian authorization for an under-18 participant', async () => {
        await submitOk({
          token: rawToken,
          submission: { ...minorSubmission(), consent: guardianConsent },
        });
        expect(mocks.state.onboardingConsentsStore[0]).toMatchObject({
          isMinor: true,
          ageAtSigning: 15,
          participantLegalName: 'Riley Chen',
          guardianFullName: 'Morgan Chen',
          guardianRelationship: 'Parent',
          guardianEmail: 'morgan.chen@example.com',
          guardianSignature: 'MC',
        });
      });

      it('rejects a date of birth in the future', async () => {
        await expect(
          submitOk({
            token: rawToken,
            submission: { ...validSubmission, birthDate: '2999-01-01' },
          })
        ).rejects.toThrow('valid date of birth');
      });

      it('never saves consent fields in the invite draft', async () => {
        const saved = await saveOnboardingDraft({
          token: rawToken,
          draftData: { legalFirstName: 'Alex', consent: guardianConsent },
        });
        expect(saved.success).toBe(true);
        const invite = mocks.state.playerInvitesStore.find((i) => i.id === 'invite-pending-1');
        expect(invite.submissionDraft).toEqual({ legalFirstName: 'Alex' });
      });
    });
  });

  describe('4b. Verified Discord requirement (players)', () => {
    const submission: PlayerOnboardingSubmission = {
      legalFirstName: 'Alex',
      legalLastName: 'Chen',
      email: 'alex.chen@nycstudents.net',
      graduationYear: 2027,
      riotId: 'Demon1#LFT1',
      birthDate: '2008-05-14',
      codeOfConductAccepted: true,
      consent: { tosAcknowledged: true },
    };
    const hashOf = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

    it('rejects a player submission when no verified Discord cookie is present', async () => {
      discordSession.override = null;
      const result = await submitPlayerOnboarding({ token: rawToken, submission });
      expect(result).toMatchObject({ success: false, code: 'discord_required' });
      expect(result.success === false && result.error).toContain('reconnect');
      expect(mocks.state.membersStore.find((m) => m.email === submission.email)).toBeUndefined();
      expect(mocks.state.playerIdentitiesStore.filter((i) => i.provider === 'discord')).toHaveLength(0);
    });

    it('rejects a verification that was issued for a different invite', async () => {
      discordSession.override = {
        discordUserId: '123456789012345678',
        discordUsername: 'alexchen',
        inGuild: true,
        inviteHash: hashOf('some_other_invite_token'),
      };
      await expect(submitPlayerOnboarding({ token: rawToken, submission })).resolves.toMatchObject({
        success: false,
        code: 'discord_required',
      });
    });

    it('an expired verification (cookie lapsed after the page loaded) asks the student to reconnect', async () => {
      // readVerifiedDiscord returns null once the signed cookie has expired.
      discordSession.override = null;
      const result = await submitPlayerOnboarding({ token: rawToken, submission });
      expect(result).toMatchObject({ success: false, code: 'discord_required' });
      expect(result.success === false && result.error).toMatch(/expired.*reconnect/i);
    });

    it('rejects when the verified account is not confirmed to be in the server', async () => {
      discordSession.override = {
        discordUserId: '123456789012345678',
        discordUsername: 'alexchen',
        inGuild: false,
        inviteHash: hashOf(rawToken),
      };
      await expect(submitPlayerOnboarding({ token: rawToken, submission })).resolves.toMatchObject({
        success: false,
        code: 'discord_not_in_guild',
      });
    });

    it('ignores client-supplied Discord id, handle and inGuild', async () => {
      const result = await submitOk({ token: rawToken, submission });
      const identity = mocks.state.playerIdentitiesStore.find(
        (i) => i.memberId === result.memberId && i.provider === 'discord'
      );
      expect(identity.providerUserId).toBe('123456789012345678');
      expect(identity.providerUsername).toBe('alexchen');
      expect(identity.inGuild).toBe(true);
      expect(mocks.state.membersStore.find((m) => m.id === result.memberId).discord).toBe('alexchen');
    });

    it('rejects a Discord account already linked to a different member', async () => {
      mocks.state.membersStore.push({ id: 'other-member', email: 'someone.else@nycstudents.net' });
      mocks.state.playerIdentitiesStore.push({
        id: 'ident-other',
        memberId: 'other-member',
        provider: 'discord',
        providerUserId: '123456789012345678',
        providerUsername: 'someone',
        inGuild: true,
      });
      const result = await submitPlayerOnboarding({ token: rawToken, submission });
      expect(result).toMatchObject({ success: false, code: 'discord_already_linked' });
      // Does not reveal who owns the id.
      const text = JSON.stringify(result);
      expect(text).not.toContain('other-member');
      expect(text).not.toContain('someone');
    });

    it('maps a unique-violation race on the Discord identity index to the same friendly result', async () => {
      const originalInsert = mocks.mockDb.insert.getMockImplementation()!;
      mocks.mockDb.insert.mockImplementation((tbl: any) => {
        if (tbl === schema.playerIdentities) {
          return {
            values: (data: any) => {
              if (data.provider === 'discord') {
                const err: any = new Error('duplicate key value violates unique constraint');
                err.code = '23505';
                err.constraint_name = 'player_identities_provider_user_idx';
                throw err;
              }
              return originalInsert(tbl).values(data);
            },
          };
        }
        return originalInsert(tbl);
      });
      try {
        const result = await submitPlayerOnboarding({ token: rawToken, submission });
        expect(result).toMatchObject({ success: false, code: 'discord_already_linked' });
      } finally {
        mocks.mockDb.insert.mockImplementation(originalInsert);
      }
    });

    it('does not swallow unrelated database errors', async () => {
      const originalInsert = mocks.mockDb.insert.getMockImplementation()!;
      mocks.mockDb.insert.mockImplementation((tbl: any) => {
        if (tbl === schema.playerIdentities) {
          throw Object.assign(new Error('boom'), { code: '23505', constraint_name: 'something_else' });
        }
        return originalInsert(tbl);
      });
      try {
        await expect(submitPlayerOnboarding({ token: rawToken, submission })).rejects.toThrow('boom');
      } finally {
        mocks.mockDb.insert.mockImplementation(originalInsert);
      }
    });
  });

  describe('5. Zero-PII Invariant & Permissions Protection', () => {
    it('restricts studentDemographics access to actors with VIEW_STUDENT_DEMOGRAPHICS permission', async () => {
      const memberId = 'member-demographics-test-id';
      mocks.state.studentDemographicsStore.push({
        id: 'demographics-1',
        memberId,
        legalFirstName: 'Alex',
        legalLastName: 'Chen',
        birthDate: new Date('2008-05-14'),
        gender: 'Male',
        race: ['Asian'],
        countryOfBirth: 'United States',
        isFreeOrReducedLunch: true,
      });

      // 1. General staff without VIEW_STUDENT_DEMOGRAPHICS permission -> throws ForbiddenPiiAccessError
      const generalStaffPerms = Permissions.MANAGE_ROSTERS | Permissions.MANAGE_MATCHES;
      await expect(
        getStudentDemographics(memberId, generalStaffPerms, false)
      ).rejects.toThrow(ForbiddenPiiAccessError);

      // 2. Staff with VIEW_STUDENT_DEMOGRAPHICS permission -> succeeds
      const compliancePerms = Permissions.VIEW_STUDENT_DEMOGRAPHICS;
      const demo = await getStudentDemographics(memberId, compliancePerms, false);
      expect(demo).toBeDefined();
      expect(demo!.legalFirstName).toBe('Alex');
      expect(demo!.isFreeOrReducedLunch).toBe(true);

      // 3. Administrator / Owner -> succeeds
      const adminDemo = await getStudentDemographics(memberId, Permissions.ADMINISTRATOR, false);
      expect(adminDemo).toBeDefined();
      expect(adminDemo!.race).toEqual(['Asian']);

      const ownerDemo = await getStudentDemographics(memberId, BigInt(0), true);
      expect(ownerDemo).toBeDefined();
    });

    it('ensures manager queries never project or leak demographic fields', () => {
      // In manager portal queries, only non-PII fields are projected
      const managerAllowedFields = ['playerName', 'ign', 'discord', 'grade', 'schoolName', 'gameName'];
      const sensitivePiiFields = [
        'birthDate',
        'gender',
        'race',
        'ethnicity',
        'countryOfBirth',
        'parentsCountryOfBirth',
        'primaryLanguageAtHome',
        'isFreeOrReducedLunch',
        'isFirstGenCollege',
      ];

      for (const pii of sensitivePiiFields) {
        expect(managerAllowedFields).not.toContain(pii);
      }
    });
  });

  describe('6. Manager Onboarding & Provisioning Flow', () => {
    const managerToken = 'manager_test_token_secret_999';
    const managerTokenHash = crypto.createHash('sha256').update(managerToken).digest('hex');

    beforeEach(() => {
      mocks.state.managerInvitesStore.push({
        id: 'manager-invite-1',
        schoolId,
        tokenHash: managerTokenHash,
        intendedFirstName: 'Sam',
        intendedLastName: 'Miller',
        invitedByUserId: 'staff-admin-id',
        status: 'pending',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        submissionDraft: {
          email: 'smiller@stuy.edu',
          academicYear: '2026-27',
          managedGames: null,
          isPrimaryContact: true,
        },
        memberId: null,
      });
    });

    it('successfully validates a manager invite token matching gameSlug=manager', async () => {
      const result = await validateInviteToken({
        schoolSlug: 'stuyvesant',
        gameSlug: 'manager',
        token: managerToken,
      });

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.role).toBe('manager');
        expect(result.gameSlug).toBe('manager');
        expect(result.gameName).toBe('School Manager');
        expect(result.gameId).toBeNull();
        expect(result.intendedFirstName).toBe('Sam');
        expect(result.intendedLastName).toBe('Miller');
      }
    });

    it('completes manager onboarding, provisions school_managers record, and transitions invite to accepted', async () => {
      const managerSubmission: PlayerOnboardingSubmission = {
        legalFirstName: 'Samuel',
        legalLastName: 'Miller',
        email: 'smiller@stuy.edu',
        password: 'securePassword123!',
        graduationYear: 2026,
        riotId: 'CoachSam#NA1',
        birthDate: '1988-08-20',
        gender: 'Male',
        codeOfConductAccepted: true,
        consent: { tosAcknowledged: true },
      };

      const result = await submitOk({
        token: managerToken,
        submission: managerSubmission,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('accepted');
      expect(result.role).toBe('manager');
      expect(result.memberId).toBeDefined();

      // 1. Verify member row created
      const member = mocks.state.membersStore.find((m) => m.id === result.memberId);
      expect(member).toBeDefined();
      expect(member.email).toBe('smiller@stuy.edu');

      // 2. Verify school_managers assignment row created
      const managerRow = mocks.state.schoolManagersStore.find(
        (sm) => sm.schoolId === schoolId
      );
      expect(managerRow).toBeDefined();
      expect(managerRow.isActive).toBe(true);
      expect(managerRow.academicYear).toBe('2026-27');
      expect(managerRow.isPrimaryContact).toBe(true);

      // 3. Verify invite status transitioned to accepted
      const invite = mocks.state.managerInvitesStore.find((i) => i.id === 'manager-invite-1');
      expect(invite.status).toBe('accepted');
      expect(invite.memberId).toBe(result.memberId);
      expect(invite.reviewedAt).toBeDefined();

      // 4. Verify cache tags invalidation includes schools
      expect(mocks.mockUpdateCacheTags).toHaveBeenCalledWith('players', 'members', 'schools');
    });

    it('records the season the manager picked in the wizard, overriding the invite-seeded season', async () => {
      const result = await submitOk({
        token: managerToken,
        submission: {
          legalFirstName: 'Samuel',
          legalLastName: 'Miller',
          email: 'smiller@stuy.edu',
          password: 'securePassword123!',
          graduationYear: 2028,
          academicYear: '2026-27',
          riotId: 'CoachSam#NA1',
          birthDate: '1988-08-20',
          codeOfConductAccepted: true,
          consent: { tosAcknowledged: true },
        },
      });

      expect(result.success).toBe(true);
      const managerRow = mocks.state.schoolManagersStore.find((sm) => sm.schoolId === schoolId);
      expect(managerRow.academicYear).toBe('2026-27');
      const member = mocks.state.membersStore.find((m) => m.id === result.memberId);
      expect(member.graduationYear).toBe(2028);
    });

    it('rejects a malformed manager season', async () => {
      await expect(
        submitOk({
          token: managerToken,
          submission: {
            legalFirstName: 'Samuel',
            legalLastName: 'Miller',
            email: 'smiller@stuy.edu',
            password: 'securePassword123!',
            graduationYear: 2028,
            academicYear: '2026-2029',
            riotId: 'CoachSam#NA1',
            birthDate: '1988-08-20',
            codeOfConductAccepted: true,
            consent: { tosAcknowledged: true },
          },
        })
      ).rejects.toThrow(/valid season/i);
    });

    it('rejects the legacy YYYY-YYYY manager season format', async () => {
      await expect(
        submitOk({
          token: managerToken,
          submission: {
            legalFirstName: 'Samuel',
            legalLastName: 'Miller',
            email: 'smiller@stuy.edu',
            password: 'securePassword123!',
            graduationYear: 2028,
            academicYear: '2026-2027',
            riotId: 'CoachSam#NA1',
            birthDate: '1988-08-20',
            codeOfConductAccepted: true,
            consent: { tosAcknowledged: true },
          },
        })
      ).rejects.toThrow(/valid season/i);
    });

    const stubSupabaseEnv = () => {
      vi.stubEnv('SUPABASE_SECRET_KEY', 'test-secret');
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://supabase.test');
      authMock.createUser.mockReset();
      authMock.listUsers.mockReset();
      authMock.createUser.mockResolvedValue({ data: { user: { id: 'new-auth-user' } }, error: null });
      authMock.listUsers.mockResolvedValue({ data: { users: [] } });
    };

    it('links manager assignment to existing staff account when email matches', async () => {
      const existingStaffUserId = 'staff-user-uuid-456';
      mocks.state.staffMembersStore.push({
        id: 'staff-rec-1',
        userId: existingStaffUserId,
        email: 'smiller@stuy.edu',
      });

      const managerSubmission: PlayerOnboardingSubmission = {
        legalFirstName: 'Samuel',
        legalLastName: 'Miller',
        email: 'smiller@stuy.edu',
        graduationYear: 2026,
        riotId: 'CoachSam#NA1',
        birthDate: '1988-08-20',
        codeOfConductAccepted: true,
        consent: { tosAcknowledged: true },
      };

      await submitOk({
        token: managerToken,
        submission: managerSubmission,
      });

      const managerRow = mocks.state.schoolManagersStore.find(
        (sm) => sm.schoolId === schoolId
      );
      expect(managerRow).toBeDefined();
      expect(managerRow.userId).toBe(existingStaffUserId);
    });

    // __INSERT_ALSO_PLAYS__
    describe('verified Discord requirement (managers use the same OAuth gate as players)', () => {
      beforeEach(() => {
        stubSupabaseEnv();
      });
      const managerSub = (): PlayerOnboardingSubmission => ({
        legalFirstName: 'Samuel',
        legalLastName: 'Miller',
        email: 'smiller@stuy.edu',
        password: 'securePassword123!',
        graduationYear: 2027,
        riotId: 'CoachSam#NA1',
        birthDate: '1988-08-20',
        codeOfConductAccepted: true,
        consent: { tosAcknowledged: true },
      });

      it('stores the verified Discord identity from the cookie on the manager member', async () => {
        const result = await submitOk({ token: managerToken, submission: managerSub() });
        const identity = mocks.state.playerIdentitiesStore.find(
          (i) => i.memberId === result.memberId && i.provider === 'discord'
        );
        expect(identity).toMatchObject({
          providerUserId: '123456789012345678',
          providerUsername: 'alexchen',
          inGuild: true,
        });
        expect(mocks.state.membersStore.find((m) => m.id === result.memberId).discord).toBe('alexchen');
      });

      it('rejects a manager without a verified Discord cookie and creates nothing', async () => {
        discordSession.override = null;
        const result = await submitPlayerOnboarding({ token: managerToken, submission: managerSub() });
        expect(result).toMatchObject({ success: false, code: 'discord_required' });
        expect(mocks.state.membersStore.find((m) => m.email === 'smiller@stuy.edu')).toBeUndefined();
        expect(mocks.state.schoolManagersStore).toHaveLength(0);
        expect(authMock.createUser).not.toHaveBeenCalled();
        expect(mocks.state.managerInvitesStore.find((i) => i.id === 'manager-invite-1').status).toBe('pending');
      });

      it('rejects a manager whose verification was issued for a different invite', async () => {
        discordSession.override = {
          discordUserId: '123456789012345678',
          discordUsername: 'alexchen',
          inGuild: true,
          inviteHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
        };
        await expect(
          submitPlayerOnboarding({ token: managerToken, submission: managerSub() })
        ).resolves.toMatchObject({ success: false, code: 'discord_required' });
        expect(mocks.state.schoolManagersStore).toHaveLength(0);
        expect(authMock.createUser).not.toHaveBeenCalled();
      });

      it('rejects a manager who is not confirmed in the server', async () => {
        discordSession.override = {
          discordUserId: '123456789012345678',
          discordUsername: 'alexchen',
          inGuild: false,
          inviteHash: managerTokenHash,
        };
        await expect(
          submitPlayerOnboarding({ token: managerToken, submission: managerSub() })
        ).resolves.toMatchObject({ success: false, code: 'discord_not_in_guild' });
        expect(authMock.createUser).not.toHaveBeenCalled();
      });

      it('rejects a Discord account already linked to another member, with wording that fits a manager', async () => {
        mocks.state.membersStore.push({ id: 'other-member', email: 'someone.else@nycstudents.net' });
        mocks.state.playerIdentitiesStore.push({
          id: 'ident-other',
          memberId: 'other-member',
          provider: 'discord',
          providerUserId: '123456789012345678',
          providerUsername: 'someone',
          inGuild: true,
        });
        const result = await submitPlayerOnboarding({ token: managerToken, submission: managerSub() });
        expect(result).toMatchObject({ success: false, code: 'discord_already_linked' });
        const message = result.success === false ? result.error : '';
        expect(message).not.toMatch(/player/i);
        expect(message).toMatch(/different Discord account/i);
        expect(mocks.state.schoolManagersStore).toHaveLength(0);
        expect(authMock.createUser).not.toHaveBeenCalled();
      });

      it('maps a unique-violation race on the Discord identity index to already-linked for a manager', async () => {
        const originalInsert = mocks.mockDb.insert.getMockImplementation()!;
        mocks.mockDb.insert.mockImplementation((tbl: any) => {
          if (tbl === schema.playerIdentities) {
            return {
              values: (data: any) => {
                if (data.provider === 'discord') {
                  const err: any = new Error('duplicate key value violates unique constraint');
                  err.code = '23505';
                  err.constraint_name = 'player_identities_provider_user_idx';
                  throw err;
                }
                return originalInsert(tbl).values(data);
              },
            };
          }
          return originalInsert(tbl);
        });
        try {
          const result = await submitPlayerOnboarding({ token: managerToken, submission: managerSub() });
          expect(result).toMatchObject({ success: false, code: 'discord_already_linked' });
          expect(authMock.createUser).not.toHaveBeenCalled();
        } finally {
          mocks.mockDb.insert.mockImplementation(originalInsert);
        }
      });
    });

    describe('manager password (never kept in the draft, so the server must insist on it)', () => {
      const sub = (password?: string): PlayerOnboardingSubmission => ({
        legalFirstName: 'Samuel',
        legalLastName: 'Miller',
        email: 'smiller@stuy.edu',
        password,
        graduationYear: 2027,
        riotId: 'CoachSam#NA1',
        birthDate: '1988-08-20',
        codeOfConductAccepted: true,
        consent: { tosAcknowledged: true },
      });

      beforeEach(() => {
        stubSupabaseEnv();
      });

      it.each([undefined, '', 'short77'])(
        'rejects a new manager with password %j, creating nothing and no auth user',
        async (password) => {
          const result = await submitPlayerOnboarding({ token: managerToken, submission: sub(password) });
          expect(result).toMatchObject({ success: false, code: 'manager_password_required' });
          expect(result.success === false && result.error).toMatch(/password/i);
          expect(authMock.createUser).not.toHaveBeenCalled();
          expect(mocks.state.membersStore.find((m) => m.email === 'smiller@stuy.edu')).toBeUndefined();
          expect(mocks.state.schoolManagersStore).toHaveLength(0);
          expect(mocks.state.managerInvitesStore.find((i) => i.id === 'manager-invite-1').status).toBe('pending');
        }
      );

      it('provisionManagerAccount itself refuses to create an account without a password (no generated fallback)', async () => {
        const { provisionManagerAccount } = await import('@/app/lib/onboarding/wizard/submission-pipeline');
        await expect(
          provisionManagerAccount(mocks.mockDb as any, {
            email: 'smiller@stuy.edu',
            memberId: 'm1',
            schoolId,
            submissionDraft: null,
          })
        ).rejects.toMatchObject({ code: 'manager_password_required' });
        expect(authMock.createUser).not.toHaveBeenCalled();
      });

      it('creates the auth user with the password the manager chose', async () => {
        await submitOk({ token: managerToken, submission: sub('chosenPassword1') });
        expect(authMock.createUser).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'smiller@stuy.edu', password: 'chosenPassword1' })
        );
      });

      it('lets a manager who already has an auth account onboard without a password', async () => {
        authMock.listUsers.mockResolvedValue({
          data: { users: [{ id: 'existing-auth-user', email: 'SMiller@stuy.edu' }] },
        });
        await submitOk({ token: managerToken, submission: sub(undefined) });
        expect(authMock.createUser).not.toHaveBeenCalled();
        expect(mocks.state.schoolManagersStore[0].userId).toBe('existing-auth-user');
      });
    });

    describe('staff-seeded manager draft keys survive draft saves', () => {
      const draftOf = () => mocks.state.managerInvitesStore.find((i) => i.id === 'manager-invite-1').submissionDraft;

      it('keeps managedGames and isPrimaryContact when the wizard saves its own draft', async () => {
        mocks.state.managerInvitesStore.find((i) => i.id === 'manager-invite-1').submissionDraft = {
          email: 'smiller@stuy.edu',
          academicYear: '2026-27',
          managedGames: ['game-a'],
          isPrimaryContact: true,
        };
        await saveOnboardingDraft({ token: managerToken, draftData: { legalFirstName: 'Sam', academicYear: '2027-28' } });
        expect(draftOf()).toMatchObject({
          legalFirstName: 'Sam',
          managedGames: ['game-a'],
          isPrimaryContact: true,
          academicYear: '2027-28',
        });
      });

      it('ignores an attempt by the browser to overwrite or add the staff-owned keys', async () => {
        const row = mocks.state.managerInvitesStore.find((i) => i.id === 'manager-invite-1');
        row.submissionDraft = { email: 'smiller@stuy.edu', managedGames: ['game-a'], isPrimaryContact: true };
        await saveOnboardingDraft({
          token: managerToken,
          draftData: { legalFirstName: 'Sam', managedGames: null, isPrimaryContact: false },
        });
        expect(draftOf().managedGames).toEqual(['game-a']);
        expect(draftOf().isPrimaryContact).toBe(true);

        mocks.state.managerInvitesStore.find((i) => i.id === 'manager-invite-1').submissionDraft = {
          email: 'smiller@stuy.edu',
        };
        await saveOnboardingDraft({
          token: managerToken,
          draftData: { managedGames: ['x'], isPrimaryContact: true },
        });
        expect(draftOf()).not.toHaveProperty('managedGames');
        expect(draftOf()).not.toHaveProperty('isPrimaryContact');
      });

      it('fills the seeded season back in only when the wizard sent none', async () => {
        await saveOnboardingDraft({ token: managerToken, draftData: { legalFirstName: 'Sam' } });
        expect(draftOf().academicYear).toBe('2026-27');
      });

      it('leaves player drafts unaffected', async () => {
        await saveOnboardingDraft({ token: rawToken, draftData: { legalFirstName: 'Pat', managedGames: ['x'] } });
        const row = mocks.state.playerInvitesStore.find((i) => i.tokenHash === tokenHash);
        expect(row.submissionDraft).toEqual({ legalFirstName: 'Pat', managedGames: ['x'] });
      });
    });
  });

  describe('7. Offensive-content screen and staff-review record', () => {
    const baseSubmission = (): PlayerOnboardingSubmission => ({
      legalFirstName: 'Alex',
      legalLastName: 'Chen',
      email: 'alex.chen@nycstudents.net',
      graduationYear: 2027,
      riotId: 'Demon1#LFT1',
      birthDate: '2008-05-14',
      codeOfConductAccepted: true,
      consent: { tosAcknowledged: true },
    });

    async function submitRaw(submission: PlayerOnboardingSubmission, token = rawToken) {
      return submitPlayerOnboarding({ token, submission });
    }

    beforeEach(() => {
      mocks.state.onboardingContentFlagsStore = [];
      mocks.state.flagsInsertError = null;
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('rejects an offensive name with no override and writes nothing', async () => {
      const result = await submitRaw({ ...baseSubmission(), legalFirstName: 'Fuckface' });
      expect(result).toMatchObject({ success: false, code: 'content_flagged', fields: ['legalFirstName'] });
      expect(mocks.state.membersStore).toHaveLength(0);
      expect(mocks.state.onboardingConsentsStore).toHaveLength(0);
      expect(mocks.state.onboardingContentFlagsStore).toHaveLength(0);
      expect(mocks.state.playerInvitesStore.find((i) => i.id === 'invite-pending-1').status).toBe('pending');
    });

    it('rejects an oversized free-text value outright, quickly, and writes nothing', async () => {
      const start = performance.now();
      const result = await submitRaw({
        ...baseSubmission(),
        surveyDetails: { feedback: 'a'.repeat(100_000) },
        legalLastName: 'f '.repeat(50_000),
      });
      expect(performance.now() - start).toBeLessThan(1000);
      expect(result).toMatchObject({ success: false, code: 'field_too_long', fields: ['legalLastName', 'feedback'] });
      expect(mocks.state.membersStore).toHaveLength(0);
    });

    it('lists every flagged field, across the free-text fields', async () => {
      const result = await submitRaw({
        ...baseSubmission(),
        riotId: 'ShitLord#NA1',
        countryOfBirth: 'bullshit',
        surveyDetails: { feedback: 'this is dumbass' },
      });
      expect(result).toMatchObject({ success: false, code: 'content_flagged' });
      if (!result.success) expect(result.fields).toEqual(['riotId', 'countryOfBirth', 'feedback']);
    });

    it('rejects when only some flagged fields are overridden', async () => {
      const result = await submitRaw({
        ...baseSubmission(),
        legalFirstName: 'Fuckface',
        riotId: 'ShitLord#NA1',
        contentOverrides: ['legalFirstName'],
      });
      expect(result).toMatchObject({ success: false, code: 'content_flagged', fields: ['riotId'] });
      expect(mocks.state.membersStore).toHaveLength(0);
    });

    it('accepts an overridden field and records who overrode what, for staff', async () => {
      const result = await submitRaw({
        ...baseSubmission(),
        riotId: 'ShitLord#NA1',
        contentOverrides: ['riotId'],
      });
      expect(result.success).toBe(true);
      if (!result.success) return;
      const rows = mocks.state.onboardingContentFlagsStore;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        memberId: result.memberId,
        schoolId,
        inviteKind: 'player',
        inviteId: 'invite-pending-1',
      });
      expect(rows[0].flaggedFields).toEqual([
        expect.objectContaining({ field: 'riotId', label: 'Riot ID', value: 'ShitLord#NA1', languages: ['english'] }),
      ]);
      expect(rows[0].flaggedFields[0].matchedTerms).toContain('shit');
    });

    it('writes no flag record when nothing was flagged, even if overrides are sent', async () => {
      const result = await submitRaw({ ...baseSubmission(), contentOverrides: ['legalFirstName', 'riotId', 'bogus'] });
      expect(result.success).toBe(true);
      expect(mocks.state.onboardingContentFlagsStore).toHaveLength(0);
    });

    it('does not flag real names that merely contain a short bad word', async () => {
      const result = await submitRaw({ ...baseSubmission(), legalFirstName: 'Dickson', legalLastName: 'Cockburn-Hancock' });
      expect(result.success).toBe(true);
      expect(mocks.state.onboardingContentFlagsStore).toHaveLength(0);
    });

    it('screens the verified Discord username too, and records its override', async () => {
      discordSession.override = {
        discordUserId: '123456789012345678',
        discordUsername: 'xX_fuckboy_Xx',
        inGuild: true,
        inviteHash: tokenHash,
      };
      const blocked = await submitRaw(baseSubmission());
      expect(blocked).toMatchObject({ success: false, code: 'content_flagged', fields: ['discordUsername'] });
      const ok = await submitRaw({ ...baseSubmission(), contentOverrides: ['discordUsername'] });
      expect(ok.success).toBe(true);
      expect(mocks.state.onboardingContentFlagsStore[0].flaggedFields[0]).toMatchObject({ field: 'discordUsername' });
    });

    it('screens the guardian fields of a minor, and ignores leftover guardian text for an adult', async () => {
      const minorBirth = new Date(Date.UTC(new Date().getUTCFullYear() - 15, 0, 1)).toISOString().slice(0, 10);
      const guardian = {
        tosAcknowledged: true,
        participantLegalName: 'Riley Chen',
        guardianFullName: 'Morgan Chen',
        guardianRelationship: 'Parent',
        guardianEmail: 'morgan@example.com',
        guardianSignature: 'MC',
      };
      const minor = await submitRaw({
        ...baseSubmission(),
        birthDate: minorBirth,
        consent: { ...guardian, guardianFullName: 'Fuck Chen' },
      });
      expect(minor).toMatchObject({ success: false, code: 'content_flagged', fields: ['guardianFullName'] });

      const adult = await submitRaw({ ...baseSubmission(), consent: { tosAcknowledged: true, guardianFullName: 'Fuck Chen' } });
      expect(adult.success).toBe(true);
    });

    it('asks once for a prefilled participant name, not twice', async () => {
      const result = await submitRaw({
        ...baseSubmission(),
        legalLastName: 'Fucker',
        consent: { tosAcknowledged: true, participantLegalName: 'Alex Fucker' },
      });
      expect(result).toMatchObject({ success: false, code: 'content_flagged', fields: ['legalLastName'] });
    });

    it('still completes onboarding, without the record, when migration 0055 is not applied yet', async () => {
      const missing: any = new Error('relation "onboarding_content_flags" does not exist');
      missing.code = '42P01';
      mocks.state.flagsInsertError = missing;
      const result = await submitRaw({ ...baseSubmission(), riotId: 'ShitLord#NA1', contentOverrides: ['riotId'] });
      expect(result.success).toBe(true);
      expect(mocks.state.membersStore).toHaveLength(1);
      expect(mocks.state.onboardingContentFlagsStore).toHaveLength(0);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('0055'));
    });

    it('does not swallow unrelated database errors while recording the override', async () => {
      mocks.state.flagsInsertError = Object.assign(new Error('connection reset'), { code: '08006' });
      await expect(
        submitRaw({ ...baseSubmission(), riotId: 'ShitLord#NA1', contentOverrides: ['riotId'] })
      ).rejects.toThrow('connection reset');
    });

    describe('school managers', () => {
      const managerToken = 'manager_content_token_1';
      const managerHash = crypto.createHash('sha256').update(managerToken).digest('hex');

      beforeEach(() => {
        mocks.state.managerInvitesStore.push({
          id: 'manager-invite-9',
          schoolId,
          tokenHash: managerHash,
          intendedFirstName: 'Sam',
          intendedLastName: 'Miller',
          invitedByUserId: 'staff-admin-id',
          status: 'pending',
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          submissionDraft: { email: 'smiller@stuy.edu', academicYear: '2026-27', managedGames: null, isPrimaryContact: false },
          memberId: null,
        });
        discordSession.override = { discordUserId: '999', discordUsername: 'coach_sam', inGuild: true, inviteHash: managerHash };
        vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
        authMock.listUsers.mockResolvedValue({ data: { users: [] } });
        authMock.createUser.mockResolvedValue({ data: { user: { id: 'auth-user-1' } }, error: null });
      });

      const managerSub = (): PlayerOnboardingSubmission => ({
        ...baseSubmission(),
        legalFirstName: 'Samuel',
        legalLastName: 'Miller',
        email: 'smiller@stuy.edu',
        password: 'securePassword123!',
        birthDate: '1988-08-20',
        riotId: 'DumbassCoach#NA1',
      });

      it('applies the same screen and records kind=manager', async () => {
        const blocked = await submitRaw(managerSub(), managerToken);
        expect(blocked).toMatchObject({ success: false, code: 'content_flagged', fields: ['riotId'] });
        expect(authMock.createUser).not.toHaveBeenCalled();

        const ok = await submitRaw({ ...managerSub(), contentOverrides: ['riotId'] }, managerToken);
        expect(ok.success).toBe(true);
        expect(mocks.state.onboardingContentFlagsStore[0]).toMatchObject({
          inviteKind: 'manager',
          inviteId: 'manager-invite-9',
        });
      });

      it('requires the code of conduct acknowledgement for managers as well as players', async () => {
        await expect(
          submitRaw({ ...managerSub(), riotId: 'CoachSam#NA1', codeOfConductAccepted: false }, managerToken)
        ).rejects.toThrow(/code of conduct/i);
        expect(mocks.state.membersStore).toHaveLength(0);
      });
    });
  });

});
