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
    expect(html).toContain('aria-label="Move to JV: Ana Lee (currently Varsity)"');
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
    // A React Aria menu trigger; the options render when it opens.
    expect(html).toContain('aria-label="Move to…: Ana Lee (currently Varsity)"');
    expect(html).toContain('aria-haspopup="true"');
    expect(html).not.toContain('Move to JV');
  });

  it('renders no control when there is no sibling roster or no handler', () => {
    expect(render({ onMovePlayer, siblingRosters: [] })).not.toContain('Ana Lee (currently');
    expect(render({ siblingRosters: [{ id: 'r-jv', name: 'JV' }] })).not.toContain('Ana Lee (currently');
  });

  it('is disabled while the season is locked or view-only', () => {
    const html = render({ onMovePlayer, locked: true, siblingRosters: [{ id: 'r-jv', name: 'JV' }] });
    const button = /<button[^>]*aria-label="Move to JV: Ana Lee \(currently Varsity\)"[^>]*>/.exec(html)?.[0] ?? '';
    expect(button).toContain('disabled');
  });

  it('is disabled while that player is being moved', () => {
    const html = render({ onMovePlayer, movingPlayerId: 'p1', siblingRosters: [{ id: 'r-jv', name: 'JV' }] });
    const button = /<button[^>]*aria-label="Move to JV: Ana Lee \(currently Varsity\)"[^>]*>/.exec(html)?.[0] ?? '';
    expect(button).toContain('disabled');
  });

  it('label in name: the accessible name starts with the visible text', () => {
    const html = render({ onMovePlayer, siblingRosters: [{ id: 'r-jv', name: 'JV' }] });
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
        onOpenSwapModal={vi.fn()}
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
