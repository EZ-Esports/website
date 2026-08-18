'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createServiceClient } from '@/app/lib/supabase/service';
import { sanitizeDbError } from '@/app/lib/text-utils';
import { classifyRole } from '@/db/backfill-leadership';

const BUCKET = 'admin-uploads';

async function cleanupStorageKey(oldKey: string | null | undefined, newKey: string | null | undefined) {
  if (oldKey && oldKey !== newKey) {
    try {
      const supabase = createServiceClient();
      await supabase.storage.from(BUCKET).remove([oldKey]);
    } catch (err) {
      console.error('Failed to cleanup old avatar file:', err);
    }
  }
}

function revalidateLeadership(years: (string | undefined | null)[]) {
  revalidateTag('leadership', {});
  revalidateTag('people', {});
  revalidatePath('/admin/leadership');
  revalidatePath('/leadership');
  for (const y of years) {
    if (y) revalidatePath(`/leadership/${y}`);
  }
}

export async function createLeader(formData: FormData) {
  await requirePermission(Permissions.MANAGE_LEADERSHIP);

  const personId = (formData.get('personId') as string)?.trim() || null;
  const name = ((formData.get('name') || formData.get('fullName')) as string)?.trim();
  const role = (formData.get('role') as string)?.trim();
  const year = (formData.get('year') as string)?.trim();
  const handle = (formData.get('handle') as string)?.trim() || null;
  const departmentInput = (formData.get('department') as string)?.trim() || null;
  const displayOrderRaw = formData.get('displayOrder') as string;
  const highSchool = (formData.get('highSchool') as string)?.trim() || null;
  const university = (formData.get('university') as string)?.trim() || null;
  const gradYearRaw = formData.get('graduationYear') as string;
  const graduationYear = gradYearRaw ? parseInt(gradYearRaw, 10) || null : null;
  const bio = (formData.get('bio') as string)?.trim() || null;
  const memberId = (formData.get('memberId') as string)?.trim() || null;
  const avatarUrl = (formData.get('avatarUrl') as string)?.trim() || null;
  const storageKey = (formData.get('storageKey') as string)?.trim() || null;
  const termBio = (formData.get('termBio') as string)?.trim() || null;

  if (!role || !year) {
    return { success: false, error: 'Role and Year are required.' };
  }

  if (!personId && !name) {
    return { success: false, error: 'Officer Name is required when creating a new person.' };
  }

  const roleClass = classifyRole(role);
  const displayOrder = displayOrderRaw !== null && displayOrderRaw !== undefined && displayOrderRaw !== ''
    ? parseInt(displayOrderRaw, 10)
    : roleClass.displayOrder;
  const department = departmentInput || roleClass.department;

  try {
    let resolvedPersonId = personId;

    if (resolvedPersonId) {
      // Update person info if provided
      const [existingPerson] = await db
        .select()
        .from(schema.people)
        .where(eq(schema.people.id, resolvedPersonId))
        .limit(1);

      if (existingPerson) {
        if (storageKey && existingPerson.storageKey && existingPerson.storageKey !== storageKey) {
          await cleanupStorageKey(existingPerson.storageKey, storageKey);
        }

        const personUpdates: Partial<typeof schema.people.$inferInsert> = {};
        if (name && name !== existingPerson.fullName) personUpdates.fullName = name;
        if (handle !== undefined) personUpdates.handle = handle;
        if (highSchool !== undefined) personUpdates.highSchool = highSchool;
        if (university !== undefined) personUpdates.university = university;
        if (graduationYear !== undefined) personUpdates.graduationYear = graduationYear;
        if (bio !== undefined) personUpdates.bio = bio;
        if (avatarUrl !== undefined && avatarUrl) personUpdates.avatarUrl = avatarUrl;
        if (storageKey !== undefined && storageKey) personUpdates.storageKey = storageKey;
        if (memberId !== undefined) personUpdates.memberId = memberId;

        if (Object.keys(personUpdates).length > 0) {
          await db
            .update(schema.people)
            .set(personUpdates)
            .where(eq(schema.people.id, resolvedPersonId));
        }
      }
    } else {
      // Create new Person
      const [newPerson] = await db
        .insert(schema.people)
        .values({
          fullName: name!,
          handle,
          avatarUrl,
          storageKey,
          highSchool,
          university,
          graduationYear,
          bio,
          memberId,
          isActive: true,
        })
        .returning();
      resolvedPersonId = newPerson.id;
    }

    // Insert Term
    await db.insert(schema.leadershipTerms).values({
      personId: resolvedPersonId!,
      year,
      role,
      department,
      displayOrder,
      termBio,
    });

  } catch (error) {
    console.error('Failed to create leadership term', error);
    return { success: false, error: sanitizeDbError(error) };
  }

  revalidateLeadership([year]);
  return { success: true };
}

export async function updateLeader(id: string, year: string, formData: FormData) {
  await requirePermission(Permissions.MANAGE_LEADERSHIP);

  const personId = (formData.get('personId') as string)?.trim() || null;
  const name = ((formData.get('name') || formData.get('fullName')) as string)?.trim();
  const handle = (formData.get('handle') as string)?.trim() || null;
  const role = (formData.get('role') as string)?.trim();
  const newYear = (formData.get('year') as string)?.trim();
  const department = (formData.get('department') as string)?.trim() || null;
  const displayOrderRaw = formData.get('displayOrder') as string;
  const displayOrder = displayOrderRaw ? parseInt(displayOrderRaw, 10) : 0;
  const memberId = (formData.get('memberId') as string)?.trim() || null;
  const highSchool = (formData.get('highSchool') as string)?.trim() || null;
  const university = (formData.get('university') as string)?.trim() || null;
  const gradYearRaw = formData.get('graduationYear') as string;
  const graduationYear = gradYearRaw ? parseInt(gradYearRaw, 10) || null : null;
  const bio = (formData.get('bio') as string)?.trim() || null;
  const avatarUrl = (formData.get('avatarUrl') as string)?.trim() || null;
  const storageKey = (formData.get('storageKey') as string)?.trim() || null;
  const termBio = (formData.get('termBio') as string)?.trim() || null;

  if (!role || !newYear) {
    return { success: false, error: 'Role and Year are required.' };
  }

  try {
    // 1. Check leadershipTerms
    const [term] = await db
      .select()
      .from(schema.leadershipTerms)
      .where(eq(schema.leadershipTerms.id, id))
      .limit(1);

    if (term) {
      await db
        .update(schema.leadershipTerms)
        .set({
          role,
          year: newYear,
          department,
          displayOrder,
          termBio,
        })
        .where(eq(schema.leadershipTerms.id, id));

      const targetPersonId = personId || term.personId;
      if (targetPersonId) {
        const [existingPerson] = await db
          .select()
          .from(schema.people)
          .where(eq(schema.people.id, targetPersonId))
          .limit(1);

        if (existingPerson) {
          if (storageKey !== undefined && existingPerson.storageKey && existingPerson.storageKey !== storageKey) {
            await cleanupStorageKey(existingPerson.storageKey, storageKey);
          }

          const personUpdates: Partial<typeof schema.people.$inferInsert> = {};
          if (name) personUpdates.fullName = name;
          personUpdates.handle = handle;
          personUpdates.highSchool = highSchool;
          personUpdates.university = university;
          personUpdates.graduationYear = graduationYear;
          personUpdates.bio = bio;
          personUpdates.memberId = memberId;
          if (avatarUrl !== undefined) personUpdates.avatarUrl = avatarUrl;
          if (storageKey !== undefined) personUpdates.storageKey = storageKey;

          await db
            .update(schema.people)
            .set(personUpdates)
            .where(eq(schema.people.id, targetPersonId));
        }
      }
    } else {
      // Legacy fallback
      await db
        .update(schema.leadership)
        .set({
          name: name || '',
          handle,
          role,
          year: newYear,
          memberId,
          highSchool,
          university,
          bio,
        })
        .where(eq(schema.leadership.id, id));
    }
  } catch (error) {
    console.error('Failed to update leader', error);
    return { success: false, error: sanitizeDbError(error) };
  }

  revalidateLeadership([year, newYear]);
  return { success: true };
}

export async function deleteLeader(id: string, year: string) {
  const user = await requirePermission(Permissions.MANAGE_LEADERSHIP);

  try {
    // 1. Try deleting leadership_terms
    await db
      .update(schema.leadershipTerms)
      .set({ deletedAt: new Date(), deletedBy: user.id })
      .where(eq(schema.leadershipTerms.id, id));

    // 2. Also soft-delete in legacy leadership if present
    await db
      .update(schema.leadership)
      .set({ deletedAt: new Date(), deletedBy: user.id })
      .where(eq(schema.leadership.id, id));
  } catch (error) {
    console.error('Failed to delete leader', error);
  }

  revalidateLeadership([year]);
}
