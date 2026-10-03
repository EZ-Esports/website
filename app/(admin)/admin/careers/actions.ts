'use server';

import { requirePermission } from '@/app/lib/auth';
import { Permissions } from '@/app/lib/roles';
import {
  createCareerPosting,
  updateCareerPosting,
  softDeleteCareerPosting,
  getCareerPostingBySlug,
} from '@/app/lib/db/careers';
import type { CareerPostingStatus } from '@/app/types/careers';
import { revalidatePath } from 'next/cache';
import { slugify, sanitizeDbError } from '@/app/lib/text-utils';

function revalidateCareers(slug?: string) {
  revalidatePath('/careers');
  revalidatePath('/admin/careers');
  if (slug) {
    revalidatePath(`/careers/${slug}`);
  }
}

export interface CareerPostingFormData {
  title: string;
  slug?: string;
  department: string;
  location?: string;
  commitment?: string;
  employmentType?: string;
  summary: string;
  description: string;
  status?: CareerPostingStatus;
  displayOrder?: number;
}

export async function createCareerPostingAction(data: CareerPostingFormData) {
  await requirePermission(Permissions.MANAGE_APPLICATIONS);

  const title = data.title?.trim();
  const department = data.department?.trim();
  const summary = data.summary?.trim();
  const description = data.description?.trim();

  if (!title || !department || !summary || !description) {
    return { success: false, error: 'Title, department, summary, and description are required.' };
  }

  const rawSlug = data.slug?.trim() || title;
  const slug = slugify(rawSlug);

  try {
    const existing = await getCareerPostingBySlug(slug);
    if (existing) {
      return { success: false, error: `An opening with the URL slug "${slug}" already exists.` };
    }

    const created = await createCareerPosting({
      title,
      slug,
      department,
      location: data.location?.trim() || 'Remote (NYC High School League)',
      commitment: data.commitment?.trim() || '5–10 hours / week',
      employmentType: data.employmentType?.trim() || 'Volunteer / High School Internship',
      summary,
      description,
      status: data.status || 'published',
      displayOrder: data.displayOrder ?? 0,
    });

    revalidateCareers(slug);
    return { success: true, posting: created };
  } catch (error) {
    console.error('Failed to create career posting', error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function updateCareerPostingAction(id: string, data: Partial<CareerPostingFormData>) {
  await requirePermission(Permissions.MANAGE_APPLICATIONS);

  if (!id) return { success: false, error: 'Missing posting ID.' };

  try {
    const patch: Parameters<typeof updateCareerPosting>[1] = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.slug !== undefined && data.slug.trim()) patch.slug = slugify(data.slug);
    if (data.department !== undefined) patch.department = data.department;
    if (data.location !== undefined) patch.location = data.location;
    if (data.commitment !== undefined) patch.commitment = data.commitment;
    if (data.employmentType !== undefined) patch.employmentType = data.employmentType;
    if (data.summary !== undefined) patch.summary = data.summary;
    if (data.description !== undefined) patch.description = data.description;
    if (data.status !== undefined) patch.status = data.status;
    if (data.displayOrder !== undefined) patch.displayOrder = data.displayOrder;

    const updated = await updateCareerPosting(id, patch);
    if (!updated) {
      return { success: false, error: 'Career posting not found.' };
    }

    revalidateCareers(updated.slug);
    return { success: true, posting: updated };
  } catch (error) {
    console.error('Failed to update career posting', error);
    return { success: false, error: sanitizeDbError(error) };
  }
}

export async function deleteCareerPostingAction(id: string) {
  const staff = await requirePermission(Permissions.MANAGE_APPLICATIONS);

  if (!id) return { success: false, error: 'Missing posting ID.' };

  try {
    const deleted = await softDeleteCareerPosting(id, staff.email || 'admin');
    if (!deleted) {
      return { success: false, error: 'Posting not found or already deleted.' };
    }

    revalidateCareers();
    return { success: true };
  } catch (error) {
    console.error('Failed to delete career posting', error);
    return { success: false, error: sanitizeDbError(error) };
  }
}
