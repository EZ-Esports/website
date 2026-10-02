import type { CandidateOnboardingUseCase } from '../ports/use-cases';
import type { OnboardingRepositoryPort } from '../ports/repository-port';
import type { GameIdentityPort } from '../ports/external-ports';
import { hashToken, assertValidInviteForSubmission } from '../domain/invariants';
import type { PlayerSubmissionDraft } from '../domain/types';

export class CandidateService implements CandidateOnboardingUseCase {
  constructor(
    private readonly repo: OnboardingRepositoryPort,
    private readonly identityPort: GameIdentityPort
  ) {}

  async validateInviteToken(params: {
    token: string;
    schoolSlug?: string;
    gameSlug?: string;
  }) {
    const { token, schoolSlug, gameSlug } = params;

    if (!token?.trim()) {
      return { valid: false, error: 'Invalid or non-existent invite link.' };
    }

    const tokenHash = hashToken(token);
    const invite = await this.repo.findInviteByTokenHash(tokenHash);

    if (!invite) {
      return { valid: false, error: 'Invalid or non-existent invite link.' };
    }

    try {
      assertValidInviteForSubmission(invite);
    } catch (err: unknown) {
      return { valid: false, error: err instanceof Error ? err.message : 'Invalid invitation.' };
    }

    const school = await this.repo.findSchoolById(invite.schoolId);
    if (!school) {
      return { valid: false, error: 'School associated with invite not found.' };
    }

    if (schoolSlug && school.slug.toLowerCase() !== schoolSlug.toLowerCase()) {
      return { valid: false, error: 'Invite link does not match the requested school.' };
    }

    let gameName = 'All Games';
    if (invite.gameId) {
      const game = await this.repo.findGameById(invite.gameId);
      if (game) {
        if (gameSlug && game.slug.toLowerCase() !== gameSlug.toLowerCase()) {
          return { valid: false, error: 'Invite link does not match the requested game.' };
        }
        gameName = game.name;
      }
    }

    return {
      valid: true,
      schoolName: school.name,
      gameName,
      intendedName: `${invite.intendedFirstName} ${invite.intendedLastName}`,
      existingDraft: invite.submissionDraft,
    };
  }

  async saveOnboardingDraft(params: {
    token: string;
    step: number;
    draftData: Partial<PlayerSubmissionDraft>;
  }) {
    const { token, step, draftData } = params;
    if (!token?.trim()) return { success: false, error: 'Token is required' };

    const tokenHash = hashToken(token);
    const invite = await this.repo.findInviteByTokenHash(tokenHash);
    if (!invite) return { success: false, error: 'Invite not found' };

    const mergedDraft: PlayerSubmissionDraft = {
      ...(invite.submissionDraft || { schoolId: invite.schoolId, gameId: invite.gameId || '' }),
      ...draftData,
      step,
    };

    await this.repo.updateInviteDraft(invite.id, mergedDraft);
    return { success: true };
  }

  async submitPlayerOnboarding(params: {
    token: string;
    submissionData: PlayerSubmissionDraft;
  }) {
    const { token, submissionData } = params;
    if (!token?.trim()) return { success: false, error: 'Token is required' };

    const tokenHash = hashToken(token);
    const invite = await this.repo.findInviteByTokenHash(tokenHash);
    if (!invite) return { success: false, error: 'Invite not found' };

    assertValidInviteForSubmission(invite);

    if (submissionData.identities?.riot) {
      const riot = submissionData.identities.riot;
      try {
        const resolved = await this.identityPort.resolveIdentity('valorant', riot.providerUserId);
        riot.providerUsername = resolved.displayName;
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : 'Invalid Riot ID' };
      }
    }

    await this.repo.submitInvite(invite.id, submissionData);

    return {
      success: true,
      message: 'Onboarding submission received. Awaiting school manager approval.',
    };
  }
}
