import crypto from 'crypto';
import type { StaffManagerProvisioningUseCase } from '../ports/use-cases';
import type { DrizzleOnboardingRepository } from '../../adapters/db/drizzle-onboarding-repository';
import { generateCryptoToken } from '../domain/invariants';

export class StaffManagerService implements StaffManagerProvisioningUseCase {
  constructor(private readonly repo: DrizzleOnboardingRepository) {}

  async provisionSchoolManager(
    actor: { id: string; email: string },
    params: {
      schoolId: string;
      email: string;
      userId?: string;
      managedGames?: string[];
      isPrimaryContact?: boolean;
      academicYear?: string;
    }
  ) {
    const { schoolId, email, userId, managedGames, isPrimaryContact = false, academicYear = '2025-2026' } = params;

    if (!schoolId) return { success: false, error: 'School ID is required.' };
    if (!email || !email.trim()) return { success: false, error: 'Email is required.' };

    const school = await this.repo.findSchoolById(schoolId);
    if (!school) return { success: false, error: 'School not found.' };

    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const foundUserId = await this.repo.resolveStaffUserId(email);
      resolvedUserId = foundUserId || crypto.randomUUID();
    }

    const manager = await this.repo.createOrUpdateSchoolManager({
      schoolId,
      userId: resolvedUserId,
      academicYear: academicYear.trim(),
      managedGames: managedGames ?? null,
      isPrimaryContact: Boolean(isPrimaryContact),
    });

    await this.repo.writeStaffAuditLog({
      event: 'provision_school_manager',
      userId: actor.id,
      email: actor.email,
      details: {
        schoolId,
        schoolName: school.name,
        managerId: manager.id,
        targetEmail: email.trim().toLowerCase(),
        userId: resolvedUserId,
        academicYear,
        managedGames: managedGames ?? null,
        isPrimaryContact: Boolean(isPrimaryContact),
      },
    });

    return {
      success: true,
      manager,
      message: `Successfully provisioned manager for ${school.name}`,
    };
  }

  async removeSchoolManager(actor: { id: string; email: string }, params: { managerId: string }) {
    if (!params.managerId) return { success: false, error: 'Manager ID is required.' };

    const existing = await this.repo.findManagerById(params.managerId);
    if (!existing) {
      return { success: false, error: 'School manager not found.' };
    }

    const updated = await this.repo.removeSchoolManager(params.managerId);

    await this.repo.writeStaffAuditLog({
      event: 'remove_school_manager',
      userId: actor.id,
      email: actor.email,
      details: {
        managerId: params.managerId,
        schoolId: existing.schoolId,
        userId: existing.userId,
      },
    });

    return {
      success: true,
      manager: updated ?? undefined,
      message: 'School manager deactivated successfully.',
    };
  }

  async getSchoolManagers(schoolId: string) {
    if (!schoolId) return [];
    return this.repo.findSchoolManagers(schoolId);
  }

  async generateManagerInvite(
    actor: { id: string; email: string },
    params: {
      schoolId: string;
      firstName: string;
      lastName: string;
      email?: string;
      academicYear?: string;
      managedGames?: string[] | null;
      isPrimaryContact?: boolean;
    }
  ) {
    const { schoolId, firstName, lastName, email, academicYear = '2025-2026', managedGames = null, isPrimaryContact = false } = params;

    if (!schoolId) return { success: false, error: 'School ID is required.' };
    if (!firstName?.trim() || !lastName?.trim()) return { success: false, error: 'First name and last name are required.' };

    const school = await this.repo.findSchoolById(schoolId);
    if (!school) return { success: false, error: 'School not found.' };

    const { token, tokenHash } = generateCryptoToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days TTL

    const invite = await this.repo.createManagerInvite({
      schoolId,
      tokenHash,
      intendedFirstName: firstName.trim(),
      intendedLastName: lastName.trim(),
      invitedByUserId: actor.id,
      expiresAt,
      draft: {
        email: email?.trim() || undefined,
        academicYear: academicYear.trim(),
        managedGames: managedGames ?? null,
        isPrimaryContact: Boolean(isPrimaryContact),
      },
    });

    await this.repo.writeStaffAuditLog({
      event: 'generate_manager_invite',
      userId: actor.id,
      email: actor.email,
      details: {
        schoolId,
        inviteId: invite.id,
        intendedName: `${firstName.trim()} ${lastName.trim()}`,
        academicYear,
      },
    });

    const inviteUrl = `/join/${school.slug}/manager?token=${token}`;

    return {
      success: true,
      token,
      inviteUrl,
      inviteId: invite.id,
    };
  }

  async getSchoolManagerInvites(schoolId: string) {
    if (!schoolId) return [];
    return this.repo.listSchoolManagerInvites(schoolId);
  }

  async revokeManagerInvite(actor: { id: string; email: string }, inviteId: string) {
    if (!inviteId) return { success: false, error: 'Invite ID required' };

    await this.repo.revokeManagerInvite(inviteId);

    await this.repo.writeStaffAuditLog({
      event: 'revoke_manager_invite',
      userId: actor.id,
      email: actor.email,
      details: { inviteId },
    });

    return { success: true };
  }

  async getRegisteredManagers(searchQuery?: string) {
    return this.repo.findRegisteredManagers(searchQuery);
  }

  async assignExistingManager(
    actor: { id: string; email: string },
    params: {
      schoolId: string;
      userId?: string;
      memberId?: string;
      email?: string;
      academicYear?: string;
      managedGames?: string[] | null;
      isPrimaryContact?: boolean;
    }
  ) {
    const { schoolId, userId, memberId, email, academicYear = '2025-2026', managedGames = null, isPrimaryContact = false } = params;

    if (!schoolId) return { success: false, error: 'School ID is required.' };
    if (!userId && !memberId && !email) return { success: false, error: 'Either userId, memberId, or email is required.' };

    const school = await this.repo.findSchoolById(schoolId);
    if (!school) return { success: false, error: 'School not found.' };

    let resolvedUserId = userId;
    if (!resolvedUserId && email) {
      resolvedUserId = (await this.repo.resolveStaffUserId(email)) || undefined;
    }
    if (!resolvedUserId) {
      resolvedUserId = crypto.randomUUID();
    }

    const manager = await this.repo.createOrUpdateSchoolManager({
      schoolId,
      userId: resolvedUserId,
      memberId: memberId ?? null,
      academicYear: academicYear.trim(),
      managedGames: managedGames ?? null,
      isPrimaryContact: Boolean(isPrimaryContact),
    });

    await this.repo.writeStaffAuditLog({
      event: 'assign_existing_manager',
      userId: actor.id,
      email: actor.email,
      details: {
        schoolId,
        schoolName: school.name,
        managerId: manager.id,
        userId: resolvedUserId,
        memberId: memberId ?? null,
        academicYear,
        managedGames: managedGames ?? null,
        isPrimaryContact: Boolean(isPrimaryContact),
      },
    });

    return {
      success: true,
      manager,
      message: `Successfully assigned manager to ${school.name}`,
    };
  }
}
