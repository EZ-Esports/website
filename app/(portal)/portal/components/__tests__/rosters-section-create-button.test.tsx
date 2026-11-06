import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RostersSection } from '../RostersSection';

vi.mock('@/app/lib/onboarding/portal-actions', () => ({}));

function render(canCreateRoster?: boolean, rosters: never[] = []): string {
  return renderToStaticMarkup(
    <RostersSection
      rosters={rosters}
      schoolName="Test High"
      eligibilityResults={{}}
      evaluatingRosterId={null}
      canCreateRoster={canCreateRoster}
      onOpenCreateRosterModal={() => {}}
      onOpenEnrollModal={() => {}}
      onCheckRosterGate={() => {}}
      onUpdateRole={() => {}}
      onRemovePlayer={() => {}}
    />,
  );
}

describe('RostersSection create-roster controls', () => {
  it('hides Create Roster and Create First Roster for managers (default)', () => {
    const html = render();
    expect(html).not.toContain('Create Roster');
    expect(html).not.toContain('Create First Roster');
    expect(html).not.toContain('data-tour="create-roster"');
    expect(html).toContain('Rosters are set up by EZ Esports staff');
  });

  it('hides the create controls when canCreateRoster is false', () => {
    const html = render(false);
    expect(html).not.toContain('Create Roster');
    expect(html).not.toContain('Create First Roster');
  });

  it('shows Create Roster and Create First Roster for staff', () => {
    const html = render(true);
    expect(html).toContain('Create Roster');
    expect(html).toContain('Create First Roster');
    expect(html).toContain('data-tour="create-roster"');
    expect(html).not.toContain('Rosters are set up by EZ Esports staff');
  });
});
