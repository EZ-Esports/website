// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EnrollPlayerModal } from '../EnrollPlayerModal';
import type { SchoolPoolPlayer, SchoolRosterDetails } from '@/app/lib/onboarding/portal-actions';

const roster: SchoolRosterDetails = {
  id: 'r-varsity', teamId: 't1', seasonId: 's-now', seasonName: '2026-27', name: 'Varsity', division: 'A',
  gameId: 'g1', gameName: 'Valorant', gameSlug: 'valorant',
  players: [
    { id: 'pl-here', memberId: 'm-here', playerName: 'Here Now', ign: 'h#1', role: 'player', isCaptain: false, discordUsername: 'h', inGuild: true, riotVerified: true },
  ],
};

const accepted = (seasonId: string) => ({ id: `i-${seasonId}`, gameId: 'g1', seasonId, status: 'accepted' });
const pooled = (memberId: string, name: string, extra: Partial<SchoolPoolPlayer> = {}): SchoolPoolPlayer => ({
  memberId, firstName: name, lastName: 'X', playerName: `${name} X`, ign: `${name}#1`, discordUsername: name,
  inGuild: true, riotVerified: true, graduationYear: 2027, invites: [], enrolledRosters: [], ...extra,
});
const rostered = (rosterId: string, rosterName: string) => ({
  rosterId, rosterName, gameName: 'Valorant', gameId: 'g1', seasonId: 's-now', role: 'player', isCaptain: false,
});

const pool: SchoolPoolPlayer[] = [
  pooled('m-ok', 'Accepted', { invites: [accepted('s-now')] }),
  pooled('m-old', 'OldSeason', { invites: [accepted('s-past')] }),
  pooled('m-none', 'NoApplication'),
  pooled('m-here', 'Here', { enrolledRosters: [rostered('r-varsity', 'Varsity')] }),
  pooled('m-jv', 'OnJv', { enrolledRosters: [rostered('r-jv', 'JV')] }),
  pooled('m-staffview', 'StaffView', { invites: null }),
];

const open = (p: SchoolPoolPlayer[]) =>
  render(
    <EnrollPlayerModal
      roster={roster} playerPool={p} selectedMemberId="" setSelectedMemberId={vi.fn()} enrollRole="player"
      setEnrollRole={vi.fn()} enrollCustomIgn="" setEnrollCustomIgn={vi.fn()} enrollSearchQuery=""
      setEnrollSearchQuery={vi.fn()} enrollError={null} isEnrolling={false} onConfirmEnroll={vi.fn()} onClose={vi.fn()}
    />
  );
const option = (name: RegExp) => screen.queryByRole('option', { name }) as HTMLOptionElement | null;

describe('EnrollPlayerModal pool', () => {
  it('lists accepted-this-season students and staff-view (null) entries; hides other-season and no-application ones', () => {
    open(pool);
    expect(option(/Accepted X/)).not.toBeNull();
    expect(option(/StaffView X/)).not.toBeNull();
    expect(option(/OldSeason X/)).toBeNull();
    expect(option(/NoApplication X/)).toBeNull();
  });

  it('keeps students already on a roster of this game and season visible, annotated, whatever their application state', () => {
    open(pool);
    const here = option(/Here X/);
    expect(here).not.toBeNull();
    expect(here!.disabled).toBe(true);
    expect(here!.textContent).toContain('Already on this roster: player');
    const jv = option(/OnJv X/);
    expect(jv).not.toBeNull();
    expect(jv!.textContent).toContain('Currently on JV');
  });

  it('counts only genuinely hidden students in the hint', () => {
    open(pool);
    expect(screen.getByText(/2 students are not listed: they have not been onboarded for 2026-27/)).toBeInTheDocument();
  });

  it('shows no hint when nobody is hidden', () => {
    open([pooled('m-ok', 'Accepted', { invites: [accepted('s-now')] })]);
    expect(screen.queryByText(/not listed/)).toBeNull();
  });
});
