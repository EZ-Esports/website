import type { SchoolManagerPortalUseCase } from '../ports/use-cases';
import type { OnboardingRepositoryPort } from '../ports/repository-port';
import type {
  CompetitiveRole,
  SchoolManagerContext,
  SchoolPlayerPoolItem,
  SchoolRosterWithPlayers,
} from '../domain/types';
import { generateCryptoToken, assertManagerTenancy } from '../domain/invariants';

export class PortalService implements SchoolManagerPortalUseCase {
  constructor(private readonly repo: OnboardingRepositoryPort) {}

  async getSchoolPortalData(context: SchoolManagerContext): Promise<{
    schoolId: string;
    schoolName: string;
    academicYear: string;
    rosters: SchoolRosterWithPlayers[];
    pendingInvites: any[];
    pendingSubmissions: any[];
  }> {
    const school = await this.repo.findSchoolById(context.schoolId);
    const rosters = await this.repo.findSchoolRosters(context.schoolId, context.managedGames);
    const pendingInvites = await this.repo.listSchoolInvites(context.schoolId);
    const pendingSubmissions = await this.repo.listPendingSubmissions(context.schoolId);

    return {
      schoolId: context.schoolId,
      schoolName: school?.name || context.schoolName,
      academicYear: context.academicYear,
      rosters,
      pendingInvites,
      pendingSubmissions,
    };
  }

  async getSchoolPlayerPool(
    context: SchoolManagerContext,
    gameId?: string
  ): Promise<SchoolPlayerPoolItem[]> {
    assertManagerTenancy(context, context.schoolId, gameId);
    return this.repo.findSchoolPlayerPool(context.schoolId, gameId);
  }

  async createPlayerInvite(
    context: SchoolManagerContext,
    params: {
      gameId: string;
      intendedFirstName: string;
      intendedLastName: string;
    }
  ) {
    const { gameId, intendedFirstName, intendedLastName } = params;

    if (!gameId || !intendedFirstName?.trim() || !intendedLastName?.trim()) {
      return { success: false, error: 'Game, first name, and last name are required.' };
    }

    assertManagerTenancy(context, context.schoolId, gameId);

    const school = await this.repo.findSchoolById(context.schoolId);
    const game = await this.repo.findGameById(gameId);

    if (!school || !game) {
      return { success: false, error: 'School or game not found.' };
    }

    const { token, tokenHash } = generateCryptoToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days TTL

    const invite = await this.repo.createPlayerInvite({
      schoolId: context.schoolId,
      gameId,
      tokenHash,
      intendedFirstName: intendedFirstName.trim(),
      intendedLastName: intendedLastName.trim(),
      invitedByUserId: context.userId,
      expiresAt,
    });

    const inviteUrl = `/join/${school.slug}/${game.slug}?token=${token}`;

    return {
      success: true,
      token,
      inviteUrl,
      invite,
    };
  }

  async reviewPlayerInvite(
    context: SchoolManagerContext,
    params: {
      inviteId: string;
      decision: 'approved' | 'rejected';
      rejectionReason?: string;
      targetRosterId?: string | null;
      competitiveRole?: CompetitiveRole;
    }
  ) {
    const { inviteId, decision, rejectionReason: _rejectionReason, targetRosterId, competitiveRole = 'starter' } = params;

    const invite = await this.repo.findInviteById(inviteId);
    if (!invite) {
      return { success: false, error: 'Invite not found.' };
    }

    assertManagerTenancy(context, invite.schoolId, invite.gameId);

    if (decision === 'rejected') {
      await this.repo.revokePlayerInvite(inviteId);
      return { success: true };
    }

    if (!invite.submissionDraft) {
      return { success: false, error: 'Candidate has not submitted onboarding information.' };
    }

    const result = await this.repo.approveInviteAndEnroll({
      inviteId,
      schoolId: invite.schoolId,
      gameId: invite.gameId || '',
      draft: invite.submissionDraft,
      targetRosterId,
      competitiveRole,
    });

    return {
      success: true,
      enrolledPlayer: result.playerId
        ? {
            playerId: result.playerId,
            rosterId: targetRosterId!,
            memberId: result.memberId,
            role: competitiveRole,
            isCaptain: competitiveRole === 'captain',
          }
        : undefined,
    };
  }

  async enrollPlayerToRoster(
    context: SchoolManagerContext,
    params: {
      rosterId: string;
      memberId: string;
      ign?: string | null;
      role?: CompetitiveRole;
    }
  ) {
    const { rosterId, memberId, ign, role = 'starter' } = params;

    const roster = await this.repo.findRosterById(rosterId);
    if (!roster) {
      return { success: false, error: 'Roster not found.' };
    }

    assertManagerTenancy(context, roster.schoolId, roster.gameId);

    const enrolled = await this.repo.enrollPlayerToRoster({
      rosterId,
      schoolId: roster.schoolId,
      gameId: roster.gameId,
      memberId,
      ign,
      role,
    });

    return {
      success: true,
      enrolled,
    };
  }

  async removePlayerFromRoster(
    context: SchoolManagerContext,
    params: {
      rosterId: string;
      playerId: string;
    }
  ) {
    const roster = await this.repo.findRosterById(params.rosterId);
    if (!roster) return { success: false, error: 'Roster not found.' };

    assertManagerTenancy(context, roster.schoolId, roster.gameId);
    await this.repo.removePlayerFromRoster(params);
    return { success: true };
  }

  async updateRosterPlayerRole(
    context: SchoolManagerContext,
    params: {
      rosterId: string;
      playerId: string;
      role: CompetitiveRole;
    }
  ) {
    const roster = await this.repo.findRosterById(params.rosterId);
    if (!roster) return { success: false, error: 'Roster not found.' };

    assertManagerTenancy(context, roster.schoolId, roster.gameId);
    await this.repo.updateRosterPlayerRole(params);
    return { success: true };
  }

  async emergencySwapSub(
    context: SchoolManagerContext,
    params: {
      rosterId: string;
      currentStarterId: string;
      substitutePlayerId: string;
    }
  ) {
    const roster = await this.repo.findRosterById(params.rosterId);
    if (!roster) return { success: false, error: 'Roster not found.' };

    assertManagerTenancy(context, roster.schoolId, roster.gameId);
    await this.repo.emergencySwapSub(params);
    return { success: true };
  }

  async revokePlayerInvite(context: SchoolManagerContext, inviteId: string) {
    const invite = await this.repo.findInviteById(inviteId);
    if (!invite) return { success: false, error: 'Invite not found.' };

    assertManagerTenancy(context, invite.schoolId, invite.gameId);
    await this.repo.revokePlayerInvite(inviteId);
    return { success: true };
  }
}
