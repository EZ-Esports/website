// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ preview: vi.fn(), commit: vi.fn() }));
vi.mock('@/app/(admin)/admin/matches/generate-season-actions', () => ({
  previewGenerateSeason: mocks.preview,
  commitGenerateSeason: mocks.commit,
}));

import GenerateSeasonDialog from '../GenerateSeasonDialog';

afterEach(() => {
  cleanup();
  mocks.preview.mockReset();
});

const games = [{ id: 'g1', slug: 'valorant', displayName: 'Valorant', shortName: 'VAL' }];
const seasons = [{ id: 's1', gameId: 'g1', name: 'Fall 2026', isActive: true }];
const schools = Array.from({ length: 8 }, (_, i) => ({ id: `sc${i}`, name: `School ${i}` }));

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Reopen</button>
      <GenerateSeasonDialog isOpen={open} onOpenChange={setOpen} games={games} seasons={seasons} schools={schools} onGenerated={() => {}} />
    </>
  );
}

const fakePreview = {
  seasonName: 'Fall 2026',
  gameName: 'Valorant',
  division: 'Varsity',
  teamsToCreate: [],
  rostersToCreate: [],
  reusedSchools: ['School 0'],
  weeks: [{ round: 1, kickoffIso: '2026-11-02T00:00:00.000Z', matches: [{ homeName: 'A', awayName: 'B' }] }],
  matchCount: 28,
  fingerprint: 'abc',
};

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Game'), 'g1');
  await user.selectOptions(screen.getByLabelText('Season'), 's1');
  await user.type(screen.getByLabelText(/Week 1 date/), '2026-11-02');
  await user.click(screen.getByRole('button', { name: 'Select all' }));
}

describe('GenerateSeasonDialog', () => {
  it('locks the inputs while a preview is building', async () => {
    const user = userEvent.setup();
    mocks.preview.mockReturnValue(new Promise(() => {}));
    render(<Harness />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Preview schedule' }));
    await waitFor(() => expect(screen.getByLabelText('Game')).toBeDisabled());
    expect(screen.getByLabelText('School 0')).toBeDisabled();
  });

  it('ignores a preview that resolves after the dialog was cancelled and reopened', async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    mocks.preview.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<Harness />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Preview schedule' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Reopen' }));
    resolve({ success: true, preview: fakePreview });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/28 matches over/)).toBeNull();
    // State was reset on cancel: the form starts empty again.
    expect((screen.getByLabelText('Game') as HTMLSelectElement).value).toBe('');
    expect(screen.getByText(/0 selected/)).toBeTruthy();
  });

  it('shows the preview in a persistent status region when inputs are unchanged', async () => {
    const user = userEvent.setup();
    mocks.preview.mockResolvedValue({ success: true, preview: fakePreview });
    render(<Harness />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Preview schedule' }));
    const text = await screen.findByText(/28 matches over/);
    expect(text.closest('[role="status"][aria-live="polite"]')).not.toBeNull();
  });
});
