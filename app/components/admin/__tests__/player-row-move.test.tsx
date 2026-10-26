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

import { PlayerRowActions, RosterEditProvider } from '../SchoolRosterEditors';

const player = { id: 'p1', name: 'Ana Lee', role: 'player' } as never;

const render = (siblings: Array<{ id: string; name: string }>) =>
  renderToStaticMarkup(
    <RosterEditProvider
      value={{ schoolId: 's1', options: { members: [], games: [], seasons: [] }, pending: false, run: vi.fn(), notify: vi.fn() }}
    >
      <PlayerRowActions player={player} rosterName="Varsity" siblings={siblings} onEdit={vi.fn()} />
    </RosterEditProvider>,
  );

describe('staff PlayerRowActions: Move control', () => {
  it('shows "Move to JV" whose accessible name starts with the visible text', () => {
    const html = render([{ id: 'r-jv', name: 'JV' }]);
    expect(html).toContain('aria-label="Move to JV: Ana Lee (currently Varsity)"');
    expect(html).toMatch(/Move to JV<\/button>/);
  });

  it('uses a menu trigger when the team has more than two rosters', () => {
    const html = render([
      { id: 'r-jv', name: 'JV' },
      { id: 'r-alt', name: 'Academy' },
    ]);
    expect(html).toContain('aria-label="Move to…: Ana Lee (currently Varsity)"');
    expect(html).toContain('aria-haspopup="true"');
  });

  it('renders nothing for Move when there is no sibling roster', () => {
    expect(render([])).not.toContain('Move to');
  });
});
