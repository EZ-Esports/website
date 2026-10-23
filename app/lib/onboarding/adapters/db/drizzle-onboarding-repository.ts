import * as dal from '@/app/lib/db/onboarding-repository';
import type {
  OnboardingRepositoryPort,
  SchoolRecord,
  GameRecord,
  PlayerInviteRecord,
  ManagerInviteRecord,
  SchoolManagerRecord,
} from '../../core/ports/repository-port';
import type { PlayerSubmissionDraft } from '../../core/domain/types';

export interface RegisteredManagerAccount {
  userId: string;
  memberId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  schools: string[];
}

export class DrizzleOnboardingRepository implements OnboardingRepositoryPort {
  // --------------------------------------------------------------------------
  // School & Game Queries
  // --------------------------------------------------------------------------

  async findSchoolById(schoolId: string): Promise<SchoolRecord | null> {
    return dal.findSchoolRowById(schoolId);
  }

  async findSchoolBySlug(slug: string): Promise<SchoolRecord | null> {
    return dal.findSchoolRowBySlug(slug);
  }

  async findGameById(gameId: string): Promise<GameRecord | null> {
    return dal.findGameRowById(gameId);
  }

  async findGameBySlug(slug: string): Promise<GameRecord | null> {
    return dal.findGameRowBySlug(slug);
  }

  // --------------------------------------------------------------------------
  // Invite Operations
  // --------------------------------------------------------------------------

  async findInviteByTokenHash(tokenHash: string): Promise<PlayerInviteRecord | null> {
    return (await dal.findPlayerInviteByTokenHash(tokenHash)) as PlayerInviteRecord | null;
  }

  async updateInviteDraft(inviteId: string, draft: Partial<PlayerSubmissionDraft>): Promise<void> {
    await dal.setPlayerInviteDraft(inviteId, draft);
  }

  async submitInvite(inviteId: string, finalDraft: PlayerSubmissionDraft): Promise<void> {
    await dal.markPlayerInviteFinalSubmitted(inviteId, finalDraft);
  }

  // --------------------------------------------------------------------------
  // School Manager Provisioning & Tenancy
  // --------------------------------------------------------------------------

  async resolveStaffUserId(email: string): Promise<string | null> {
    return dal.findStaffUserIdByNormalizedEmail(email);
  }

  async findSchoolManagers(schoolId: string) {
    return dal.listActiveSchoolManagers(schoolId);
  }

  async findRegisteredManagers(searchQuery?: string): Promise<RegisteredManagerAccount[]> {
    const { managerRows, memberRows } = await dal.loadRegisteredManagerSourceRows();

    const managerMap = new Map<string, RegisteredManagerAccount>();

    for (const row of managerRows) {
      if (!row.email) continue;
      const normalizedEmail = row.email.toLowerCase().trim();
      const existing = managerMap.get(normalizedEmail);
      const schoolName = row.schoolName?.trim();

      if (existing) {
        if (schoolName && !existing.schools.includes(schoolName)) {
          existing.schools.push(schoolName);
        }
        if (!existing.memberId && row.memberId) {
          existing.memberId = row.memberId;
        }
      } else {
        const fn = (row.firstName || '').trim();
        const ln = (row.lastName || '').trim();
        const fullName = `${fn} ${ln}`.trim() || normalizedEmail;
        managerMap.set(normalizedEmail, {
          userId: row.userId,
          memberId: row.memberId ?? null,
          firstName: fn,
          lastName: ln,
          fullName,
          email: row.email,
          schools: schoolName ? [schoolName] : [],
        });
      }
    }

    for (const row of memberRows) {
      if (!row.email) continue;
      const normalizedEmail = row.email.toLowerCase().trim();
      const existing = managerMap.get(normalizedEmail);
      const schoolName = row.schoolName?.trim();

      if (existing) {
        if (schoolName && !existing.schools.includes(schoolName)) {
          existing.schools.push(schoolName);
        }
        if (!existing.memberId && row.memberId) {
          existing.memberId = row.memberId;
        }
      } else {
        const fn = (row.firstName || '').trim();
        const ln = (row.lastName || '').trim();
        const fullName = `${fn} ${ln}`.trim() || normalizedEmail;
        managerMap.set(normalizedEmail, {
          userId: `mem-usr-${row.memberId}`,
          memberId: row.memberId,
          firstName: fn,
          lastName: ln,
          fullName,
          email: row.email,
          schools: schoolName ? [schoolName] : [],
        });
      }
    }

    let results = Array.from(managerMap.values());
    if (searchQuery?.trim()) {
      const q = searchQuery.toLowerCase().trim();
      results = results.filter(
        (a) =>
          a.email.toLowerCase().includes(q) ||
          a.fullName.toLowerCase().includes(q) ||
          a.schools.some((s) => s.toLowerCase().includes(q))
      );
    }
    return results;
  }

  async findManagerById(managerId: string): Promise<SchoolManagerRecord | null> {
    return (await dal.findSchoolManagerRowById(managerId)) as SchoolManagerRecord | null;
  }

  async createOrUpdateSchoolManager(params: {
    schoolId: string;
    userId: string;
    memberId?: string | null;
    academicYear: string;
    managedGames?: string[] | null;
    isPrimaryContact: boolean;
  }): Promise<SchoolManagerRecord> {
    return (await dal.upsertSchoolManagerAssignment(params)) as SchoolManagerRecord;
  }

  async removeSchoolManager(managerId: string): Promise<SchoolManagerRecord | null> {
    return (await dal.deactivateSchoolManager(managerId)) as SchoolManagerRecord | null;
  }

  async createManagerInvite(params: {
    schoolId: string;
    tokenHash: string;
    intendedFirstName: string;
    intendedLastName: string;
    invitedByUserId: string;
    expiresAt: Date;
    draft?: Record<string, unknown>;
  }): Promise<ManagerInviteRecord> {
    return (await dal.insertManagerInvite(params)) as ManagerInviteRecord;
  }

  async listSchoolManagerInvites(schoolId: string): Promise<ManagerInviteRecord[]> {
    return (await dal.listManagerInvitesForSchool(schoolId)) as ManagerInviteRecord[];
  }

  async revokeManagerInvite(inviteId: string): Promise<void> {
    await dal.markManagerInviteRevoked(inviteId);
  }

  async writeStaffAuditLog(params: {
    event: string;
    userId: string;
    email: string;
    details: Record<string, unknown>;
  }): Promise<void> {
    try {
      await dal.insertStaffAuditLog(params);
    } catch (err) {
      console.error('Failed to write staff audit log', err);
    }
  }
}
