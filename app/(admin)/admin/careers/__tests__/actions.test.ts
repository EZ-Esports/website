import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCareerPostingAction,
  updateCareerPostingAction,
  deleteCareerPostingAction,
} from '../actions';

// Mock auth
vi.mock('@/app/lib/auth', () => ({
  requirePermission: vi.fn(),
}));

// Mock DB careers DAL
vi.mock('@/app/lib/db/careers', () => ({
  createCareerPosting: vi.fn(),
  updateCareerPosting: vi.fn(),
  softDeleteCareerPosting: vi.fn(),
  getCareerPostingBySlug: vi.fn(),
}));

// Mock cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { requirePermission } from '@/app/lib/auth';
import {
  createCareerPosting,
  updateCareerPosting,
  softDeleteCareerPosting,
  getCareerPostingBySlug,
} from '@/app/lib/db/careers';

describe('Admin Careers Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue({
      id: 'staff-1',
      email: 'admin@ezesports.org',
      permissions: BigInt(0xffffffff),
      isOwner: true,
      highestRolePosition: 1,
    });
  });

  describe('createCareerPostingAction', () => {
    it('rejects submissions missing required fields', async () => {
      const res = await createCareerPostingAction({
        title: '',
        department: '',
        summary: '',
        description: '',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('required');
      expect(createCareerPosting).not.toHaveBeenCalled();
    });

    it('rejects duplicate slugs', async () => {
      vi.mocked(getCareerPostingBySlug).mockResolvedValueOnce({
        id: 'existing-1',
        title: 'Existing Role',
        slug: 'existing-role',
        department: 'Engineering',
        location: 'Remote',
        commitment: '5h',
        employmentType: 'Volunteer',
        summary: 'Summary',
        description: 'Desc',
        status: 'published',
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await createCareerPostingAction({
        title: 'Existing Role',
        department: 'Engineering',
        summary: 'Summary',
        description: 'Desc',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('already exists');
    });

    it('creates a posting successfully with generated slug', async () => {
      vi.mocked(getCareerPostingBySlug).mockResolvedValueOnce(null);
      vi.mocked(createCareerPosting).mockResolvedValueOnce({
        id: 'created-1',
        title: 'Software Engineer',
        slug: 'software-engineer',
        department: 'Engineering',
        location: 'Remote (NYC High School League)',
        commitment: '5–10 hours / week',
        employmentType: 'Volunteer / High School Internship',
        summary: 'Summary text',
        description: 'Detailed description',
        status: 'published',
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await createCareerPostingAction({
        title: 'Software Engineer',
        department: 'Engineering',
        summary: 'Summary text',
        description: 'Detailed description',
      });

      expect(res.success).toBe(true);
      expect(createCareerPosting).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Software Engineer',
          slug: 'software-engineer',
          department: 'Engineering',
        })
      );
    });
  });

  describe('updateCareerPostingAction', () => {
    it('returns error if id is missing', async () => {
      const res = await updateCareerPostingAction('', { title: 'New' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Missing posting ID');
    });

    it('updates posting successfully', async () => {
      vi.mocked(updateCareerPosting).mockResolvedValueOnce({
        id: 'posting-1',
        title: 'Senior Engineer',
        slug: 'senior-engineer',
        department: 'Engineering',
        location: 'Remote',
        commitment: '5h',
        employmentType: 'Volunteer',
        summary: 'Sum',
        description: 'Desc',
        status: 'published',
        displayOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await updateCareerPostingAction('posting-1', {
        title: 'Senior Engineer',
      });

      expect(res.success).toBe(true);
      expect(updateCareerPosting).toHaveBeenCalledWith('posting-1', expect.objectContaining({
        title: 'Senior Engineer',
      }));
    });
  });

  describe('deleteCareerPostingAction', () => {
    it('soft-deletes posting with actor identity', async () => {
      vi.mocked(softDeleteCareerPosting).mockResolvedValueOnce(true);

      const res = await deleteCareerPostingAction('posting-1');
      expect(res.success).toBe(true);
      expect(softDeleteCareerPosting).toHaveBeenCalledWith('posting-1', 'admin@ezesports.org');
    });
  });
});
