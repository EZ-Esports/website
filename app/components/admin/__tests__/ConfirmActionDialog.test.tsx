// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useRef, useState } from 'react';
import { cleanup, render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmActionDialog from '../ConfirmActionDialog';
import { useConfirmAction } from '../useConfirmAction';

afterEach(cleanup);

function Harness({
  run,
  tone = 'danger',
}: {
  run: (t: string) => Promise<{ success: boolean; error?: string } | void>;
  tone?: 'danger' | 'default';
}) {
  const flow = useConfirmAction<string>(run);
  return (
    <div>
      <button type="button" onClick={() => flow.request('item-1')}>
        Open
      </button>
      <ConfirmActionDialog
        {...flow.dialogProps}
        tone={tone}
        title="Delete thing?"
        message="This removes the thing."
        confirmLabel="Delete thing"
        pendingLabel="Deleting…"
      />
    </div>
  );
}

describe('ConfirmActionDialog + useConfirmAction', () => {
  it('opens as an alertdialog with a danger Cancel that has initial focus', async () => {
    const user = userEvent.setup();
    render(<Harness run={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete thing?' });
    expect(dialog).toHaveAttribute('aria-describedby');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Delete thing' }).className).toContain('bg-red-600');
  });

  it('cancel and Escape never run the action, and focus returns to the trigger', async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(<Harness run={run} />);
    const trigger = screen.getByRole('button', { name: 'Open' });

    await user.click(trigger);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(run).not.toHaveBeenCalled();
  });

  it('confirm runs once with the target, even when pressed twice while pending', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const run = vi.fn(() => new Promise<void>((res) => (release = res)));
    render(<Harness run={run} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const confirmBtn = await screen.findByRole('button', { name: 'Delete thing' });

    await user.click(confirmBtn);
    const busy = await screen.findByRole('button', { name: /Deleting/ });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    await user.click(busy);
    await user.click(busy);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('item-1');

    // Escape is ignored mid-flight so the user cannot lose the result.
    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await act(async () => release());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('shows a failed result in the dialog, keeps it open, and allows a retry', async () => {
    const user = userEvent.setup();
    const run = vi
      .fn<(t: string) => Promise<{ success: boolean; error?: string }>>()
      .mockResolvedValueOnce({ success: false, error: 'Role is in use.' })
      .mockResolvedValueOnce({ success: true });
    render(<Harness run={run} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Delete thing' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Role is in use.');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete thing' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('shows a thrown error instead of swallowing it', async () => {
    const user = userEvent.setup();
    const run = vi.fn().mockRejectedValue(new Error('Network down'));
    render(<Harness run={run} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Delete thing' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
  });

  it('restoreFocusRef focuses the named element when the trigger is gone', async () => {
    const user = userEvent.setup();
    function MenuHarness() {
      const ref = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button ref={ref} type="button">
            Menu button
          </button>
          <ConfirmActionDialog
            isOpen={open}
            onOpenChange={setOpen}
            title="Sure?"
            message="m"
            confirmLabel="Go"
            restoreFocusRef={ref}
            onConfirm={() => {}}
          />
          <button type="button" onClick={() => setOpen(true)}>
            Elsewhere
          </button>
        </div>
      );
    }
    render(<MenuHarness />);
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Menu button' })).toHaveFocus());
  });
});
