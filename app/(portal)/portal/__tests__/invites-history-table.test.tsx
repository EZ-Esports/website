// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvitesHistoryTable } from '../components/InvitesHistoryTable';
import type { SchoolInviteItem } from '@/app/lib/onboarding/portal-actions';

afterEach(cleanup);

function invite(over: Partial<SchoolInviteItem>): SchoolInviteItem {
  return {
    id: 'i1',
    schoolId: 's1',
    gameId: 'g1',
    intendedFirstName: 'Jordan',
    intendedLastName: 'Lee',
    status: 'pending',
    expiresAt: new Date('2026-12-01'),
    submittedAt: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-11-01'),
    schoolSlug: 'stuy',
    gameSlug: 'valorant',
    gameName: 'Valorant',
    ...over,
  };
}

describe('InvitesHistoryTable actions', () => {
  it('offers copy and delete on pending invites and reports the chosen invite', async () => {
    const onCopyLink = vi.fn();
    const onDelete = vi.fn();
    const inv = invite({});
    render(<InvitesHistoryTable invites={[inv]} onCopyLink={onCopyLink} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: /Copy a new invite link for Jordan Lee/ }));
    expect(onCopyLink).toHaveBeenCalledWith(inv);
    await userEvent.click(screen.getByRole('button', { name: /Delete invite for Jordan Lee/ }));
    expect(onDelete).toHaveBeenCalledWith(inv);
  });

  it.each(['submitted', 'accepted', 'rejected'])('has no actions on a %s invite', (status) => {
    render(<InvitesHistoryTable invites={[invite({ status })]} onCopyLink={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has no actions for a view-only (inactive season) game', () => {
    render(
      <InvitesHistoryTable invites={[invite({})]} onCopyLink={vi.fn()} onDelete={vi.fn()} viewOnlyGameIds={['g1']} />
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the link for manual copying when the clipboard refused it', () => {
    render(
      <InvitesHistoryTable
        invites={[invite({})]}
        onCopyLink={vi.fn()}
        onDelete={vi.fn()}
        manualLink={{ inviteId: 'i1', url: 'https://x.test/join/stuy/valorant?token=abc' }}
      />
    );
    expect(screen.getByLabelText(/copy manually/)).toHaveProperty('value', 'https://x.test/join/stuy/valorant?token=abc');
  });
});
