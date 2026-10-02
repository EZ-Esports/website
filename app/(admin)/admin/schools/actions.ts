'use server';
import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import crypto from 'crypto';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';
import { slugify, safeUrl, sanitizeDbError } from '@/app/lib/text-utils';
import { cleanupEntityStorage, isKeyScopedToEntity, sanitizeEntityId } from '@/app/lib/storage';

async function requireSchoolsPermission() {
  return requirePermission(Permissions.MANAGE_SCHOOLS);
}

function revalidateAll() {
  updateTag('schools');
  updateTag('teams');
  revalidatePath('/admin/schools');
  revalidatePath('/');
}

export async function addSchool(formData: FormData) {
  await requireSchoolsPermission();
  const name = formData.get('name') as string;
  const logoUrl = (formData.get('logoUrl') as string) ?? '';
  const rawEntityId = (formData.get('entityId') || formData.get('id')) as string | null;
  const entityId = sanitizeEntityId(rawEntityId);
  const rawStorageKey = (formData.get('storageKey') as string) || null;
  const storageKey = entityId && isKeyScopedToEntity(rawStorageKey, 'schools', entityId) ? rawStorageKey : null;
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;

  if (!name) return { success: false, error: 'School name is required.' };

  const slug = slugify(name);

  try {
    const insertValues: typeof schema.schools.$inferInsert = {
      name,
      slug,
      logoUrl,
      storageKey,
      websiteUrl,
      displayOrder,
    };
    if (entityId) {
      insertValues.id = entityId;
    }
    await db.insert(schema.schools).values(insertValues);

    if (entityId) {
      await cleanupEntityStorage('schools', entityId, storageKey);
    }
  } catch (error) {
    console.error('Failed to add school', error);
    return { success: false, error: sanitizeDbError(error) };
  }
  revalidateAll();
  return { success: true };
}

export async function updateSchool(id: string, formData: FormData) {
  await requireSchoolsPermission();
  const name = formData.get('name') as string;
  const logoUrl = (formData.get('logoUrl') as string) ?? '';
  const rawStorageKey = (formData.get('storageKey') as string) || null;
  const websiteUrl = safeUrl((formData.get('websiteUrl') as string) ?? '');
  const displayOrder = parseInt(formData.get('displayOrder') as string) || 0;

  if (!name) return { success: false, error: 'School name is required.' };

  try {
    const [old] = await db
      .select({ storageKey: schema.schools.storageKey })
      .from(schema.schools)
      .where(eq(schema.schools.id, id))
      .limit(1);

    // Only accept storage keys strictly scoped to this entity folder
    const validNewStorageKey = isKeyScopedToEntity(rawStorageKey, 'schools', id) ? rawStorageKey : null;
    const storageKey = validNewStorageKey ?? (rawStorageKey === '' ? null : (old?.storageKey && isKeyScopedToEntity(old.storageKey, 'schools', id) ? old.storageKey : null));

    // Scope cleanup strictly to this entity folder
    await cleanupEntityStorage('schools', id, storageKey);

    await db
      .update(schema.schools)
      .set({ name, logoUrl, storageKey, websiteUrl, displayOrder })
      .where(eq(schema.schools.id, id));
  } catch (error) {
    console.error('Failed to update school', error);
    return { success: false, error: sanitizeDbError(error) };
  }
  revalidateAll();
  return { success: true };
}

export async function deleteSchool(id: string) {
  const user = await requireSchoolsPermission();

  await db.update(schema.schools).set({ deletedAt: new Date(), deletedBy: user.id }).where(eq(schema.schools.id, id));

  // Scope cleanup strictly to that entity's folder in Supabase Storage
  await cleanupEntityStorage('schools', id);

  revalidateAll();
}

export async function toggleSchoolActive(id: string, isActive: boolean) {
  await requireSchoolsPermission();
  try {
    await db
      .update(schema.schools)
      .set({ isActive })
      .where(eq(schema.schools.id, id));
  } catch (error) {
    console.error('Failed to toggle school active state', error);
    return { success: false, error: 'Could not update status. Please try again.' };
  }
  revalidateAll();
  return { success: true };
}

export interface ProvisionSchoolManagerParams {
  schoolId: string;
  email: string;
  userId?: string;
  managedGames?: string[];
  isPrimaryContact?: boolean;
  academicYear?: string;
}

export interface ProvisionSchoolManagerResult {
  success: boolean;
  error?: string;
  manager?: typeof schema.schoolManagers.$inferSelect;
  message?: string;
}

/**
 * Provisions a school manager for an academic year and optional set of games.
 * Requires Permissions.MANAGE_SCHOOLS.
 * Writes a durable staff audit log entry.
 */
export async function provisionSchoolManager(
  params: ProvisionSchoolManagerParams
): Promise<ProvisionSchoolManagerResult> {
  const actor = await requireSchoolsPermission();

  const { schoolId, email, userId, managedGames, isPrimaryContact, academicYear } = params;

  if (!schoolId) {
    return { success: false, error: 'School ID is required.' };
  }
  if (!email || !email.trim()) {
    return { success: false, error: 'Email is required.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const resolvedAcademicYear = academicYear?.trim() || '2025-2026';

  try {
    // 1. Verify school exists
    const [school] = await db
      .select({ id: schema.schools.id, name: schema.schools.name })
      .from(schema.schools)
      .where(eq(schema.schools.id, schoolId))
      .limit(1);

    if (!school) {
      return { success: false, error: 'School not found.' };
    }

    // 2. Resolve or find userId
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const [staff] = await db
        .select({ userId: schema.staffMembers.userId })
        .from(schema.staffMembers)
        .where(sql`lower(${schema.staffMembers.email}) = ${normalizedEmail}`)
        .limit(1);

      if (staff) {
        resolvedUserId = staff.userId;
      } else {
        resolvedUserId = crypto.randomUUID();
      }
    }

    // 3. If setting primary contact, reset other primary contacts for this school and year
    if (isPrimaryContact) {
      await db
        .update(schema.schoolManagers)
        .set({ isPrimaryContact: false })
        .where(
          and(
            eq(schema.schoolManagers.schoolId, schoolId),
            eq(schema.schoolManagers.academicYear, resolvedAcademicYear)
          )
        );
    }

    // 4. Check if manager record already exists for this (schoolId, userId, academicYear)
    const [existing] = await db
      .select()
      .from(schema.schoolManagers)
      .where(
        and(
          eq(schema.schoolManagers.schoolId, schoolId),
          eq(schema.schoolManagers.userId, resolvedUserId),
          eq(schema.schoolManagers.academicYear, resolvedAcademicYear)
        )
      )
      .limit(1);

    let managerRecord: typeof schema.schoolManagers.$inferSelect;

    if (existing) {
      const [updated] = await db
        .update(schema.schoolManagers)
        .set({
          isActive: true,
          managedGames: managedGames !== undefined ? managedGames : existing.managedGames,
          isPrimaryContact: isPrimaryContact !== undefined ? isPrimaryContact : existing.isPrimaryContact,
          updatedAt: new Date(),
        })
        .where(eq(schema.schoolManagers.id, existing.id))
        .returning();
      managerRecord = updated;
    } else {
      const [inserted] = await db
        .insert(schema.schoolManagers)
        .values({
          schoolId,
          userId: resolvedUserId,
          managedGames: managedGames ?? null,
          academicYear: resolvedAcademicYear,
          isPrimaryContact: isPrimaryContact ?? false,
          isActive: true,
        })
        .returning();
      managerRecord = inserted;
    }

    // 5. Generate staff audit log
    try {
      await db.insert(schema.staffAuditLogs).values({
        event: 'provision_school_manager',
        userId: actor.id,
        email: actor.email,
        details: JSON.stringify({
          schoolId,
          schoolName: school.name,
          managerId: managerRecord.id,
          targetEmail: normalizedEmail,
          userId: resolvedUserId,
          academicYear: resolvedAcademicYear,
          managedGames: managedGames ?? null,
          isPrimaryContact: isPrimaryContact ?? false,
        }),
      });
    } catch (auditErr) {
      console.error('Failed to log staff audit event for manager provisioning', auditErr);
    }

    revalidateAll();
    return {
      success: true,
      manager: managerRecord,
      message: `Successfully provisioned manager for ${school.name}`,
    };
  } catch (error) {
    console.error('Failed to provision school manager', error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export interface RemoveSchoolManagerParams {
  managerId: string;
}

export interface RemoveSchoolManagerResult {
  success: boolean;
  error?: string;
  manager?: typeof schema.schoolManagers.$inferSelect;
  message?: string;
}

/**
 * Removes (deactivates) a school manager.
 * Requires Permissions.MANAGE_SCHOOLS.
 * Writes a durable staff audit log entry.
 */
export async function removeSchoolManager(
  params: RemoveSchoolManagerParams
): Promise<RemoveSchoolManagerResult> {
  const actor = await requireSchoolsPermission();

  const { managerId } = params;
  if (!managerId) {
    return { success: false, error: 'Manager ID is required.' };
  }

  try {
    const [existing] = await db
      .select()
      .from(schema.schoolManagers)
      .where(eq(schema.schoolManagers.id, managerId))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'School manager not found.' };
    }

    const [updated] = await db
      .update(schema.schoolManagers)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.schoolManagers.id, managerId))
      .returning();

    try {
      await db.insert(schema.staffAuditLogs).values({
        event: 'remove_school_manager',
        userId: actor.id,
        email: actor.email,
        details: JSON.stringify({
          managerId,
          schoolId: existing.schoolId,
          userId: existing.userId,
        }),
      });
    } catch (auditErr) {
      console.error('Failed to log staff audit event for manager removal', auditErr);
    }

    revalidateAll();
    return {
      success: true,
      manager: updated,
      message: 'School manager deactivated successfully.',
    };
  } catch (error) {
    console.error('Failed to remove school manager', error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

/**
 * Retrieves all active school managers for a given school,
 * joining their member name and directory email when available.
 */
export async function getSchoolManagers(schoolId: string) {
  if (!schoolId) return [];

  return db
    .select({
      id: schema.schoolManagers.id,
      schoolId: schema.schoolManagers.schoolId,
      userId: schema.schoolManagers.userId,
      memberId: schema.schoolManagers.memberId,
      managedGames: schema.schoolManagers.managedGames,
      academicYear: schema.schoolManagers.academicYear,
      isPrimaryContact: schema.schoolManagers.isPrimaryContact,
      isActive: schema.schoolManagers.isActive,
      createdAt: schema.schoolManagers.createdAt,
      updatedAt: schema.schoolManagers.updatedAt,
      firstName: schema.members.firstName,
      lastName: schema.members.lastName,
      email: sql<string | null>`coalesce(${schema.members.email}, ${schema.staffMembers.email})`,
    })
    .from(schema.schoolManagers)
    .leftJoin(schema.members, eq(schema.schoolManagers.memberId, schema.members.id))
    .leftJoin(schema.staffMembers, eq(schema.schoolManagers.userId, schema.staffMembers.userId))
    .where(
      and(
        eq(schema.schoolManagers.schoolId, schoolId),
        eq(schema.schoolManagers.isActive, true)
      )
    )
    .orderBy(desc(schema.schoolManagers.isPrimaryContact), asc(schema.schoolManagers.createdAt));
}

export interface RegisteredManagerAccount {
  userId: string;
  memberId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  schools: string[];
}

/**
 * Retrieves all registered manager accounts across the platform.
 * Enables staff to search existing managers rather than typing raw emails.
 */
export async function getRegisteredManagers(
  searchQuery?: string
): Promise<RegisteredManagerAccount[]> {
  await requireSchoolsPermission();

  try {
    // 1. Fetch managers from schoolManagers joined with members, staffMembers, and schools
    const managerRows = await db
      .select({
        userId: schema.schoolManagers.userId,
        memberId: schema.schoolManagers.memberId,
        firstName: schema.members.firstName,
        lastName: schema.members.lastName,
        email: sql<string | null>`coalesce(${schema.members.email}, ${schema.staffMembers.email})`,
        schoolName: schema.schools.name,
      })
      .from(schema.schoolManagers)
      .leftJoin(schema.members, eq(schema.schoolManagers.memberId, schema.members.id))
      .leftJoin(schema.staffMembers, eq(schema.schoolManagers.userId, schema.staffMembers.userId))
      .leftJoin(schema.schools, eq(schema.schoolManagers.schoolId, schema.schools.id));

    // 2. Also fetch members who have an email address (onboarded users)
    const memberRows = await db
      .select({
        memberId: schema.members.id,
        firstName: schema.members.firstName,
        lastName: schema.members.lastName,
        email: schema.members.email,
        schoolName: schema.schools.name,
      })
      .from(schema.members)
      .leftJoin(schema.schools, eq(schema.members.schoolId, schema.schools.id))
      .where(sql`${schema.members.email} IS NOT NULL AND ${schema.members.email} != ''`);

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
          userId: '',
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

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      results = results.filter(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.schools.some((s) => s.toLowerCase().includes(q))
      );
    }

    results.sort((a, b) => a.fullName.localeCompare(b.fullName));
    return results;
  } catch (error) {
    console.error('Failed to get registered managers', error);
    return [];
  }
}

export interface AssignExistingManagerParams {
  schoolId: string;
  userId?: string;
  memberId?: string | null;
  email?: string;
  academicYear?: string;
  managedGames?: string[] | null;
  isPrimaryContact?: boolean;
}

export interface AssignExistingManagerResult {
  success: boolean;
  error?: string;
  manager?: typeof schema.schoolManagers.$inferSelect;
  message?: string;
}

/**
 * Assigns an existing registered manager to a school for an academic year.
 */
export async function assignExistingManager(
  params: AssignExistingManagerParams
): Promise<AssignExistingManagerResult> {
  const actor = await requireSchoolsPermission();

  const {
    schoolId,
    userId: rawUserId,
    memberId,
    email,
    academicYear = '2025-2026',
    managedGames = null,
    isPrimaryContact = false,
  } = params;

  if (!schoolId) {
    return { success: false, error: 'School ID is required.' };
  }

  try {
    const [school] = await db
      .select({ id: schema.schools.id, name: schema.schools.name })
      .from(schema.schools)
      .where(eq(schema.schools.id, schoolId))
      .limit(1);

    if (!school) {
      return { success: false, error: 'School not found.' };
    }

    let resolvedUserId = rawUserId?.trim();

    if (!resolvedUserId) {
      if (memberId) {
        const [sm] = await db
          .select({ userId: schema.schoolManagers.userId })
          .from(schema.schoolManagers)
          .where(eq(schema.schoolManagers.memberId, memberId))
          .limit(1);
        if (sm?.userId) {
          resolvedUserId = sm.userId;
        }
      }

      if (!resolvedUserId && email) {
        const normalizedEmail = email.toLowerCase().trim();
        const [staff] = await db
          .select({ userId: schema.staffMembers.userId })
          .from(schema.staffMembers)
          .where(sql`lower(${schema.staffMembers.email}) = ${normalizedEmail}`)
          .limit(1);
        if (staff?.userId) {
          resolvedUserId = staff.userId;
        }
      }

      if (!resolvedUserId) {
        resolvedUserId = crypto.randomUUID();
      }
    }

    const resolvedAcademicYear = academicYear.trim() || '2025-2026';

    if (isPrimaryContact) {
      await db
        .update(schema.schoolManagers)
        .set({ isPrimaryContact: false })
        .where(
          and(
            eq(schema.schoolManagers.schoolId, schoolId),
            eq(schema.schoolManagers.academicYear, resolvedAcademicYear)
          )
        );
    }

    const [existing] = await db
      .select()
      .from(schema.schoolManagers)
      .where(
        and(
          eq(schema.schoolManagers.schoolId, schoolId),
          eq(schema.schoolManagers.userId, resolvedUserId),
          eq(schema.schoolManagers.academicYear, resolvedAcademicYear)
        )
      )
      .limit(1);

    let managerRecord: typeof schema.schoolManagers.$inferSelect;

    if (existing) {
      const [updated] = await db
        .update(schema.schoolManagers)
        .set({
          isActive: true,
          memberId: memberId ?? existing.memberId,
          managedGames: managedGames !== undefined ? managedGames : existing.managedGames,
          isPrimaryContact:
            isPrimaryContact !== undefined ? isPrimaryContact : existing.isPrimaryContact,
          updatedAt: new Date(),
        })
        .where(eq(schema.schoolManagers.id, existing.id))
        .returning();
      managerRecord = updated;
    } else {
      const [inserted] = await db
        .insert(schema.schoolManagers)
        .values({
          schoolId,
          userId: resolvedUserId,
          memberId: memberId ?? null,
          managedGames: managedGames ?? null,
          academicYear: resolvedAcademicYear,
          isPrimaryContact: Boolean(isPrimaryContact),
          isActive: true,
        })
        .returning();
      managerRecord = inserted;
    }

    try {
      await db.insert(schema.staffAuditLogs).values({
        event: 'assign_existing_manager',
        userId: actor.id,
        email: actor.email,
        details: JSON.stringify({
          schoolId,
          schoolName: school.name,
          managerId: managerRecord.id,
          userId: resolvedUserId,
          memberId: memberId ?? null,
          academicYear: resolvedAcademicYear,
          managedGames: managedGames ?? null,
          isPrimaryContact: Boolean(isPrimaryContact),
        }),
      });
    } catch (auditErr) {
      console.error('Failed to log staff audit event for assign_existing_manager', auditErr);
    }

    revalidateAll();

    return {
      success: true,
      manager: managerRecord,
      message: `Successfully assigned manager to ${school.name}`,
    };
  } catch (error) {
    console.error('Failed to assign existing manager', error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export interface GenerateManagerInviteParams {
  schoolId: string;
  firstName: string;
  lastName: string;
  email?: string;
  academicYear?: string;
  managedGames?: string[] | null;
  isPrimaryContact?: boolean;
}

export interface GenerateManagerInviteResult {
  success: boolean;
  token?: string;
  inviteUrl?: string;
  inviteId?: string;
  error?: string;
}

/**
 * Generates a single-use onboarding invite link for a School Manager.
 * Requires Permissions.MANAGE_SCHOOLS.
 */
export async function generateManagerInvite(
  params: GenerateManagerInviteParams
): Promise<GenerateManagerInviteResult> {
  const actor = await requireSchoolsPermission();

  const {
    schoolId,
    firstName,
    lastName,
    email,
    academicYear = '2025-2026',
    managedGames = null,
    isPrimaryContact = false,
  } = params;

  if (!schoolId) {
    return { success: false, error: 'School ID is required.' };
  }
  if (!firstName?.trim() || !lastName?.trim()) {
    return { success: false, error: 'First name and last name are required.' };
  }

  try {
    const [school] = await db
      .select({ id: schema.schools.id, name: schema.schools.name, slug: schema.schools.slug })
      .from(schema.schools)
      .where(eq(schema.schools.id, schoolId))
      .limit(1);

    if (!school) {
      return { success: false, error: 'School not found.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days TTL

    const [invite] = await db
      .insert(schema.playerInvites)
      .values({
        schoolId,
        gameId: null,
        role: 'manager',
        tokenHash,
        intendedFirstName: firstName.trim(),
        intendedLastName: lastName.trim(),
        invitedByUserId: actor.id,
        status: 'pending',
        expiresAt,
        submissionDraft: {
          email: email?.trim() || undefined,
          academicYear: academicYear.trim(),
          managedGames: managedGames ?? null,
          isPrimaryContact: Boolean(isPrimaryContact),
        },
      })
      .returning();

    try {
      await db.insert(schema.staffAuditLogs).values({
        event: 'generate_manager_invite',
        userId: actor.id,
        email: actor.email,
        details: JSON.stringify({
          schoolId,
          inviteId: invite.id,
          intendedName: `${firstName.trim()} ${lastName.trim()}`,
          academicYear,
        }),
      });
    } catch (auditErr) {
      console.error('Failed to log audit event for manager invite', auditErr);
    }

    const inviteUrl = `/join/${school.slug}/manager?token=${token}`;

    return {
      success: true,
      token,
      inviteUrl,
      inviteId: invite.id,
    };
  } catch (error) {
    console.error('Failed to generate manager invite', error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

/**
 * Retrieves all manager invite tokens for a given school.
 */
export async function getSchoolManagerInvites(schoolId: string) {
  if (!schoolId) return [];

  return db
    .select({
      id: schema.playerInvites.id,
      schoolId: schema.playerInvites.schoolId,
      intendedFirstName: schema.playerInvites.intendedFirstName,
      intendedLastName: schema.playerInvites.intendedLastName,
      status: schema.playerInvites.status,
      expiresAt: schema.playerInvites.expiresAt,
      createdAt: schema.playerInvites.createdAt,
      submittedAt: schema.playerInvites.submittedAt,
      submissionDraft: schema.playerInvites.submissionDraft,
    })
    .from(schema.playerInvites)
    .where(
      and(
        eq(schema.playerInvites.schoolId, schoolId),
        eq(schema.playerInvites.role, 'manager')
      )
    )
    .orderBy(desc(schema.playerInvites.createdAt));
}

/**
 * Revokes a pending manager invite token.
 */
export async function revokeManagerInvite(inviteId: string) {
  const actor = await requireSchoolsPermission();
  if (!inviteId) return { success: false, error: 'Invite ID required' };

  try {
    await db
      .update(schema.playerInvites)
      .set({
        status: 'rejected',
        rejectionReason: 'Revoked by staff administrator',
      })
      .where(eq(schema.playerInvites.id, inviteId));

    try {
      await db.insert(schema.staffAuditLogs).values({
        event: 'revoke_manager_invite',
        userId: actor.id,
        email: actor.email,
        details: JSON.stringify({ inviteId }),
      });
    } catch {}

    return { success: true };
  } catch (error) {
    return { success: false, error: sanitizeDbError(error) };
  }
}

