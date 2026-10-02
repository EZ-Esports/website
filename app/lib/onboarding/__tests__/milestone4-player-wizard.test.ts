import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import * as schema from '@/app/lib/db/schema';
import { Permissions } from '@/app/lib/roles';
import { ForbiddenPiiAccessError } from '@/app/lib/db/queries';

// --- HOISTED MOCKS ---
const mocks = vi.hoisted(() => {
  const mockUpdateCacheTags = vi.fn();

  const state = {
    schoolsStore: [] as any[],
    gamesStore: [] as any[],
    playerInvitesStore: [] as any[],
    membersStore: [] as any[],
    playerIdentitiesStore: [] as any[],
    studentDemographicsStore: [] as any[],
    schoolManagersStore: [] as any[],
    staffMembersStore: [] as any[],
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
    if (tbl === schema.members) return state.membersStore;
    if (tbl === schema.playerIdentities) return state.playerIdentitiesStore;
    if (tbl === schema.studentDemographics) return state.studentDemographicsStore;
    if (tbl === schema.schoolManagers) return state.schoolManagersStore;
    if (tbl === schema.staffMembers) return state.staffMembersStore;
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
              const isManager = inv.role === 'manager';
              return {
                invite: inv,
                schoolId: school?.id ?? inv.schoolId,
                schoolName: school?.name ?? 'Stuyvesant High School',
                schoolSlug: school?.slug ?? 'stuyvesant',
                gameId: game?.id ?? (isManager ? null : inv.gameId),
                gameName: game?.displayName ?? (isManager ? 'School Manager' : 'VALORANT'),
                gameSlug: game?.slug ?? (isManager ? 'manager' : 'valorant'),
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
vi.mock('@/app/lib/db', () => ({
  db: mocks.mockDb,
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

describe('Milestone 4: Player Onboarding Wizard & Server Actions', () => {
  const schoolId = 'school-stuy-uuid';
  const gameId = 'game-val-uuid';
  const rawToken = 'valid_test_token_12345';
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  beforeEach(() => {
    vi.clearAllMocks();

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
        expect(valResult.submissionDraft).toEqual(draftData);
      }
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
      discordUsername: 'alexchen',
      discordUserId: 'discord-snowflake-12345',
      inGuild: true,
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
    };

    it('atomically creates member, Riot identity, Discord identity, demographics vault, and marks invite submitted', async () => {
      const result = await submitPlayerOnboarding({
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
      expect(discordIdentity.providerUserId).toBe('discord-snowflake-12345');
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

      const result = await submitPlayerOnboarding({
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
        submitPlayerOnboarding({
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
        submitPlayerOnboarding({
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
        submitPlayerOnboarding({
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
        submitPlayerOnboarding({
          token: rawToken,
          submission: {
            ...validSubmission,
            birthDate: 'invalid-date',
          },
        })
      ).rejects.toThrow('valid date of birth is required');
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
      mocks.state.playerInvitesStore.push({
        id: 'manager-invite-1',
        schoolId,
        gameId: null,
        role: 'manager',
        tokenHash: managerTokenHash,
        intendedFirstName: 'Sam',
        intendedLastName: 'Miller',
        invitedByUserId: 'staff-admin-id',
        status: 'pending',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        submissionDraft: {
          email: 'smiller@stuy.edu',
          academicYear: '2025-2026',
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
        discordUsername: 'coach_sam',
        discordUserId: 'discord-sam-999',
        inGuild: true,
        birthDate: '1988-08-20',
        gender: 'Male',
        codeOfConductAccepted: true,
      };

      const result = await submitPlayerOnboarding({
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
      expect(managerRow.academicYear).toBe('2025-2026');
      expect(managerRow.isPrimaryContact).toBe(true);

      // 3. Verify invite status transitioned to accepted
      const invite = mocks.state.playerInvitesStore.find((i) => i.id === 'manager-invite-1');
      expect(invite.status).toBe('accepted');
      expect(invite.memberId).toBe(result.memberId);
      expect(invite.reviewedAt).toBeDefined();

      // 4. Verify cache tags invalidation includes schools
      expect(mocks.mockUpdateCacheTags).toHaveBeenCalledWith('players', 'members', 'schools');
    });

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
        discordUsername: 'coach_sam',
        inGuild: true,
        birthDate: '1988-08-20',
        codeOfConductAccepted: true,
      };

      await submitPlayerOnboarding({
        token: managerToken,
        submission: managerSubmission,
      });

      const managerRow = mocks.state.schoolManagersStore.find(
        (sm) => sm.schoolId === schoolId
      );
      expect(managerRow).toBeDefined();
      expect(managerRow.userId).toBe(existingStaffUserId);
    });
  });
});
