import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RosterCard } from '../RosterCard';
import { RostersSection } from '../RostersSection';
import type { SchoolRosterDetails } from '@/app/lib/onboarding/portal-actions';

const roster: SchoolRosterDetails = {
  id: 'r-varsity',
  teamId: 't1',
  seasonId: 's1',
  seasonName: '2026-27',
  name: 'Varsity',
  division: 'A',
  gameId: 'g1',
  gameName: 'Valorant',
  gameSlug: 'valorant',
  players: [
    {
      id: 'p1',
      memberId: 'm1',
      playerName: 'Ana Lee',
      ign: 'ana#1',
      role: 'player',
      isCaptain: false,
      discordUsername: 'ana',
      inGuild: true,
      riotVerified: true,
    },
  ],
};

const render = (props: Partial<React.ComponentProps<typeof RosterCard>>) =>
  renderToStaticMarkup(
    <RosterCard
      roster={roster}
      isEvaluating={false}
      onOpenEnrollModal={vi.fn()}
      onCheckRosterGate={vi.fn()}
      onUpdateRole={vi.fn()}
      onRemovePlayer={vi.fn()}
      {...props}
    />,
  );

describe('RosterCard: Move control', () => {
  const onMovePlayer = vi.fn();

  it('offers a named "Move to JV" button when the team has exactly one sibling roster', () => {
    const html = render({ onMovePlayer, siblingRosters: [{ id: 'r-jv', name: 'JV', playerCount: 5, subCount: 1 }] });
    expect(html).toContain('Move to JV');
    expect(html).toContain('aria-label="Move to JV: Ana Lee (currently Varsity)"');
  });

  it('derives the label from the sibling roster name (JV card says "Move to Varsity")', () => {
    const html = render({ onMovePlayer, siblingRosters: [{ id: 'r-v', name: 'Varsity', playerCount: 5, subCount: 1 }] });
    expect(html).toContain('Move to Varsity');
  });

  it('shows a labelled picker when there is more than one sibling roster', () => {
    const html = render({
      onMovePlayer,
      siblingRosters: [
        { id: 'r-jv', name: 'JV', playerCount: 5, subCount: 1 },
        { id: 'r-alt', name: 'Academy', playerCount: 5, subCount: 1 },
      ],
    });
    // A React Aria menu trigger; the options render when it opens.
    expect(html).toContain('aria-label="Move to…: Ana Lee (currently Varsity)"');
    expect(html).toContain('aria-haspopup="true"');
    expect(html).not.toContain('Move to JV');
  });

  it('renders no control when there is no sibling roster or no handler', () => {
    expect(render({ onMovePlayer, siblingRosters: [] })).not.toContain('Ana Lee (currently');
    expect(render({ siblingRosters: [{ id: 'r-jv', name: 'JV', playerCount: 5, subCount: 1 }] })).not.toContain('Ana Lee (currently');
  });

  it('is disabled while the season is locked or view-only', () => {
    const html = render({ onMovePlayer, locked: true, siblingRosters: [{ id: 'r-jv', name: 'JV', playerCount: 5, subCount: 1 }] });
    const button = /<button[^>]*aria-label="Move to JV: Ana Lee \(currently Varsity\)"[^>]*>/.exec(html)?.[0] ?? '';
    expect(button).toContain('disabled');
  });

  it('is disabled while that player is being moved', () => {
    const html = render({ onMovePlayer, movingPlayerId: 'p1', siblingRosters: [{ id: 'r-jv', name: 'JV', playerCount: 5, subCount: 1 }] });
    const button = /<button[^>]*aria-label="Move to JV: Ana Lee \(currently Varsity\)"[^>]*>/.exec(html)?.[0] ?? '';
    expect(button).toContain('disabled');
  });

  it('label in name: the accessible name starts with the visible text', () => {
    const html = render({ onMovePlayer, siblingRosters: [{ id: 'r-jv', name: 'JV', playerCount: 5, subCount: 1 }] });
    const label = /aria-label="(Move to JV[^"]*)"/.exec(html)?.[1] ?? '';
    expect(html).toContain('<span>Move to JV</span>');
    expect(label.startsWith('Move to JV')).toBe(true);
  });
});

describe('RostersSection: Move feedback region', () => {
  const renderSection = (notice: { kind: 'success' | 'error'; text: string } | null) =>
    renderToStaticMarkup(
      <RostersSection
        rosters={[roster]}
        schoolName="Test High"
        eligibilityResults={{}}
        evaluatingRosterId={null}
        onOpenCreateRosterModal={vi.fn()}
        onOpenEnrollModal={vi.fn()}
        onCheckRosterGate={vi.fn()}
        onUpdateRole={vi.fn()}
        onRemovePlayer={vi.fn()}
        notice={notice}
      />,
    );

  it('announces the outcome in a polite live region', () => {
    const html = renderSection({ kind: 'success', text: 'Ana Lee moved from Varsity to JV.' });
    expect(html).toMatch(/<div role="status" aria-live="polite"[^>]*>.*Ana Lee moved from Varsity to JV\./);
  });

  it('keeps the region mounted (empty) when there is nothing to announce', () => {
    expect(renderSection(null)).toContain('role="status" aria-live="polite"');
  });

  it('shows a rejection in the same region', () => {
    const html = renderSection({ kind: 'error', text: 'Su B is already on JV.' });
    expect(html).toMatch(/aria-live="polite"[^>]*>.*Su B is already on JV\./);
  });
});

describe('RosterCard: roster size limits', () => {
  const player = (i: number, role = 'player') => ({
    id: `p${i}`,
    memberId: `m${i}`,
    playerName: `Player ${i}`,
    ign: `ign${i}`,
    role,
    isCaptain: false,
    discordUsername: 'd',
    inGuild: true,
    riotVerified: true,
  });
  const withPlayers = (n: number, subs = 0): SchoolRosterDetails => ({
    ...roster,
    players: Array.from({ length: n }, (_, i) => player(i, i >= n - subs ? 'sub' : 'player')),
  });

  it('shows the player count against the cap and keeps Enroll available below it', () => {
    const html = render({ roster: withPlayers(6, 1) });
    expect(html).toContain('6/7 players');
    expect(html).toContain('(1/2 subs)');
    expect(html).toContain('Enroll Player');
  });

  it('at 7 players the Enroll control is disabled and reads "Roster full (7/7)"', () => {
    const html = render({ roster: withPlayers(7, 2) });
    expect(html).toContain('7/7 players');
    expect(html).toContain('Roster full (7/7)');
    expect(html).not.toContain('Enroll Player');
    expect(/<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>).)*Roster full \(7\/7\)/s.test(html)).toBe(true);
  });

  it('disables the Sub option in the role select when two other subs already fill the slots', () => {
    const html = render({ roster: withPlayers(5, 2) });
    // Starters cannot become a third sub; the two subs themselves are not blocked from staying subs.
    expect(html).toMatch(/<option value="sub" disabled="">Sub<\/option>/);
  });

  it('does not offer a full roster as a Move target, and says why', () => {
    const html = render({ onMovePlayer: vi.fn(), siblingRosters: [{ id: 'r-jv', name: 'JV', playerCount: 7, subCount: 2 }] });
    expect(html).toContain('JV is full (7/7)');
    expect(html).toContain('aria-label="JV is full (7/7): Ana Lee (currently Varsity)"');
    expect(html).not.toContain('Move to JV');
    // Disabled (RAC renders disabled=""), not merely labelled.
    expect(/<button[^>]*\sdisabled=""[^>]*aria-label="JV is full/.test(html)).toBe(true);
  });

  it('does not offer a roster with 2 subs to a sub player', () => {
    const subRoster: SchoolRosterDetails = { ...roster, players: [{ ...roster.players[0], role: 'sub' }] };
    const html = render({ roster: subRoster, onMovePlayer: vi.fn(), siblingRosters: [{ id: 'r-jv', name: 'JV', playerCount: 4, subCount: 2 }] });
    expect(html).toContain('JV has 2 subs');
  });
});
