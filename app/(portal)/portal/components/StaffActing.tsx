'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import ConfirmActionDialog from '@/app/components/admin/ConfirmActionDialog';
import { useConfirmAction } from '@/app/components/admin/useConfirmAction';

/** What a gated action may return: nothing, or an ActionResult-shaped outcome shown in the dialog on failure. */
type GatedOutcome = void | undefined | { success: boolean; error?: string };

interface StaffActingValue {
  /** True when the signed-in user is a staff admin viewing this school's portal. */
  isStaff: boolean;
  /**
   * Runs `run` straight away for a manager (no change in behavior). For a staff admin it first
   * asks "You're acting as <School> as staff. Confirm?" and runs only on Confirm. Wrap every
   * server mutation a portal control starts in this, and nothing else (reads need no confirmation).
   */
  confirmed: (run: () => GatedOutcome | Promise<GatedOutcome>) => void;
  /**
   * The same notice as a sentence for the portal's own confirm dialogs (delete, remove, discard),
   * so staff see one dialog, not two. Empty for a manager.
   */
  actingNotice: string;
}

const MANAGER: StaffActingValue = {
  isStaff: false,
  confirmed: (run) => void run(),
  actingNotice: '',
};

const StaffActingContext = createContext<StaffActingValue>(MANAGER);

export function useStaffActing(): StaffActingValue {
  return useContext(StaffActingContext);
}

/**
 * The one confirmation for staff admins acting as a school (spec-055). Authorization stays on the
 * server; this only adds the "are you sure you mean this school" step. Managers get the
 * pass-through value and never see a dialog.
 */
export function StaffActingProvider({
  isStaff,
  schoolName,
  children,
}: {
  isStaff: boolean;
  schoolName: string;
  children: ReactNode;
}) {
  const gate = useConfirmAction<{ run: () => GatedOutcome | Promise<GatedOutcome> }>(
    async ({ run }) => run(),
    'Something went wrong.',
  );
  const { request } = gate;
  const confirmed = useCallback<StaffActingValue['confirmed']>((run) => request({ run }), [request]);

  const value = useMemo<StaffActingValue>(
    () =>
      isStaff
        ? { isStaff: true, confirmed, actingNotice: `You're acting as ${schoolName} as staff.` }
        : MANAGER,
    [isStaff, confirmed, schoolName],
  );

  return (
    <StaffActingContext.Provider value={value}>
      {children}
      {isStaff && (
        <ConfirmActionDialog
          {...gate.dialogProps}
          appearance="portal"
          title="Act as this school?"
          message={`You're acting as ${schoolName} as staff. Confirm?`}
          confirmLabel="Confirm"
          pendingLabel="Working…"
        />
      )}
    </StaffActingContext.Provider>
  );
}
