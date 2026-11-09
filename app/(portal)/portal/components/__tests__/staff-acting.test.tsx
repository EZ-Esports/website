// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaffActingProvider, useStaffActing } from '../StaffActing';

afterEach(cleanup);

function Trigger({ run }: { run: () => void }) {
  const { confirmed } = useStaffActing();
  return (
    <button type="button" onClick={() => confirmed(run)}>
      Do it
    </button>
  );
}

describe('StaffActingProvider', () => {
  it('runs a manager action straight away, with no dialog', async () => {
    const run = vi.fn();
    render(
      <StaffActingProvider isStaff={false} schoolName="Test High">
        <Trigger run={run} />
      </StaffActingProvider>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Do it' }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('runs without any provider as a manager would', async () => {
    const run = vi.fn();
    render(<Trigger run={run} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Do it' }));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('asks a staff admin first and runs only after Confirm', async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(
      <StaffActingProvider isStaff schoolName="Test High">
        <Trigger run={run} />
      </StaffActingProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Do it' }));
    expect(run).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain("You're acting as Test High as staff. Confirm?");
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('never runs the action when a staff admin cancels', async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(
      <StaffActingProvider isStaff schoolName="Test High">
        <Trigger run={run} />
      </StaffActingProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Do it' }));
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(run).not.toHaveBeenCalled();
  });
});
