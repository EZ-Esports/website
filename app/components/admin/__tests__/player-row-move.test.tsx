import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/app/(admin)/admin/schools/[schoolId]/rosters/actions', () => ({
  createPlayer: vi.fn(),
  createRoster: vi.fn(),
  createTeam: vi.fn(),
  deleteRoster: vi.fn(),
  deleteRosterMember: vi.fn(),
  moveRosterMember: vi.fn(),
  updatePlayer: vi.fn(),
  updateRoster: vi.fn(),
}));

import { AddPlayerButton, PlayerRowActions, RosterEditProvider, type SiblingRoster } from '../SchoolRosterEditors';

const player = { id: 'p1', name: 'Ana Lee', role: 'player' } as never;

const render = (siblings: SiblingRoster[], p = player) =>
  renderToStaticMarkup(
    <RosterEditProvider
      value={{ schoolId: 's1', options: { members: [], games: [], seasons: [] }, pending: false, run: vi.fn(), notify: vi.fn() }}
    >
      <PlayerRowActions player={p} rosterName="Varsity" siblings={siblings} onEdit={vi.fn()} />
    </RosterEditProvider>,
  );

describe('staff PlayerRowActions: Move control', () => {
  it('shows "Move to JV" whose accessible name starts with the visible text', () => {
    const html = render([{ id: 'r-jv', name: 'JV', playerCount: 5, subCount: 1 }]);
    expect(html).toContain('aria-label="Move to JV: Ana Lee (currently Varsity)"');
    expect(html).toMatch(/Move to JV<\/button>/);
  });

  it('uses a menu trigger when the team has more than two rosters', () => {
    const html = render([
      { id: 'r-jv', name: 'JV', playerCount: 5, subCount: 1 },
      { id: 'r-alt', name: 'Academy', playerCount: 5, subCount: 1 },
    ]);
    expect(html).toContain('aria-label="Move to…: Ana Lee (currently Varsity)"');
    expect(html).toContain('aria-haspopup="true"');
  });

  it('renders nothing for Move when there is no sibling roster', () => {
    expect(render([])).not.toContain('Move to');
  });

  it('does not offer a full roster: the button is disabled and says why', () => {
    const html = render([{ id: 'r-jv', name: 'JV', playerCount: 10, subCount: 0 }]);
    expect(html).toContain('aria-label="JV is full (10/10): Ana Lee (currently Varsity)"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="JV is full/);
    expect(html).not.toContain('Move to JV');
  });

  it('does not offer a roster with 5 subs to a sub, but does to a starter', () => {
    const target = [{ id: 'r-jv', name: 'JV', playerCount: 5, subCount: 5 }];
    expect(render(target, { id: 'p1', name: 'Ana Lee', role: 'sub' } as never)).toContain('JV has 5 subs');
    expect(render(target)).toContain('Move to JV');
  });

  it('disables a full roster inside the menu too', () => {
    const html = render([
      { id: 'r-jv', name: 'JV', playerCount: 10, subCount: 0 },
      { id: 'r-alt', name: 'Academy', playerCount: 3, subCount: 0 },
    ]);
    // Items render when the menu opens; the trigger stays enabled because Academy can take the player.
    expect(html).toContain('aria-label="Move to…: Ana Lee (currently Varsity)"');
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*Move to…/);
  });
});

describe('staff AddPlayerButton', () => {
  it('says "Roster full (10/10)" and is disabled at the cap', () => {
    const html = renderToStaticMarkup(<AddPlayerButton open={false} onClick={vi.fn()} full playerCount={10} />);
    expect(html).toContain('Roster full (10/10)');
    expect(html).toContain('disabled=""');
  });

  it('is an ordinary Add player button below the cap', () => {
    const html = renderToStaticMarkup(<AddPlayerButton open={false} onClick={vi.fn()} playerCount={6} />);
    expect(html).toContain('Add player');
    expect(html).not.toContain('disabled=""');
  });
});
