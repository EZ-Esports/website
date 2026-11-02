// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const actions = vi.hoisted(() => ({
  requestReschedule: vi.fn(),
  respondToReschedule: vi.fn(),
  counterReschedule: vi.fn(),
  cancelReschedule: vi.fn(),
}));
vi.mock('@/app/lib/onboarding/reschedule-actions', () => actions);
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { RescheduleCell } from '../RescheduleControls';
import { StaffActingProvider } from '../StaffActing';
import type { SchoolMatchItem } from '@/app/lib/school-matches';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const NOW = new Date('2026-10-25T12:00:00.000Z');

const match = (over: Partial<SchoolMatchItem> = {}): SchoolMatchItem => ({
  id: 'm1',
  gameId: 'g1',
  gameName: 'Valorant',
  gameSlug: 'valorant',
  seasonName: '2026-27',
  division: 'Varsity',
  scheduledAt: '2026-11-20T00:00:00.000Z',
  status: 'scheduled',
  opponentName: 'Other High',
  isHome: true,
  ownScore: null,
  opponentScore: null,
  sameSchool: false,
  reschedule: null,
  rescheduledFrom: null,
  rescheduleAllowanceUsed: true,
  gameCount: 0,
  pendingResult: null,
  ...over,
});

function renderCell(isStaff: boolean, item = match()) {
  return render(
    <StaffActingProvider isStaff={isStaff} schoolName="Test High">
      <RescheduleCell match={item} schoolId="school-a" now={NOW} viewOnly={false} />
    </StaffActingProvider>,
  );
}

describe('RescheduleCell and the reschedule allowance', () => {
  it('hides Request for a manager whose school used its allowance', () => {
    renderCell(false);
    expect(screen.queryByRole('button', { name: 'Request reschedule' })).toBeNull();
    expect(screen.getByText('No reschedules remaining this season.')).toBeTruthy();
  });

  it('offers Request to a staff admin even when the school used its allowance', () => {
    renderCell(true);
    expect(screen.getByRole('button', { name: 'Request reschedule' })).toBeTruthy();
    expect(screen.queryByText('No reschedules remaining this season.')).toBeNull();
  });
});

describe('RescheduleCell cancel', () => {
  const open = match({
    reschedule: {
      id: 'req-1',
      status: 'pending_opponent',
      requestedBySchoolId: 'school-a',
      requestedBySchoolName: 'Test High',
      reason: 'Exam',
      isLate: false,
      acceptedOptionId: null,
      staffNote: null,
      options: [],
    } as never,
  });

  it('sends a manager cancel straight away', async () => {
    actions.cancelReschedule.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderCell(false, open);
    await user.click(screen.getByRole('button', { name: 'View request' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(actions.cancelReschedule).toHaveBeenCalledWith({ requestId: 'req-1', schoolId: 'school-a' }));
  });

  it('asks a staff admin to confirm first, and sends nothing until they do', async () => {
    actions.cancelReschedule.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderCell(true, open);
    await user.click(screen.getByRole('button', { name: 'View request' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel request' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm.textContent).toContain("You're acting as Test High as staff. Confirm?");
    expect(actions.cancelReschedule).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(actions.cancelReschedule).toHaveBeenCalledWith({ requestId: 'req-1', schoolId: 'school-a' }));
  });
});
