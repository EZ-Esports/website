import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createSeasonInDb: vi.fn(async (v: any) => ({ id: 's-new', ...v })),
  updateSeasonInDb: vi.fn(async (id: string, v: any) => ({ id, ...v })),
  existingName: 'Spring 2025' as string | null,
}));

vi.mock('@/app/lib/auth', () => ({ requirePermission: vi.fn(async () => ({})) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock('@/app/lib/db/queries', () => ({
  createGameInDb: vi.fn(),
  updateGameInDb: vi.fn(),
  deleteGameInDb: vi.fn(),
  createSeasonInDb: mocks.createSeasonInDb,
  updateSeasonInDb: mocks.updateSeasonInDb,
  deleteSeasonInDb: vi.fn(),
}));
vi.mock('@/app/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (mocks.existingName === null ? [] : [{ name: mocks.existingName }]),
        }),
      }),
    }),
  },
}));

import { createSeason, updateSeason } from '../actions';

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe('League Setup season name validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.existingName = 'Spring 2025';
  });

  it('createSeason accepts a YYYY-YY name', async () => {
    const res = await createSeason(form({ gameId: 'g1', name: '2026-27', isActive: 'true' }));
    expect(res.success).toBe(true);
    expect(mocks.createSeasonInDb).toHaveBeenCalledWith(expect.objectContaining({ name: '2026-27' }));
  });

  it.each(['Spring 2025', '2026-2027', '2026-28', '26-27'])('createSeason rejects %s', async (name) => {
    const res = await createSeason(form({ gameId: 'g1', name }));
    expect(res).toMatchObject({ success: false, error: expect.stringContaining('YYYY-YY') });
    expect(mocks.createSeasonInDb).not.toHaveBeenCalled();
  });

  it('updateSeason accepts a new YYYY-YY name', async () => {
    const res = await updateSeason('s1', form({ name: '2025-26', isActive: 'false' }));
    expect(res.success).toBe(true);
    expect(mocks.updateSeasonInDb).toHaveBeenCalled();
  });

  it('updateSeason rejects changing to another non-conforming name', async () => {
    const res = await updateSeason('s1', form({ name: 'Fall 2025' }));
    expect(res).toMatchObject({ success: false });
    expect(mocks.updateSeasonInDb).not.toHaveBeenCalled();
  });

  it('updateSeason lets an unchanged legacy name through (for example toggling Active)', async () => {
    const res = await updateSeason('s1', form({ name: 'Spring 2025', isActive: 'false' }));
    expect(res.success).toBe(true);
  });
});
