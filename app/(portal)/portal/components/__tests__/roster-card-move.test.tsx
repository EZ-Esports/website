import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RosterCard } from '../RosterCard';
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
      onOpenSwapModal={vi.fn()}
      onCheckRosterGate={vi.fn()}
      onUpdateRole={vi.fn()}
      onRemovePlayer={vi.fn()}
      {...props}
    />,
  );

describe('RosterCard: Move control', () => {
  const onMovePlayer = vi.fn();

  it('offers a named "Move to JV" button when the team has exactly one sibling roster', () => {
    const html = render({ onMovePlayer, siblingRosters: [{ id: 'r-jv', name: 'JV' }] });
    expect(html).toContain('Move to JV');
    expect(html).toContain('aria-label="Move Ana Lee from Varsity to JV"');
  });

  it('derives the label from the sibling roster name (JV card says "Move to Varsity")', () => {
    const html = render({ onMovePlayer, siblingRosters: [{ id: 'r-v', name: 'Varsity' }] });
    expect(html).toContain('Move to Varsity');
  });

  it('shows a labelled picker when there is more than one sibling roster', () => {
    const html = render({
      onMovePlayer,
      siblingRosters: [
        { id: 'r-jv', name: 'JV' },
        { id: 'r-alt', name: 'Academy' },
      ],
    });
    expect(html).toContain('aria-label="Move Ana Lee from Varsity to another roster"');
    expect(html).toContain('>Academy</option>');
    expect(html).not.toContain('Move to JV');
  });

  it('renders no control when there is no sibling roster or no handler', () => {
    expect(render({ onMovePlayer, siblingRosters: [] })).not.toContain('Move Ana Lee');
    expect(render({ siblingRosters: [{ id: 'r-jv', name: 'JV' }] })).not.toContain('Move Ana Lee');
  });

  it('is disabled while the season is locked or view-only', () => {
    const html = render({ onMovePlayer, locked: true, siblingRosters: [{ id: 'r-jv', name: 'JV' }] });
    const button = /<button[^>]*aria-label="Move Ana Lee from Varsity to JV"[^>]*>/.exec(html)?.[0] ?? '';
    expect(button).toContain('disabled');
  });

  it('is disabled while that player is being moved', () => {
    const html = render({ onMovePlayer, movingPlayerId: 'p1', siblingRosters: [{ id: 'r-jv', name: 'JV' }] });
    const button = /<button[^>]*aria-label="Move Ana Lee from Varsity to JV"[^>]*>/.exec(html)?.[0] ?? '';
    expect(button).toContain('disabled');
  });
});
