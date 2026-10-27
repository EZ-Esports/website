'use client';

import { useCallback, useRef, useState } from 'react';

/** What a confirmed action may return: nothing, or an ActionResult-shaped outcome. */
type ConfirmOutcome = void | undefined | { success: boolean; error?: string };

/**
 * State for a confirm-then-act flow rendered with ConfirmActionDialog.
 *
 * `request(target)` opens the dialog; the action only runs from `confirm`, so a
 * cancelled dialog can never reach it. A failure (a `{ success: false }` result or a
 * throw) keeps the dialog open with the message in `error` rather than swallowing it.
 * The last target is kept after closing so the dialog can still read its title and
 * message while it animates out.
 */
export function useConfirmAction<T>(run: (target: T) => Promise<ConfirmOutcome>, fallbackError = 'Something went wrong.') {
  const [state, setState] = useState<{ open: boolean; target: T | null }>({ open: false, target: null });
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State updates are async; the ref is what stops a double press from running twice.
  const inFlight = useRef(false);

  const request = useCallback((target: T) => {
    setError(null);
    setState({ open: true, target });
  }, []);

  const onOpenChange = useCallback((open: boolean) => {
    if (!open && inFlight.current) return;
    if (!open) setError(null);
    setState((prev) => ({ ...prev, open }));
  }, []);

  const confirm = useCallback(async () => {
    const target = state.target;
    if (inFlight.current || !state.open || target === null) return;
    inFlight.current = true;
    setIsPending(true);
    setError(null);
    try {
      const result = await run(target);
      if (result && result.success === false) {
        setError(result.error || fallbackError);
        return;
      }
      setState((prev) => ({ ...prev, open: false }));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fallbackError);
    } finally {
      inFlight.current = false;
      setIsPending(false);
    }
  }, [state, run, fallbackError]);

  return {
    target: state.target,
    request,
    /** Spread onto ConfirmActionDialog. */
    dialogProps: { isOpen: state.open, onOpenChange, isPending, error, onConfirm: confirm },
  };
}
