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
 * joining their staff directory email when available.
 */
export async function getSchoolManagers(schoolId: string) {
  if (!schoolId) return [];

  return db
    .select({
      id: schema.schoolManagers.id,
      schoolId: schema.schoolManagers.schoolId,
      userId: schema.schoolManagers.userId,
      managedGames: schema.schoolManagers.managedGames,
      academicYear: schema.schoolManagers.academicYear,
      isPrimaryContact: schema.schoolManagers.isPrimaryContact,
      isActive: schema.schoolManagers.isActive,
      createdAt: schema.schoolManagers.createdAt,
      updatedAt: schema.schoolManagers.updatedAt,
      email: schema.staffMembers.email,
    })
    .from(schema.schoolManagers)
    .leftJoin(schema.staffMembers, eq(schema.schoolManagers.userId, schema.staffMembers.userId))
    .where(
      and(
        eq(schema.schoolManagers.schoolId, schoolId),
        eq(schema.schoolManagers.isActive, true)
      )
    )
    .orderBy(desc(schema.schoolManagers.isPrimaryContact), asc(schema.schoolManagers.createdAt));
}

