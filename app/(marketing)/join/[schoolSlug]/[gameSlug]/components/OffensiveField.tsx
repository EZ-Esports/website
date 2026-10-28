import { createContext, useContext } from 'react';

/** Border and focus classes for a typed field. A field flagged for offensive language gets the danger colour. */
export function fieldBorderClass(invalidField: string | null | undefined, field: string): string {
  return invalidField === field ? 'border-danger focus:ring-danger' : 'border-border focus:ring-accent';
}

/**
 * The wizard's view of flagged fields and the student's confirmations (spec-040). `flagged` is recomputed on
 * every render from the current values, so the confirmation box appears only under a field that is flagged now.
 */
export interface OffensiveFieldOverrideState {
  flagged: readonly string[];
  isConfirmed: (field: string) => boolean;
  setConfirmed: (field: string, ticked: boolean) => void;
}

const OffensiveFieldOverrideContext = createContext<OffensiveFieldOverrideState | null>(null);

/** Wrap the wizard's form so every step's fields share one flagged-and-confirmed state. */
export const OffensiveFieldOverrideProvider = OffensiveFieldOverrideContext.Provider;

/**
 * Under a typed field: the highlight message when the server flagged it, and the confirmation box whenever the
 * field is flagged in the current value. Renders nothing for a clean field.
 */
export function OffensiveFieldHint({
  invalidField,
  field,
}: {
  invalidField: string | null | undefined;
  field: string;
}) {
  const overrides = useContext(OffensiveFieldOverrideContext);
  const isFlagged = overrides?.flagged.includes(field) ?? false;
  const showServerHint = invalidField === field;
  if (!showServerHint && !isFlagged) return null;
  const checkboxId = `${field}-override`;
  return (
    <>
      {showServerHint && (
        <p id={`${field}-offensive-hint`} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          Remove offensive language from this field.
        </p>
      )}
      {isFlagged && overrides && (
        <label htmlFor={checkboxId} className="mt-2 flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-foreground-secondary">
          <input
            id={checkboxId}
            type="checkbox"
            checked={overrides.isConfirmed(field)}
            onChange={(e) => overrides.setConfirmed(field, e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-accent accent-accent focus:ring-accent"
          />
          <span>This is my real information, and I confirm it is not offensive.</span>
        </label>
      )}
    </>
  );
}
