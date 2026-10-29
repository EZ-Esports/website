// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ deleteMatches: vi.fn() }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/matches',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/app/(admin)/admin/matches/actions', () => ({
  updateMatchScore: vi.fn(),
  deleteMatch: vi.fn(),
  deleteMatches: mocks.deleteMatches,
}));
vi.mock('@/app/lib/match-actions', () => ({
  fetchStaffMatchesPage: vi.fn(async () => ({ items: [], nextCursor: null })),
  fetchStaffMatchTabCounts: vi.fn(async () => ({ 'needs-results': 0, upcoming: 3, completed: 0, all: 3 })),
}));
vi.mock('@/app/components/admin/ScheduleMatchDialog', () => ({ default: () => null }));
vi.mock('@/app/components/admin/GenerateSeasonDialog', () => ({ default: () => null }));

import AdminMatchExplorer from '../AdminMatchExplorer';

afterEach(() => {
  cleanup();
  mocks.deleteMatches.mockReset();
});

const item = (n: number) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  seasonId: 's1',
  scheduledAt: '2030-11-02T23:00:00.000Z',
  status: 'scheduled' as const,
  homeScore: null,
  awayScore: null,
  division: 'Varsity',
  homeTeam: `Home ${n}`,
  awayTeam: `Away ${n}`,
});

function renderExplorer() {
  return render(
    <AdminMatchExplorer
      seasons={[{ id: 's1', name: 'Fall', gameId: 'g1', isActive: true }]}
      games={[{ id: 'g1', shortName: 'VAL', displayName: 'Valorant', slug: 'valorant' }]}
      initialPage={{ items: [item(1), item(2), item(3)], nextCursor: null }}
      initialFilters={{ gameId: '', seasonId: '' }}
      initialTab="upcoming"
      initialCounts={{ 'needs-results': 0, upcoming: 3, completed: 0, all: 3 }}
      serverNow="2030-01-01T00:00:00.000Z"
      scheduleForm={{} as never}
      generateSchools={[]}
    />,
  );
}

describe('AdminMatchExplorer select mode', () => {
  it('shows no checkboxes until Select is pressed', () => {
    renderExplorer();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('select-all is mixed when some rows are selected, selects all when mixed, clears when all', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('button', { name: 'Select' }));
    const all = screen.getByRole('checkbox', { name: /Select all shown/ }) as HTMLInputElement;

    await user.click(screen.getByRole('checkbox', { name: 'Select Home 1 vs Away 1' }));
    expect(all.indeterminate).toBe(true);
    expect(all.getAttribute('aria-checked')).toBe('mixed');
    expect((screen.getByRole('button', { name: 'Delete selected (1)' }) as HTMLButtonElement).disabled).toBe(false);

    await user.click(all);
    expect(all.checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Delete selected (3)' })).toBeTruthy();

    await user.click(all);
    expect(all.checked).toBe(false);
    expect((screen.getByRole('button', { name: 'Delete selected (0)' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('confirms with the count, deletes in one call, then exits select mode', async () => {
    mocks.deleteMatches.mockResolvedValue({ success: true, deleted: 2 });
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Home 1 vs Away 1' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Home 2 vs Away 2' }));
    await user.click(screen.getByRole('button', { name: 'Delete selected (2)' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('permanently deletes 2 matches');
    await user.click(screen.getByRole('button', { name: 'Delete 2' }));

    await waitFor(() => expect(mocks.deleteMatches).toHaveBeenCalledTimes(1));
    expect(mocks.deleteMatches).toHaveBeenCalledWith([item(1).id, item(2).id]);
    await waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(0));
    expect(screen.queryByText('Home 1')).toBeNull();
    expect(screen.getByText('Home 3')).toBeTruthy();
  });

  it('keeps the dialog open and shows the error when the action fails', async () => {
    mocks.deleteMatches.mockResolvedValue({ success: false, error: 'Nope.' });
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Home 1 vs Away 1' }));
    await user.click(screen.getByRole('button', { name: 'Delete selected (1)' }));
    await user.click(await screen.findByRole('button', { name: 'Delete 1' }));
    expect(await screen.findByText('Nope.')).toBeTruthy();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });
});
